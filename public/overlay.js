const card = document.querySelector('#now-playing');
const cover = document.querySelector('#cover');
const title = document.querySelector('#title');
const artist = document.querySelector('#artist');
const album = document.querySelector('#album');
const status = document.querySelector('#status');
const { t } = window.i18n;

let previousCoverUrl = '';
let latestData = null;
const debugMode = new URLSearchParams(window.location.search).has('debug');

function update(data) {
  latestData = data;
  if (data.language) window.i18n.setLanguage(data.language);
  if (!data.available) {
    if (!debugMode) {
      card.classList.remove('visible');
      return;
    }

    title.textContent = t('overlay.notDetected');
    artist.textContent = data.error || t('overlay.prompt');
    album.textContent = t('overlay.diagnosticHint');
    status.textContent = t('overlay.diagnostic');
    card.classList.add('paused', 'visible');
    refreshCover(data);
    return;
  }

  title.textContent = data.title || t('overlay.unknownTitle');
  artist.textContent = data.artist || t('overlay.unknownArtist');
  album.textContent = data.album || '';
  status.textContent = data.playback === 'playing' ? t('overlay.playing') : t('overlay.paused');
  card.classList.toggle('paused', data.playback !== 'playing');
  card.dataset.visualizer = data.visualizer || 'bars';

  refreshCover(data);
  card.classList.add('visible');
}

document.addEventListener('app-language-change', () => {
  if (latestData) update(latestData);
});

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
