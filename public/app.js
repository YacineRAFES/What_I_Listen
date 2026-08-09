const connection = document.querySelector('#connection');
const cover = document.querySelector('#cover');
const playback = document.querySelector('#playback');
const title = document.querySelector('#title');
const artist = document.querySelector('#artist');
const album = document.querySelector('#album');
const errorText = document.querySelector('#error');
const obsUrl = document.querySelector('#obs-url');
const copyButton = document.querySelector('#copy-url');
const { t } = window.i18n;

let previousCoverUrl = '';
let latestData = null;
let latestError = '';

function render(data) {
  latestData = data;
  latestError = '';
  if (data.language) window.i18n.setLanguage(data.language);
  connection.className = 'connection ok';
  connection.textContent = t('app.connection.active');
  errorText.textContent = data.error || '';

  if (!data.available) {
    playback.textContent = t('app.track.waiting');
    title.textContent = t('app.track.none');
    artist.textContent = t('app.track.prompt');
    album.textContent = '';
  } else {
    playback.textContent = data.playback === 'playing' ? t('app.track.playing') : t('app.track.paused');
    title.textContent = data.title || t('app.track.unknownTitle');
    artist.textContent = data.artist || t('app.track.unknownArtist');
    album.textContent = data.album || '';
  }

  refreshCover(data);
}

function renderServiceError(message) {
  latestData = null;
  latestError = message;
  connection.className = 'connection error';
  connection.textContent = t('app.connection.unavailable');
  errorText.textContent = message;
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
    renderServiceError(error.message);
  }
}

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(obsUrl.textContent);
    copyButton.textContent = t('app.guide.copied');
    window.setTimeout(() => { copyButton.textContent = t('app.guide.copy'); }, 1600);
  } catch {
    errorText.textContent = t('app.copyError');
  }
});

document.addEventListener('app-language-change', () => {
  if (latestData) render(latestData);
  else if (latestError) renderServiceError(latestError);
});

refresh();
window.setInterval(refresh, 750);
