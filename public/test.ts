const toggleButton = document.querySelector<HTMLButtonElement>('#test-toggle')!;
const statusBadge = document.querySelector<HTMLElement>('#test-status-badge')!;
const form = document.querySelector<HTMLFormElement>('#test-form')!;
const titleInput = document.querySelector<HTMLInputElement>('#test-title')!;
const artistInput = document.querySelector<HTMLInputElement>('#test-artist')!;
const albumInput = document.querySelector<HTMLInputElement>('#test-album')!;
const sourceInput = document.querySelector<HTMLInputElement>('#test-source')!;
const bassInput = document.querySelector<HTMLInputElement>('#test-bass')!;
const bassValue = document.querySelector<HTMLOutputElement>('#test-bass-value')!;
const playButton = document.querySelector<HTMLButtonElement>('#test-play')!;
const pauseButton = document.querySelector<HTMLButtonElement>('#test-pause')!;
const nextButton = document.querySelector<HTMLButtonElement>('#test-next')!;
const previewFrame = document.querySelector<HTMLIFrameElement>('#test-preview-frame')!;
const previewViewport = document.querySelector<HTMLElement>('#test-preview-viewport')!;
const overlaySize = document.querySelector<HTMLElement>('#test-overlay-size')!;
const summaryPlayback = document.querySelector<HTMLElement>('#summary-playback')!;
const summaryTitle = document.querySelector<HTMLElement>('#summary-title')!;
const summaryDetails = document.querySelector<HTMLElement>('#summary-details')!;
const message = document.querySelector<HTMLElement>('#test-message')!;
const { t } = window.i18n;

const demoTitles = [
  ['Midnight Frequencies', 'What I Listen', 'OBS Test Session'],
  ['Neon Horizon', 'The Overlay Drivers', 'Browser Source Stories'],
  ['Bassline Check', 'Studio Monitor', 'Before Going Live'],
  ['A New Track Appears', 'Signal Generator', 'Scene Transition'],
] as const;
const longTitle = 'Un morceau au titre volontairement beaucoup trop long pour tenir sur une seule ligne dans la source Navigateur OBS';
let current: TestModeData | null = null;
let nextTitleIndex = 0;
let bassTimer: number | undefined;
let previewWidth = 520;
let previewHeight = 130;

function setMessage(key: string, error = false) {
  message.textContent = t(key);
  message.classList.toggle('error', error);
}

function selectedCover(): TestCover {
  return (form.elements.namedItem('cover') as RadioNodeList).value === 'missing' ? 'missing' : 'sample';
}

function render(data: TestModeData, updateFields = true) {
  current = data;
  statusBadge.className = `test-status ${data.active ? 'on' : 'off'}`;
  statusBadge.textContent = t(data.active ? 'test.status.on' : 'test.status.off');
  toggleButton.classList.toggle('active', data.active);
  toggleButton.setAttribute('aria-pressed', String(data.active));
  toggleButton.textContent = t(data.active ? 'test.activation.stop' : 'test.activation.start');
  playButton.classList.toggle('selected', data.playback === 'playing');
  pauseButton.classList.toggle('selected', data.playback === 'paused');
  summaryPlayback.textContent = data.playback === 'playing' ? '▶' : 'Ⅱ';
  summaryTitle.textContent = data.title || t('app.track.unknownTitle');
  summaryDetails.textContent = `${data.artist || t('app.track.unknownArtist')} · ${Math.round(data.bass * 100)} %`;
  if (!updateFields) return;
  titleInput.value = data.title;
  artistInput.value = data.artist;
  albumInput.value = data.album;
  sourceInput.value = data.source;
  bassInput.value = String(Math.round(data.bass * 100));
  bassValue.value = `${bassInput.value} %`;
  const coverInput = form.querySelector<HTMLInputElement>(`input[name="cover"][value="${data.cover}"]`);
  if (coverInput) coverInput.checked = true;
}

async function updateTest(payload: Partial<TestModeData>, updateFields = true): Promise<TestModeData> {
  const response = await fetch('/api/test-mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json() as TestModeData & { error?: string };
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  render(result, updateFields);
  return result;
}

async function safelyUpdate(payload: Partial<TestModeData>, successKey = 'test.updated', updateFields = true) {
  try {
    await updateTest(payload, updateFields);
    setMessage(successKey);
  } catch {
    setMessage('test.error', true);
  }
}

function customPayload(): Partial<TestModeData> {
  return {
    active: true,
    title: titleInput.value,
    artist: artistInput.value,
    album: albumInput.value,
    source: sourceInput.value,
    cover: selectedCover(),
    bass: Number(bassInput.value) / 100,
  };
}

toggleButton.addEventListener('click', () => {
  void safelyUpdate({ active: !current?.active }, current?.active ? 'test.stopped' : 'test.started');
});
playButton.addEventListener('click', () => { void safelyUpdate({ active: true, playback: 'playing' }, 'test.playing'); });
pauseButton.addEventListener('click', () => { void safelyUpdate({ active: true, playback: 'paused' }, 'test.paused'); });
nextButton.addEventListener('click', () => {
  const [title, artist, album] = demoTitles[nextTitleIndex++ % demoTitles.length]!;
  void safelyUpdate({ active: true, title, artist, album, playback: 'playing' }, 'test.trackChanged');
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void safelyUpdate(customPayload(), 'test.applied');
});
bassInput.addEventListener('input', () => {
  bassValue.value = `${bassInput.value} %`;
  if (bassTimer) window.clearTimeout(bassTimer);
  bassTimer = window.setTimeout(() => {
    void safelyUpdate({ bass: Number(bassInput.value) / 100 }, 'test.updated', false);
  }, 100);
});

document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    switch (button.dataset.preset) {
      case 'long-title':
        void safelyUpdate({ active: true, title: longTitle, playback: 'playing' }, 'test.presetApplied');
        break;
      case 'missing-cover':
        void safelyUpdate({ active: true, cover: 'missing' }, 'test.presetApplied');
        break;
      case 'weak-bass':
        void safelyUpdate({ active: true, bass: .15, playback: 'playing' }, 'test.presetApplied');
        break;
      case 'strong-bass':
        void safelyUpdate({ active: true, bass: .92, playback: 'playing' }, 'test.presetApplied');
        break;
    }
  });
});

function resizePreview() {
  const scale = Math.min(1, previewViewport.clientWidth / previewWidth);
  previewFrame.style.width = `${previewWidth}px`;
  previewFrame.style.height = `${previewHeight}px`;
  previewFrame.style.transform = `scale(${scale})`;
  previewViewport.style.height = `${Math.ceil(previewHeight * scale)}px`;
}

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin || event.source !== previewFrame.contentWindow) return;
  if (event.data?.type !== 'what-i-listen:overlay-size') return;
  const width = Number(event.data.width);
  const height = Number(event.data.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return;
  previewWidth = width;
  previewHeight = height;
  overlaySize.textContent = `${width} × ${height}`;
  resizePreview();
});

document.addEventListener('app-language-change', () => {
  if (current) render(current, false);
});
new ResizeObserver(resizePreview).observe(previewViewport);
resizePreview();

fetch('/api/test-mode', { cache: 'no-store' })
  .then(async (response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(await response.json() as TestModeData);
  })
  .catch(() => setMessage('test.error', true));
