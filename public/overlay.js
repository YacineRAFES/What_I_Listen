const card = document.querySelector('#now-playing');
const cover = document.querySelector('#cover');
const title = document.querySelector('#title');
const titlePrimary = document.querySelector('#title-primary');
const artist = document.querySelector('#artist');
const album = document.querySelector('#album');
const status = document.querySelector('#status');
const { t } = window.i18n;
const bars = [...document.querySelectorAll('.equalizer span')];

let previousCoverUrl = '';
let latestData = null;
const query = new URLSearchParams(window.location.search);
const debugMode = query.has('debug');
const previewMode = query.has('preview');
let lastAudioUpdate = 0;
let previewAnimationFrame = null;
let titleMarqueeAnimationFrame = null;
let titleMarqueeEnabled = true;

function applyAudioLevels(audio) {
  const bands = Array.isArray(audio?.bands) ? audio.bands : [];
  const level = Math.max(0, Math.min(1, Number(audio?.level) || 0));
  const intensity = Math.max(0.06, Math.pow(level, 0.66));

  bars.forEach((bar, index) => {
    const position = Math.round((index / Math.max(1, bars.length - 1)) * Math.max(0, bands.length - 1));
    const band = Math.max(0, Math.min(1, Number(bands[position]) || 0));
    bar.style.setProperty('--bar-level', String(Math.max(0.08, Math.pow(band, 0.72) * 1.15)));
  });
  card.style.setProperty('--audio-opacity', String(0.1 + intensity * 0.38));
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

function animatePreview(time) {
  previewAnimationFrame = null;
  if (!previewMode) return;

  const bands = bars.map((_, index) => {
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

  if (!titleMarqueeEnabled || title.clientWidth === 0) return;

  const titleWidth = titlePrimary.getBoundingClientRect().width;
  if (titleWidth <= title.clientWidth + 1) return;

  const distance = Math.ceil(titleWidth - title.clientWidth);
  title.style.setProperty('--title-scroll-distance', `-${distance}px`);
  title.style.setProperty('--title-scroll-duration', `${Math.max(5, distance / 30).toFixed(2)}s`);
  title.classList.add('scrolling');
}

function scheduleTitleMarquee() {
  if (titleMarqueeAnimationFrame !== null) window.cancelAnimationFrame(titleMarqueeAnimationFrame);
  titleMarqueeAnimationFrame = window.requestAnimationFrame(updateTitleMarquee);
}

function setTitle(value) {
  if (titlePrimary.textContent === value) return;
  titlePrimary.textContent = value;
  scheduleTitleMarquee();
}

function update(data) {
  latestData = data;
  if (data.language) window.i18n.setLanguage(data.language);
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

const audioStream = new EventSource('/api/audio-stream');
audioStream.addEventListener('levels', (event) => {
  try {
    const audio = JSON.parse(event.data);
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
