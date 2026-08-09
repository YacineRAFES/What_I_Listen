const card = document.querySelector('#now-playing');
const cover = document.querySelector('#cover');
const title = document.querySelector('#title');
const artist = document.querySelector('#artist');
const album = document.querySelector('#album');
const status = document.querySelector('#status');
const bars = [...document.querySelectorAll('.equalizer span')];

let previousCoverUrl = '';
const query = new URLSearchParams(window.location.search);
const debugMode = query.has('debug');
const previewMode = query.has('preview');
let lastAudioUpdate = 0;
let previewAnimationFrame = null;

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

function update(data) {
  if (!data.available) {
    if (!debugMode) {
      card.classList.remove('visible');
      return;
    }

    title.textContent = 'Deezer non détecté';
    artist.textContent = data.error || 'Lance un morceau dans Deezer.';
    album.textContent = 'La source se masquera automatiquement dès que la lecture est détectée.';
    status.textContent = 'Aperçu animé';
    card.dataset.visualizer = data.visualizer || 'bars';
    card.classList.remove('paused');
    card.classList.add('visible');
    ensurePreviewAnimation();
    refreshCover(data);
    return;
  }

  title.textContent = data.title || 'Titre inconnu';
  artist.textContent = data.artist || 'Artiste inconnu';
  album.textContent = data.album || '';
  status.textContent = data.playback === 'playing' ? 'En lecture sur Deezer' : 'En pause sur Deezer';
  card.classList.toggle('paused', data.playback !== 'playing');
  card.dataset.visualizer = data.visualizer || 'bars';

  if (previewMode) {
    status.textContent = 'Aperçu animé';
    card.classList.remove('paused');
    ensurePreviewAnimation();
  }

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
