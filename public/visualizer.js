const options = [...document.querySelectorAll('.option')];
const status = document.querySelector('#save-status');

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

load();
