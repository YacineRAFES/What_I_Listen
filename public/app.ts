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
const diagnosticCount = document.querySelector<HTMLElement>('#diagnostic-count')!;
const diagnosticRefresh = document.querySelector<HTMLButtonElement>('#diagnostic-refresh')!;
const diagnosticMeter = document.querySelector<HTMLElement>('#diagnostic-meter')!;
const diagnosticMeterLevel = diagnosticMeter.querySelector<HTMLElement>('i')!;
const { t } = window.i18n;

let previousCoverUrl = '';
let latestData: NowPlayingData | null = null;
let latestError = '';
let latestDiagnostics: StreamDiagnosticData | null = null;
let diagnosticRefreshPending = false;
let lastAudioSignalAt = 0;

type DiagnosticStatus = 'checking' | 'ready' | 'warning' | 'error' | 'optional';
type DiagnosticName = 'deezer' | 'track' | 'device' | 'signal' | 'overlay' | 'sammi';

function setDiagnostic(
  name: DiagnosticName,
  status: DiagnosticStatus,
  detailKey: string,
  actionKey = '',
) {
  const item = document.querySelector<HTMLElement>(`#diagnostic-${name}`)!;
  item.className = `diagnostic-item ${status}`;
  item.querySelector<HTMLElement>('[data-diagnostic-detail]')!.textContent = t(detailKey);
  item.querySelector<HTMLElement>('[data-diagnostic-state]')!.textContent = t(`app.diagnostic.state.${status}`);
  item.querySelector<HTMLElement>('[data-diagnostic-action]')!.textContent = actionKey ? t(actionKey) : '';
}

function updateDiagnosticSummary(data: StreamDiagnosticData) {
  const requiredChecks = [
    data.deezerDetected,
    data.trackReceived,
    data.audioDeviceAvailable,
    data.audioSignalMeasured,
    data.overlayAccessible,
  ];
  const checks = data.sammiEnabled ? [...requiredChecks, data.sammiConnected] : requiredChecks;
  const ready = checks.filter(Boolean).length;
  diagnosticCount.textContent = `${ready}/${checks.length} ${t(ready === checks.length ? 'app.diagnostic.ready' : 'app.diagnostic.pending')}`;
  diagnosticCount.classList.toggle('has-errors', ready !== checks.length);
}

function updateDiagnosticMeter(level: number) {
  const safeLevel = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
  const displayedLevel = Math.min(1, Math.sqrt(safeLevel) * 1.6);
  diagnosticMeterLevel.style.transform = `scaleX(${displayedLevel})`;
  diagnosticMeter.setAttribute('aria-valuenow', String(Math.round(safeLevel * 100)));
}

function renderAudioDiagnostics(data: StreamDiagnosticData) {
  setDiagnostic(
    'device',
    data.audioDeviceAvailable ? 'ready' : 'error',
    data.audioDeviceAvailable ? 'app.diagnostic.device.ready' : 'app.diagnostic.device.error',
    data.audioDeviceAvailable ? '' : 'app.diagnostic.device.action',
  );
  setDiagnostic(
    'signal',
    data.audioSignalMeasured ? 'ready' : (data.audioDeviceAvailable ? 'warning' : 'error'),
    data.audioSignalMeasured
      ? 'app.diagnostic.signal.ready'
      : (data.audioDeviceAvailable ? 'app.diagnostic.signal.silent' : 'app.diagnostic.signal.unavailable'),
    data.audioSignalMeasured ? '' : 'app.diagnostic.signal.action',
  );
  updateDiagnosticMeter(data.audioLevel);
}

function renderDiagnostics(data: StreamDiagnosticData) {
  latestDiagnostics = data;
  if (data.audioSignalMeasured) lastAudioSignalAt = Date.now();
  setDiagnostic(
    'deezer',
    data.deezerDetected ? 'ready' : 'error',
    data.deezerDetected ? 'app.diagnostic.deezer.ready' : 'app.diagnostic.deezer.error',
    data.deezerDetected ? '' : 'app.diagnostic.deezer.action',
  );
  setDiagnostic(
    'track',
    data.trackReceived ? 'ready' : (data.deezerDetected ? 'warning' : 'error'),
    data.trackReceived ? 'app.diagnostic.track.ready' : 'app.diagnostic.track.error',
    data.trackReceived ? '' : 'app.diagnostic.track.action',
  );
  renderAudioDiagnostics(data);
  setDiagnostic(
    'overlay',
    data.overlayAccessible ? 'ready' : 'error',
    data.overlayAccessible ? 'app.diagnostic.overlay.ready' : 'app.diagnostic.overlay.error',
    data.overlayAccessible ? '' : 'app.diagnostic.overlay.action',
  );
  setDiagnostic(
    'sammi',
    !data.sammiEnabled ? 'optional' : (data.sammiConnected ? 'ready' : 'error'),
    !data.sammiEnabled
      ? 'app.diagnostic.sammi.disabled'
      : (data.sammiConnected ? 'app.diagnostic.sammi.ready' : 'app.diagnostic.sammi.error'),
    data.sammiEnabled && data.sammiConnected ? '' : 'app.diagnostic.sammi.action',
  );
  updateDiagnosticSummary(data);
}

function renderUnavailableDiagnostics() {
  latestDiagnostics = null;
  (['deezer', 'track', 'device', 'signal'] as const).forEach((name) => {
    setDiagnostic(name, 'error', 'app.diagnostic.serviceUnavailable', 'app.diagnostic.overlay.action');
  });
  setDiagnostic('overlay', 'error', 'app.diagnostic.overlay.error', 'app.diagnostic.overlay.action');
  setDiagnostic('sammi', 'checking', 'app.diagnostic.sammi.checking');
  diagnosticCount.textContent = t('app.diagnostic.unavailable');
  diagnosticCount.classList.add('has-errors');
  updateDiagnosticMeter(0);
}

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
    playback.textContent = data.playback === 'playing'
      ? t(data.testMode ? 'app.track.testPlaying' : 'app.track.playing')
      : t(data.testMode ? 'app.track.testPaused' : 'app.track.paused');
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

async function refreshDiagnostics() {
  if (diagnosticRefreshPending) return;
  diagnosticRefreshPending = true;
  diagnosticRefresh.disabled = true;
  try {
    const response = await fetch('/api/diagnostics', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderDiagnostics(await response.json() as StreamDiagnosticData);
  } catch {
    renderUnavailableDiagnostics();
  } finally {
    diagnosticRefreshPending = false;
    diagnosticRefresh.disabled = false;
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

diagnosticRefresh.addEventListener('click', () => {
  void Promise.all([refresh(), refreshDiagnostics()]);
});

document.addEventListener('app-language-change', () => {
  if (latestData) render(latestData);
  else if (latestError) renderServiceError(latestError);
  if (latestDiagnostics) renderDiagnostics(latestDiagnostics);
  else renderUnavailableDiagnostics();
});

const diagnosticAudioStream = new EventSource('/api/audio-stream');
diagnosticAudioStream.addEventListener('levels', (event) => {
  if (!latestDiagnostics) return;
  try {
    const audio = JSON.parse(event.data) as AudioLevels & { active?: boolean; updatedAt?: number; error?: string };
    const audioDeviceAvailable = audio.active === true && !audio.error
      && Date.now() - (audio.updatedAt ?? 0) <= 3_000;
    if (audioDeviceAvailable && audio.level >= 0.002) lastAudioSignalAt = Date.now();
    latestDiagnostics = {
      ...latestDiagnostics,
      audioDeviceAvailable,
      audioSignalMeasured: audioDeviceAvailable && Date.now() - lastAudioSignalAt <= 2_000,
      audioLevel: audio.level,
      audioUpdatedAt: audio.updatedAt ?? Date.now(),
      audioError: audio.error,
    };
    renderAudioDiagnostics(latestDiagnostics);
    updateDiagnosticSummary(latestDiagnostics);
  } catch {
    // Le prochain diagnostic périodique rétablira l'état sans interrompre l'accueil.
  }
});

new ResizeObserver(resizeHomePreview).observe(homePreviewViewport);
resizeHomePreview();
refresh();
refreshDiagnostics();
window.setInterval(refresh, 750);
window.setInterval(refreshDiagnostics, 5_000);
