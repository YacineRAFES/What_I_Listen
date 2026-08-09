const startHidden = document.querySelector('#start-hidden');
const status = document.querySelector('#save-status');

async function load() {
  try {
    const response = await fetch('/api/settings', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const settings = await response.json();
    startHidden.checked = settings.startHidden;
    status.textContent = 'Paramètres chargés.';
  } catch {
    status.textContent = 'Impossible de charger les paramètres.';
  }
}

startHidden.addEventListener('change', async () => {
  const value = startHidden.checked;
  startHidden.disabled = true;
  status.textContent = 'Enregistrement…';
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startHidden: value }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    status.textContent = value
      ? 'Enregistré. Au prochain lancement, l’application démarrera près de l’horloge.'
      : 'Enregistré. Au prochain lancement, la fenêtre s’affichera.';
  } catch {
    startHidden.checked = !value;
    status.textContent = 'Enregistrement impossible. Réessaie.';
  } finally {
    startHidden.disabled = false;
  }
});

load();
