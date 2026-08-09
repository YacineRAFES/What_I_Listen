const options = [...document.querySelectorAll('.option')];
const status = document.querySelector('#save-status');
const previewButton = document.querySelector('#open-preview');
const audioStatus = document.querySelector('#audio-status');

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
    status.textContent = 'Choix enregistré. L’overlay OBS se met à jour automatiquement.';
  } catch {
    status.textContent = 'Impossible de charger les réglages.';
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
      ? 'Synchronisation audio Windows active.'
      : `Synchronisation audio indisponible${audio.error ? ` : ${audio.error}` : '.'}`;
  } catch {
    audioStatus.classList.add('error');
    audioStatus.textContent = 'Impossible de vérifier la synchronisation audio.';
  }
}

options.forEach((option) => option.addEventListener('click', async () => {
  const mode = option.dataset.mode;
  select(mode);
  status.textContent = 'Enregistrement…';
  try {
    const response = await fetch('/api/visualizer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visualizer: mode }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    status.textContent = 'Choix enregistré. L’overlay OBS se met à jour automatiquement.';
  } catch {
    status.textContent = 'Enregistrement impossible. Réessaie.';
    load();
  }
}));

previewButton.addEventListener('click', async () => {
  if (!window.whatIListen?.openPreview) {
    status.textContent = 'L’aperçu est disponible dans l’application What I Listen.';
    return;
  }

  previewButton.disabled = true;
  try {
    await window.whatIListen.openPreview();
    status.textContent = 'Aperçu ouvert. Il reflète immédiatement le visuel sélectionné.';
  } catch {
    status.textContent = 'Impossible d’ouvrir l’aperçu. Réessaie.';
  } finally {
    previewButton.disabled = false;
  }
});

load();
refreshAudioStatus();
setInterval(refreshAudioStatus, 2000);
