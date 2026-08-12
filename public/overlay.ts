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
const meterBars = [...document.querySelectorAll<HTMLElement>('.visual-meter i')];
const oscilloscopeTrace = document.querySelector<SVGPathElement>('#oscilloscope-trace')!;
const spectrumSourceBandCount = spectrumBars.length / 2;
const spectrumPeaks = Array(spectrumBars.length).fill(.08);
const spectrumLevels = Array(spectrumBars.length).fill(.06);
const meterPeaks = Array(meterBars.length).fill(.06);
const meterLevels = Array(meterBars.length).fill(.04);
const oscilloscopePointCount = 33;
const oscilloscopeLevels = Array(oscilloscopePointCount).fill(0);
let oscilloscopePhase = 0;

let previousCoverUrl = '';
let latestData: NowPlayingData | null = null;
const query = new URLSearchParams(window.location.search);
const debugMode = query.has('debug');
const previewMode = query.has('preview');
let lastAudioUpdate = 0;
let titleMarqueeAnimationFrame: number | null = null;
let titleMarqueeEnabled = true;

function applyAudioLevels(audio?: AudioLevels) {
  // La sortie Windows peut contenir YouTube, un jeu, etc. Le spectrum ne doit
  // bouger que pendant la lecture du morceau suivi par l'overlay (Deezer).
  const liveAudio = latestData?.available && latestData.playback === 'playing' ? audio : undefined;
  const bands = Array.isArray(liveAudio?.bands) ? liveAudio.bands : [];
  const level = Math.max(0, Math.min(1, Number(liveAudio?.level) || 0));
  const intensity = Math.max(0.06, Math.pow(level, 0.66));

  bars.forEach((bar, index) => {
    const position = Math.round((index / Math.max(1, bars.length - 1)) * Math.max(0, bands.length - 1));
    const band = Math.max(0, Math.min(1, Number(bands[position]) || 0));
    bar.style.setProperty('--bar-level', String(Math.min(1, Math.pow(band, 0.72) * 1.15)));
  });
  spectrumBars.forEach((bar, index) => {
    // Les 16 mesures sont affichées de 16 à 1 puis de 1 à 16 afin de former
    // un spectrum symétrique de 32 bandes, centré sur les basses fréquences.
    const sourceIndex = index < spectrumSourceBandCount
      ? spectrumSourceBandCount - 1 - index
      : index - spectrumSourceBandCount;
    const position = Math.round((sourceIndex / Math.max(1, spectrumSourceBandCount - 1)) * Math.max(0, bands.length - 1));
    const band = Math.max(0, Math.min(1, Number(bands[position]) || 0));
    const targetLevel = Math.min(1, Math.pow(band, .68) * 1.16);
    const smoothing = targetLevel > spectrumLevels[index] ? .82 : .38;
    spectrumLevels[index] += (targetLevel - spectrumLevels[index]) * smoothing;
    spectrumPeaks[index] = Math.max(spectrumLevels[index], spectrumPeaks[index] - .1);
    bar.style.setProperty('--spectrum-level', String(spectrumLevels[index]));
    bar.style.setProperty('--spectrum-peak', `${(spectrumPeaks[index] * 100).toFixed(2)}%`);
    bar.style.setProperty('--spectrum-empty', `${(100 - spectrumLevels[index] * 100).toFixed(2)}%`);
  });
  meterBars.forEach((bar, index) => {
    const position = Math.round((index / Math.max(1, meterBars.length - 1)) * Math.max(0, bands.length - 1));
    const band = Math.max(0, Math.min(1, Number(bands[position]) || 0));
    const targetLevel = Math.min(1, Math.pow(band, .72) * 1.12);
    const smoothing = targetLevel > meterLevels[index] ? .8 : .24;
    meterLevels[index] += (targetLevel - meterLevels[index]) * smoothing;
    meterPeaks[index] = Math.max(meterLevels[index], meterPeaks[index] - .026);
    bar.style.setProperty('--meter-level', meterLevels[index].toFixed(3));
    bar.style.setProperty('--meter-peak', meterPeaks[index].toFixed(3));
  });
  oscilloscopePhase += .16 + level * .42;
  const oscilloscopePoints = Array.from({ length: oscilloscopePointCount }, (_, index) => {
    const progress = index / Math.max(1, oscilloscopePointCount - 1);
    const bandPosition = progress * Math.max(0, bands.length - 1);
    const lowerBand = Math.floor(bandPosition);
    const upperBand = Math.min(bands.length - 1, lowerBand + 1);
    const blend = bandPosition - lowerBand;
    const lowerLevel = Math.max(0, Math.min(1, Number(bands[lowerBand]) || 0));
    const upperLevel = Math.max(0, Math.min(1, Number(bands[upperBand]) || 0));
    const targetLevel = Math.pow(lowerLevel + (upperLevel - lowerLevel) * blend, .72);
    const smoothing = targetLevel > oscilloscopeLevels[index] ? .72 : .26;
    oscilloscopeLevels[index] += (targetLevel - oscilloscopeLevels[index]) * smoothing;
    const carrier = Math.sin(oscilloscopePhase + index * 1.43);
    const harmonic = Math.sin(oscilloscopePhase * 1.62 + index * .57) * .25;
    const x = progress * 160;
    const y = 50 + (carrier + harmonic) * oscilloscopeLevels[index] * 31;
    return { x, y };
  });
  const path = oscilloscopePoints.reduce((trace, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    const previous = oscilloscopePoints[index - 1]!;
    const midpointX = (previous.x + point.x) / 2;
    const midpointY = (previous.y + point.y) / 2;
    return `${trace} Q ${previous.x.toFixed(2)} ${previous.y.toFixed(2)} ${midpointX.toFixed(2)} ${midpointY.toFixed(2)}`;
  }, '');
  const lastPoint = oscilloscopePoints.at(-1)!;
  oscilloscopeTrace.setAttribute('d', `${path} T ${lastPoint.x.toFixed(2)} ${lastPoint.y.toFixed(2)}`);
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
  card.style.setProperty('--battery-opacity', String(0.12 + intensity * 0.7));
  card.style.setProperty('--battery-scale', String(0.72 + intensity * 0.62));
  card.style.setProperty('--battery-rotation', `${((level - .5) * 13).toFixed(2)}deg`);
  card.style.setProperty('--battery-ring-scale', String(0.55 + intensity * 1.25));
  card.style.setProperty('--battery-ring-scale-2', String((0.55 + intensity * 1.25) * .8));
  card.style.setProperty('--battery-ring-scale-3', String((0.55 + intensity * 1.25) * 1.35));
}

function flattenAudioLevels() {
  spectrumLevels.fill(0);
  spectrumPeaks.fill(0);
  meterLevels.fill(0);
  meterPeaks.fill(0);
  oscilloscopeLevels.fill(0);
  applyAudioLevels();
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
  card.dataset.spectrumPalette = data.spectrumPalette || 'modern';
  const nextTitleMarqueeEnabled = data.titleMarquee !== false;
  const titleMarqueeChanged = titleMarqueeEnabled !== nextTitleMarqueeEnabled;
  titleMarqueeEnabled = nextTitleMarqueeEnabled;
  if (titleMarqueeChanged) scheduleTitleMarquee();
  if (!data.available) {
    flattenAudioLevels();
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
    refreshCover(data);
    return;
  }

  setTitle(data.title || t('overlay.unknownTitle'));
  artist.textContent = data.artist || t('overlay.unknownArtist');
  album.textContent = data.album || '';
  status.textContent = data.playback === 'playing' ? t('overlay.playing') : t('overlay.paused');
  card.classList.toggle('paused', data.playback !== 'playing');
  card.dataset.visualizer = data.visualizer || 'bars';

  if (data.playback !== 'playing') flattenAudioLevels();

  if (previewMode) {
    status.textContent = t('overlay.preview');
    card.classList.remove('paused');
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
  } catch {
    // Le prochain événement rétablira naturellement le visuel.
  }
});

setInterval(() => {
  if (lastAudioUpdate && Date.now() - lastAudioUpdate > 1200) applyAudioLevels();
}, 500);
