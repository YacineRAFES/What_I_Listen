import { ReactiveWebGLVisualizer, type ReactiveWebGLMode } from './reactive-webgl.js';

const card = document.querySelector<HTMLElement>('#now-playing')!;
const overlayContent = document.querySelector<HTMLElement>('.overlay-content')!;
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
const reactiveCanvas = document.querySelector<HTMLCanvasElement>('#reactive-canvas')!;
const reactiveWebGLCanvas = document.querySelector<HTMLCanvasElement>('#reactive-webgl')!;
const reactiveContext = reactiveCanvas.getContext('2d', { alpha: true })!;
const reactiveWebGL = new ReactiveWebGLVisualizer(reactiveWebGLCanvas);
const spectrumSourceBandCount = spectrumBars.length / 2;
const spectrumPeaks = Array(spectrumBars.length).fill(.08);
const spectrumLevels = Array(spectrumBars.length).fill(.06);
const meterPeaks = Array(meterBars.length).fill(.06);
const meterLevels = Array(meterBars.length).fill(.04);
const oscilloscopePointCount = 33;
const oscilloscopeLevels = Array(oscilloscopePointCount).fill(0);
let oscilloscopePhase = 0;
const reactiveBands = Array(16).fill(0);
const reactiveTargets = Array(16).fill(0);
let reactiveLevel = 0;
let reactiveTargetLevel = 0;
let reactiveFrame = 0;
let reactiveLastFrame = 0;
let reactiveTime = 0;
let reactiveWidth = 1;
let reactiveHeight = 1;

interface ReactiveParticle {
  angle: number;
  band: number;
  distance: number;
  phase: number;
  size: number;
  speed: number;
}

const reactiveParticles: ReactiveParticle[] = Array.from({ length: 58 }, (_, index) => ({
  angle: (index / 58) * Math.PI * 2,
  band: index % 16,
  distance: .12 + ((index * 37) % 83) / 100,
  phase: ((index * 53) % 101) / 101 * Math.PI * 2,
  size: .65 + ((index * 29) % 17) / 10,
  speed: .18 + ((index * 31) % 23) / 48,
}));

let previousCoverUrl = '';
let latestData: NowPlayingData | null = null;
const query = new URLSearchParams(window.location.search);
const debugMode = query.has('debug');
const previewMode = query.has('preview');
const embeddedMode = query.has('embedded');
if (embeddedMode) document.documentElement.classList.add('embedded-preview');
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

  reactiveTargetLevel = level;
  reactiveTargets.forEach((_, index) => {
    const position = Math.round((index / Math.max(1, reactiveTargets.length - 1)) * Math.max(0, bands.length - 1));
    reactiveTargets[index] = Math.max(0, Math.min(1, Number(bands[position]) || 0));
  });

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

function resizeReactiveCanvas() {
  const bounds = overlayContent.getBoundingClientRect();
  const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  reactiveWidth = Math.max(1, bounds.width);
  reactiveHeight = Math.max(1, bounds.height);
  const width = Math.round(reactiveWidth * pixelRatio);
  const height = Math.round(reactiveHeight * pixelRatio);
  if (reactiveCanvas.width === width && reactiveCanvas.height === height) return;
  reactiveCanvas.width = width;
  reactiveCanvas.height = height;
  reactiveContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  reactiveWebGL.resize(reactiveWidth, reactiveHeight);
}

function drawTunnel(time: number) {
  const context = reactiveContext;
  const centerX = reactiveWidth * .72 + Math.sin(time * .7) * reactiveWidth * .035;
  const centerY = reactiveHeight * .5 + Math.cos(time * .9) * reactiveHeight * .08;
  const bass = (reactiveBands[0] + reactiveBands[1] + reactiveBands[2]) / 3;
  const travel = time * (.18 + bass * .62);
  const maxRadius = Math.hypot(reactiveWidth, reactiveHeight) * .58;

  context.save();
  context.globalCompositeOperation = 'lighter';
  for (let spoke = 0; spoke < reactiveBands.length; spoke += 1) {
    const angle = spoke / reactiveBands.length * Math.PI * 2 + time * .08;
    const band = reactiveBands[spoke];
    context.beginPath();
    context.moveTo(centerX, centerY);
    const reach = maxRadius * (.86 + band * .22);
    context.lineTo(centerX + Math.cos(angle) * reach, centerY + Math.sin(angle) * reach * .42);
    context.strokeStyle = `hsla(${(time * 36 + spoke * 19) % 360}, 100%, ${58 + band * 22}%, ${.08 + band * .22})`;
    context.lineWidth = .45 + band * 1.2;
    context.stroke();
  }
  for (let ring = 0; ring < 15; ring += 1) {
    const progress = (ring / 15 + travel) % 1;
    const eased = progress * progress;
    const radius = 4 + eased * maxRadius;
    const band = reactiveBands[(ring * 3) % reactiveBands.length];
    context.beginPath();
    context.ellipse(centerX, centerY, radius, radius * (.31 + band * .08), time * .06, 0, Math.PI * 2);
    context.strokeStyle = `hsla(${(time * 58 + ring * 24) % 360}, 100%, ${55 + band * 28}%, ${(1 - progress) * (.22 + band * .62)})`;
    context.lineWidth = .7 + band * 3.4;
    context.shadowBlur = 5 + band * 14;
    context.shadowColor = `hsl(${(time * 58 + ring * 24) % 360}, 100%, 62%)`;
    context.stroke();
  }
  context.restore();
}

function drawParticles(time: number) {
  const context = reactiveContext;
  const centerX = reactiveWidth * .7;
  const centerY = reactiveHeight * .5;
  const radiusX = reactiveWidth * .42;
  const radiusY = reactiveHeight * .58;

  context.save();
  context.globalCompositeOperation = 'lighter';
  reactiveParticles.forEach((particle, index) => {
    const band = reactiveBands[particle.band];
    const angle = particle.angle + time * particle.speed * (.35 + reactiveLevel * 1.8);
    const pulse = 1 + Math.sin(time * 1.7 + particle.phase) * .11 + band * .28;
    const distance = particle.distance * pulse;
    const x = centerX + Math.cos(angle) * radiusX * distance;
    const y = centerY + Math.sin(angle * 1.23 + particle.phase * .12) * radiusY * distance;
    const hue = (time * 42 + particle.band * 19 + index * 3) % 360;
    const size = particle.size * (.75 + band * 2.5);
    const glow = context.createRadialGradient(x, y, 0, x, y, size * 4.2);
    glow.addColorStop(0, `hsla(${hue}, 100%, 82%, ${.55 + band * .42})`);
    glow.addColorStop(.2, `hsla(${hue}, 100%, 62%, ${.35 + band * .4})`);
    glow.addColorStop(1, `hsla(${hue}, 100%, 48%, 0)`);
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, size * 4.2, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}

function drawKaleidoscope(time: number) {
  const context = reactiveContext;
  const centerX = reactiveWidth * .72;
  const centerY = reactiveHeight * .5;
  const maxRadius = Math.max(reactiveWidth * .47, reactiveHeight * 1.65);
  const arms = 16;

  context.save();
  context.translate(centerX, centerY);
  context.globalCompositeOperation = 'lighter';
  for (let arm = 0; arm < arms; arm += 1) {
    context.save();
    context.rotate(arm / arms * Math.PI * 2 + time * (.08 + reactiveLevel * .12));
    context.beginPath();
    context.moveTo(0, 0);
    reactiveBands.forEach((band, index) => {
      const progress = (index + 1) / reactiveBands.length;
      const radius = progress * maxRadius;
      const wave = Math.sin(time * 2.1 + index * .74 + arm * .55) * (3 + band * 18);
      context.lineTo(radius, wave);
    });
    context.strokeStyle = `hsla(${(time * 52 + arm * 36) % 360}, 100%, 65%, ${.16 + reactiveLevel * .42})`;
    context.lineWidth = 1 + reactiveBands[arm % 16] * 3;
    context.shadowBlur = 7 + reactiveLevel * 16;
    context.shadowColor = `hsl(${(time * 52 + arm * 36) % 360}, 100%, 58%)`;
    context.stroke();
    context.beginPath();
    for (let index = 0; index < reactiveBands.length; index += 1) {
      const band = reactiveBands[index];
      const progress = (index + .5) / reactiveBands.length;
      const radius = progress * maxRadius;
      const wave = Math.cos(time * 1.25 + index * .93 + arm * .38) * (8 + band * 22);
      if (index === 0) context.moveTo(radius, wave);
      else context.lineTo(radius, wave);
    }
    context.strokeStyle = `hsla(${(time * 41 + arm * 36 + 120) % 360}, 100%, 72%, ${.08 + reactiveLevel * .25})`;
    context.lineWidth = .55 + reactiveBands[(arm + 5) % 16] * 1.8;
    context.stroke();
    context.restore();
  }
  for (let ring = 0; ring < 8; ring += 1) {
    const band = reactiveBands[(ring * 2) % 16];
    const radius = 10 + ring * 15 + band * 25;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.strokeStyle = `hsla(${(time * 70 + ring * 61) % 360}, 100%, 67%, ${.12 + band * .5})`;
    context.lineWidth = .7 + band * 2.2;
    context.stroke();
  }
  context.restore();
}

function animateReactiveCanvas(timestamp: number) {
  reactiveFrame = window.requestAnimationFrame(animateReactiveCanvas);
  if (timestamp - reactiveLastFrame < 1000 / 30) return;
  const elapsed = Math.min(.1, Math.max(0, timestamp - reactiveLastFrame) / 1000);
  reactiveLastFrame = timestamp;
  const mode = card.dataset.visualizer;
  if (document.hidden || !card.classList.contains('visible') || !['tunnel', 'particles', 'kaleidoscope'].includes(mode || '')) return;

  resizeReactiveCanvas();
  reactiveBands.forEach((value, index) => {
    const target = reactiveTargets[index];
    reactiveBands[index] = value + (target - value) * (target > value ? .34 : .12);
  });
  reactiveLevel += (reactiveTargetLevel - reactiveLevel) * (reactiveTargetLevel > reactiveLevel ? .3 : .1);
  const bandEnergy = reactiveBands.reduce((peak, band) => Math.max(peak, band), 0);
  const motion = Math.max(reactiveLevel, bandEnergy * .6);
  if (motion > .003) reactiveTime += elapsed * (.22 + motion * 2.6);
  reactiveContext.clearRect(0, 0, reactiveWidth, reactiveHeight);
  const time = reactiveTime;
  const webGLRendered = reactiveWebGL.render(mode as ReactiveWebGLMode, time, reactiveLevel, reactiveBands);
  card.classList.toggle('webgl-fallback', !webGLRendered);
  if (webGLRendered) return;
  if (mode === 'tunnel') drawTunnel(time);
  if (mode === 'particles') drawParticles(time);
  if (mode === 'kaleidoscope') drawKaleidoscope(time);
}

function flattenAudioLevels() {
  spectrumLevels.fill(0);
  spectrumPeaks.fill(0);
  meterLevels.fill(0);
  meterPeaks.fill(0);
  oscilloscopeLevels.fill(0);
  reactiveTargets.fill(0);
  reactiveTargetLevel = 0;
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
new ResizeObserver(resizeReactiveCanvas).observe(overlayContent);
reactiveFrame = window.requestAnimationFrame(animateReactiveCanvas);
reactiveWebGLCanvas.addEventListener('reactive-webgl-status', (event) => {
  card.classList.toggle('webgl-fallback', !(event as CustomEvent<boolean>).detail);
});
card.classList.toggle('webgl-fallback', !reactiveWebGL.available);
window.addEventListener('pagehide', () => {
  window.cancelAnimationFrame(reactiveFrame);
  reactiveWebGL.dispose();
}, { once: true });

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
