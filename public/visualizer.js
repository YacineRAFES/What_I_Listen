const options = [...document.querySelectorAll('.option')];
const status = document.querySelector('#save-status');
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

document.addEventListener('app-language-change', () => setStatus(statusKey));

load();
