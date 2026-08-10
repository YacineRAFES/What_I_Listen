const card = document.querySelector<HTMLElement>('#now-playing')!;
const cover = document.querySelector<HTMLImageElement>('#cover')!;
const title = document.querySelector<HTMLElement>('#title')!;
const titlePrimary = document.querySelector<HTMLSpanElement>('#title-primary')!;
const titleDuplicate = document.querySelector<HTMLSpanElement>('#title-duplicate')!;
const artist = document.querySelector<HTMLElement>('#artist')!;
const album = document.querySelector<HTMLElement>('#album')!;
const status = document.querySelector<HTMLElement>('#status')!;
const { t } = window.i18n;
const bars = [...document.querySelectorAll<HTMLElement>('.equalizer span')];
const spectrumBars = [...document.querySelectorAll<HTMLElement>('.spectrum span')];
const spectrumPeaks = Array(spectrumBars.length).fill(.08);
const spectrumLevels = Array(spectrumBars.length).fill(.06);

let previousCoverUrl = '';
let latestData: NowPlayingData | null = null;
const query = new URLSearchParams(window.location.search);
const debugMode = query.has('debug');
const previewMode = query.has('preview');
let lastAudioUpdate = 0;
let previewAnimationFrame: number | null = null;
let titleMarqueeAnimationFrame: number | null = null;
let titleMarqueeEnabled = true;

function applyAudioLevels(audio?: AudioLevels) {
  const bands = Array.isArray(audio?.bands) ? audio.bands : [];
  const level = Math.max(0, Math.min(1, Number(audio?.level) || 0));
  const intensity = Math.max(0.06, Math.pow(level, 0.66));

  bars.forEach((bar, index) => {
    const position = Math.round((index / Math.max(1, bars.length - 1)) * Math.max(0, bands.length - 1));
    const band = Math.max(0, Math.min(1, Number(bands[position]) || 0));
    bar.style.setProperty('--bar-level', String(Math.max(0.08, Math.pow(band, 0.72) * 1.15)));
  });
  spectrumBars.forEach((bar, index) => {
    const position = Math.round((index / Math.max(1, spectrumBars.length - 1)) * Math.max(0, bands.length - 1));
    const band = Math.max(0, Math.min(1, Number(bands[position]) || 0));
    const targetLevel = Math.max(.06, Math.min(1, Math.pow(band, .68) * 1.16));
    const smoothing = targetLevel > spectrumLevels[index] ? .68 : .26;
    spectrumLevels[index] += (targetLevel - spectrumLevels[index]) * smoothing;
    spectrumPeaks[index] = Math.max(spectrumLevels[index], spectrumPeaks[index] - .07, .08);
    bar.style.setProperty('--spectrum-level', String(spectrumLevels[index]));
    bar.style.setProperty('--spectrum-peak', `${(spectrumPeaks[index] * 100).toFixed(2)}%`);
  });
  card.style.setProperty('--audio-opacity', String(0.1 + intensity * 0.38));
  card.style.setProperty('--spectrum-opacity', String(.48 + intensity * .5));
  const rippleOpacity = 0.08 + intensity * 0.58;
  card.style.setProperty('--ripple-opacity', String(rippleOpacity));
  card.style.setProperty('--ripple-opacity-2', String(rippleOpacity * 0.72));
  card.style.setProperty('--ripple-opacity-3', String(rippleOpacity * 0.45));
  card.style.setProperty('--ripple-scale-1', String(0.35 + intensity * 0.75));
  card.style.setProperty('--ripple-scale-2', String(0.75 + intensity * 1.15));
  card.style.setProperty('--ripple-scale-3', String(1.15 + intensity * 1.55));
  card.style.setProperty('--pulse-opacity', String(0.08 + intensity * 0.62));
  card.style.setProperty('--pulse-scale', String(0.65 + intensity * 0.7));
}

function animatePreview(time: number) {
  previewAnimationFrame = null;
  if (!previewMode) return;

  const bandCount = Math.max(bars.length, spectrumBars.length);
  const bands = Array.from({ length: bandCount }, (_, index) => {
    const wave = Math.sin(time / 180 + index * .78);
    const accent = Math.sin(time / 410 + index * 1.63);
    return Math.max(.06, .22 + wave * .2 + accent * .13);
  });
  applyAudioLevels({ bands, level: bands.reduce((total, band) => total + band, 0) / bands.length });
  previewAnimationFrame = window.requestAnimationFrame(animatePreview);
}

function ensurePreviewAnimation() {
  if (previewMode && previewAnimationFrame === null) {
    previewAnimationFrame = window.requestAnimationFrame(animatePreview);
  }
}

function updateTitleMarquee() {
  titleMarqueeAnimationFrame = null;
  title.classList.remove('scrolling');
  title.style.removeProperty('--title-scroll-distance');
  title.style.removeProperty('--title-scroll-duration');
  title.style.removeProperty('--title-scroll-gap');
  titleDuplicate.textContent = '';

  if (!titleMarqueeEnabled || title.clientWidth === 0) return;

  const titleWidth = titlePrimary.getBoundingClientRect().width;
  if (titleWidth <= title.clientWidth + 1) return;

  const gap = 48;
  const distance = Math.ceil(titleWidth + gap);
  titleDuplicate.textContent = titlePrimary.textContent;
  title.style.setProperty('--title-scroll-gap', `${gap}px`);
  title.style.setProperty('--title-scroll-distance', `-${distance}px`);
  title.style.setProperty('--title-scroll-duration', `${Math.max(8, distance / 30).toFixed(2)}s`);
  title.classList.add('scrolling');
}

function scheduleTitleMarquee() {
  if (titleMarqueeAnimationFrame !== null) window.cancelAnimationFrame(titleMarqueeAnimationFrame);
  titleMarqueeAnimationFrame = window.requestAnimationFrame(updateTitleMarquee);
}

function setTitle(value: string) {
  if (titlePrimary.textContent === value) return;
  titlePrimary.textContent = value;
  scheduleTitleMarquee();
}

function update(data: NowPlayingData) {
  latestData = data;
  if (data.language) window.i18n.setLanguage(data.language);
  card.dataset.skin = data.skin || 'luna';
  card.dataset.neonPalette = data.neonPalette || 'violet-cyan';
  const nextTitleMarqueeEnabled = data.titleMarquee !== false;
  const titleMarqueeChanged = titleMarqueeEnabled !== nextTitleMarqueeEnabled;
  titleMarqueeEnabled = nextTitleMarqueeEnabled;
  if (titleMarqueeChanged) scheduleTitleMarquee();
  if (!data.available) {
    if (!debugMode) {
      card.classList.remove('visible');
      return;
    }

    setTitle(t('overlay.notDetected'));
    artist.textContent = data.error || t('overlay.prompt');
    album.textContent = t('overlay.diagnosticHint');
    status.textContent = previewMode ? t('overlay.preview') : t('overlay.diagnostic');
    card.dataset.visualizer = data.visualizer || 'bars';
    card.classList.toggle('paused', !previewMode);
    card.classList.add('visible');
    ensurePreviewAnimation();
    refreshCover(data);
    return;
  }

  setTitle(data.title || t('overlay.unknownTitle'));
  artist.textContent = data.artist || t('overlay.unknownArtist');
  album.textContent = data.album || '';
  status.textContent = data.playback === 'playing' ? t('overlay.playing') : t('overlay.paused');
  card.classList.toggle('paused', data.playback !== 'playing');
  card.dataset.visualizer = data.visualizer || 'bars';

  if (previewMode) {
    status.textContent = t('overlay.preview');
    card.classList.remove('paused');
    ensurePreviewAnimation();
  }

  refreshCover(data);
  card.classList.add('visible');
}

document.addEventListener('app-language-change', () => {
  if (latestData) update(latestData);
  else scheduleTitleMarquee();
});

new ResizeObserver(scheduleTitleMarquee).observe(title);

function refreshCover(data: NowPlayingData) {
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
    update(await response.json() as NowPlayingData);
  } catch {
    card.classList.remove('visible');
  }
}

refresh();
setInterval(refresh, 750);

const audioStream = new EventSource('/api/audio-stream');
audioStream.addEventListener('levels', (event) => {
  try {
    const audio = JSON.parse(event.data) as AudioLevels & { updatedAt?: number };
    lastAudioUpdate = audio.updatedAt || Date.now();
    applyAudioLevels(audio);
    ensurePreviewAnimation();
  } catch {
    // Le prochain événement rétablira naturellement le visuel.
  }
});

setInterval(() => {
  if (lastAudioUpdate && Date.now() - lastAudioUpdate > 1200) applyAudioLevels();
}, 500);
