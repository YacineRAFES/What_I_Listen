const connection = document.querySelector('#connection');
const cover = document.querySelector('#cover');
const playback = document.querySelector('#playback');
const title = document.querySelector('#title');
const artist = document.querySelector('#artist');
const album = document.querySelector('#album');
const errorText = document.querySelector('#error');
const obsUrl = document.querySelector('#obs-url');
const copyButton = document.querySelector('#copy-url');

let previousCoverUrl = '';

function render(data) {
  connection.className = 'connection ok';
  connection.textContent = 'Service local actif';
  errorText.textContent = data.error || '';

  if (!data.available) {
    playback.textContent = 'En attente de Deezer';
    title.textContent = 'Aucun morceau détecté';
    artist.textContent = 'Lance Deezer et joue un titre.';
    album.textContent = '';
  } else {
    playback.textContent = data.playback === 'playing' ? 'En lecture sur Deezer' : 'En pause sur Deezer';
    title.textContent = data.title || 'Titre inconnu';
    artist.textContent = data.artist || 'Artiste inconnu';
    album.textContent = data.album || '';
  }

  refreshCover(data);
}

function refreshCover(data) {
  if (!data.coverUrl || data.coverUrl === previousCoverUrl) return;
  previousCoverUrl = data.coverUrl;
  cover.removeAttribute('src');
  window.requestAnimationFrame(() => {
    if (data.coverUrl === previousCoverUrl) cover.src = data.coverUrl;
  });
}

async function refresh() {
  try {
    const response = await fetch('/api/now-playing', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(await response.json());
  } catch (error) {
    connection.className = 'connection error';
    connection.textContent = 'Service indisponible';
    errorText.textContent = error.message;
  }
}

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(obsUrl.textContent);
    copyButton.textContent = 'URL copiée';
    window.setTimeout(() => { copyButton.textContent = 'Copier l’URL'; }, 1600);
  } catch {
    errorText.textContent = 'Copie impossible : sélectionne et copie l’URL manuellement.';
  }
});

refresh();
window.setInterval(refresh, 750);
