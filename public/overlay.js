const card = document.querySelector('#now-playing');
const cover = document.querySelector('#cover');
const title = document.querySelector('#title');
const artist = document.querySelector('#artist');
const album = document.querySelector('#album');
const status = document.querySelector('#status');

let previousCoverUrl = '';
const debugMode = new URLSearchParams(window.location.search).has('debug');

function update(data) {
  if (!data.available) {
    if (!debugMode) {
      card.classList.remove('visible');
      return;
    }

    title.textContent = 'Deezer non détecté';
    artist.textContent = data.error || 'Lance un morceau dans Deezer.';
    album.textContent = 'La source se masquera automatiquement dès que la lecture est détectée.';
    status.textContent = 'Mode diagnostic';
    card.classList.add('paused', 'visible');
    refreshCover(data);
    return;
  }

  title.textContent = data.title || 'Titre inconnu';
  artist.textContent = data.artist || 'Artiste inconnu';
  album.textContent = data.album || '';
  status.textContent = data.playback === 'playing' ? 'En lecture sur Deezer' : 'En pause sur Deezer';
  card.classList.toggle('paused', data.playback !== 'playing');
  card.dataset.visualizer = data.visualizer || 'bars';

  refreshCover(data);
  card.classList.add('visible');
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
    update(await response.json());
  } catch {
    card.classList.remove('visible');
  }
}

refresh();
setInterval(refresh, 750);
