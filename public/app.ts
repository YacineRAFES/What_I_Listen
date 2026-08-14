const connection = document.querySelector<HTMLDivElement>('#connection')!;
const cover = document.querySelector<HTMLImageElement>('#cover')!;
const playback = document.querySelector<HTMLElement>('#playback')!;
const title = document.querySelector<HTMLHeadingElement>('#title')!;
const artist = document.querySelector<HTMLParagraphElement>('#artist')!;
const album = document.querySelector<HTMLParagraphElement>('#album')!;
const errorText = document.querySelector<HTMLParagraphElement>('#error')!;
const obsUrl = document.querySelector<HTMLElement>('#obs-url')!;
const copyButton = document.querySelector<HTMLButtonElement>('#copy-url')!;
const homePreviewFrame = document.querySelector<HTMLIFrameElement>('#home-preview-frame')!;
const homePreviewViewport = document.querySelector<HTMLElement>('#home-preview-viewport')!;
const { t } = window.i18n;

let previousCoverUrl = '';
let latestData: NowPlayingData | null = null;
let latestError = '';

function render(data: NowPlayingData) {
  latestData = data;
  latestError = '';
  if (data.language) window.i18n.setLanguage(data.language);
  connection.className = data.error ? 'connection error' : 'connection ok';
  connection.textContent = data.error ? t('app.connection.unavailable') : t('app.connection.active');
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

function renderServiceError(message: string) {
  latestData = null;
  latestError = message;
  connection.className = 'connection error';
  connection.textContent = t('app.connection.unavailable');
  errorText.textContent = message;
}

function refreshCover(data: NowPlayingData) {
  if (!data.coverUrl || data.coverUrl === previousCoverUrl) return;
  previousCoverUrl = data.coverUrl;
  const nextCover = new Image();
  nextCover.addEventListener('load', () => {
    if (data.coverUrl === previousCoverUrl) cover.src = data.coverUrl;
  }, { once: true });
  nextCover.src = data.coverUrl;
}

function resizeHomePreview() {
  const scale = Math.min(1, homePreviewViewport.clientWidth / 520);
  homePreviewFrame.style.transform = `scale(${scale})`;
  homePreviewViewport.style.height = `${Math.ceil(130 * scale)}px`;
}

async function refresh() {
  try {
    const response = await fetch('/api/now-playing', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(await response.json() as NowPlayingData);
  } catch (error) {
    renderServiceError(error instanceof Error ? error.message : String(error));
  }
}

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(obsUrl.textContent ?? '');
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

new ResizeObserver(resizeHomePreview).observe(homePreviewViewport);
resizeHomePreview();
refresh();
window.setInterval(refresh, 750);
