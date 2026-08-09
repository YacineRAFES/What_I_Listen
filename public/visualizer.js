const options = [...document.querySelectorAll('.option')];
const status = document.querySelector('#save-status');
const previewButton = document.querySelector('#open-preview');
const audioStatus = document.querySelector('#audio-status');
const { t } = window.i18n;

let statusKey = 'visualizer.loading';

function setStatus(key) {
  statusKey = key;
  status.textContent = t(key);
}

function select(mode) {
  options.forEach((option) => {
    const selected = option.dataset.mode === mode;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-pressed', String(selected));
  });
}

async function load() {
  try {
    const response = await fetch('/api/visualizer', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    select(data.visualizer);
    setStatus('visualizer.saved');
  } catch {
    setStatus('visualizer.loadError');
  }
}

async function refreshAudioStatus() {
  try {
    const response = await fetch('/api/audio', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const audio = await response.json();
    const fresh = audio.active && Date.now() - audio.updatedAt < 1500;
    audioStatus.classList.toggle('error', !fresh);
    audioStatus.textContent = fresh
      ? t('visualizer.audio.active')
      : `${t('visualizer.audio.unavailable')}${audio.error ? ` : ${audio.error}` : '.'}`;
  } catch {
    audioStatus.classList.add('error');
    audioStatus.textContent = t('visualizer.audio.checkError');
  }
}

options.forEach((option) => option.addEventListener('click', async () => {
  const mode = option.dataset.mode;
  select(mode);
  setStatus('visualizer.saving');
  try {
    const response = await fetch('/api/visualizer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visualizer: mode }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    setStatus('visualizer.saved');
  } catch {
    setStatus('visualizer.saveError');
    load();
  }
}));

previewButton.addEventListener('click', async () => {
  if (!window.whatIListen?.openPreview) {
    setStatus('visualizer.preview.unavailable');
    return;
  }

  previewButton.disabled = true;
  try {
    await window.whatIListen.openPreview();
    setStatus('visualizer.preview.opened');
  } catch {
    setStatus('visualizer.preview.error');
  } finally {
    previewButton.disabled = false;
  }
});

document.addEventListener('app-language-change', () => {
  setStatus(statusKey);
  refreshAudioStatus();
});

load();
refreshAudioStatus();
setInterval(refreshAudioStatus, 2000);
