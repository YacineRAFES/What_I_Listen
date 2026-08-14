import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSessionManager } from 'windows-media-sessions';

const root = dirname(fileURLToPath(import.meta.url));
const publicDirectory = join(root, '..', 'public');
const overlaySkins = new Set<OverlaySkin>(['random', 'luna', 'winamp', 'glass', 'aura', 'neon', 'spectrum', 'battery', 'meter', 'oscilloscope', 'tunnel', 'particles', 'spiral', 'plasma', 'kaleidoscope', 'fractal', 'fluid', 'feedback', 'milkdrop-spiral', 'milkdrop-fractal', 'milkdrop-neon', 'milkdrop-liquid']);
const neonPalettes = new Set(['violet-cyan', 'sunset', 'laser']);
const spectrumPalettes = new Set(['modern', 'ocean-mist', 'fire-storm', 'scope']);
const supportedLanguages = new Set(['fr', 'en']);
const appThemes = new Set(['dark', 'light']);
const defaultSettings = Object.freeze({
  skin: 'luna',
  neonPalette: 'violet-cyan',
  spectrumPalette: 'modern',
  audioOutputDeviceId: '',
  startHidden: true,
  titleMarquee: true,
  language: 'fr',
  appTheme: 'dark',
  sammiEnabled: false,
  sammiPort: 9450,
  sammiPassword: '',
  sammiWebhookTrigger: 'what_i_listen_track_changed',
  sammiMessageTemplate: '🎵 En écoute : {artist} — {title}',
} satisfies OverlaySettings);
const visualizerForSkin: Readonly<Record<ConcreteOverlaySkin, VisualizerMode>> = Object.freeze({
  luna: 'bars',
  winamp: 'spectrum',
  glass: 'ripple',
  aura: 'pulse',
  neon: 'bars',
  spectrum: 'spectrum',
  battery: 'battery',
  meter: 'meter',
  oscilloscope: 'oscilloscope',
  tunnel: 'tunnel',
  particles: 'particles',
  spiral: 'spiral',
  plasma: 'plasma',
  kaleidoscope: 'kaleidoscope',
  fractal: 'fractal',
  fluid: 'fluid',
  feedback: 'feedback',
  'milkdrop-spiral': 'milkdrop',
  'milkdrop-fractal': 'milkdrop',
  'milkdrop-neon': 'milkdrop',
  'milkdrop-liquid': 'milkdrop',
});
const randomVisualSkins: readonly ConcreteOverlaySkin[] = Object.freeze([
  'tunnel',
  'particles',
  'spiral',
  'plasma',
  'kaleidoscope',
  'fractal',
  'fluid',
  'feedback',
  'milkdrop-spiral',
  'milkdrop-fractal',
  'milkdrop-neon',
  'milkdrop-liquid',
]);
const randomSkinMinDelayMs = 15_000;
const randomSkinMaxDelayMs = 45_000;
const audioBandCount = 64;
const audioGroupCount = 6;
const windowsCoverRefreshDelaysMs = [1000, 3500] as const;
const maxCoverBytes = 5 * 1024 * 1024;
const maxCoverBase64Length = Math.ceil(maxCoverBytes * 4 / 3);
const maxAudioSubscribers = 8;
const sammiRequestTimeoutMs = 4_000;
const securityHeaders = Object.freeze({
  'Content-Security-Policy': "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-DNS-Prefetch-Control': 'off',
});
const milkDropOverlayHeaders = Object.freeze({
  'Content-Security-Policy': securityHeaders['Content-Security-Policy'].replace(
    "script-src 'self'",
    "script-src 'self' 'unsafe-eval'",
  ),
});

export interface StartOverlayOptions {
  host?: string;
  port?: number;
  mediaAppFilter?: string;
  backendPath?: string;
  settingsPath?: string;
}

export interface OverlayService {
  host: string;
  port: number;
  url: string;
  state(): NowPlayingData;
  settings(): OverlaySettings;
  updateAudioLevels(value: unknown): boolean;
  setAudioCaptureError(error: unknown): void;
  onSettingsChanged(listener: (settings: OverlaySettings) => void): () => boolean;
  close(): Promise<void>;
}

interface AudioState extends AudioLevels {
  active: boolean;
  updatedAt: number;
  error: string;
}

interface ServiceState extends OverlaySettings {
  effectiveSkin: ConcreteOverlaySkin;
  visualizer: VisualizerMode;
  available: boolean;
  title: string;
  artist: string;
  album: string;
  playback: string;
  source: string;
  thumbnail: string;
  audio: AudioState;
  version: number;
  error: string;
}

type SettingsUpdate = Partial<OverlaySettings>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parsePort(raw: unknown, fallback: number): number {
  const value = typeof raw === 'number'
    ? raw
    : Number.parseInt(typeof raw === 'string' ? raw : '', 10);
  return Number.isInteger(value) && value > 0 && value < 65536 ? value : fallback;
}

function isLoopbackHost(host: string): boolean {
  return host === '127.0.0.1' || host === '::1' || host === 'localhost';
}

function localOrigin(host: string, port: number): string {
  const urlHost = host.includes(':') ? `[${host}]` : host;
  return `http://${urlHost}:${port}`;
}

function requestHeader(request: IncomingMessage, name: string): string {
  const value = request.headers[name];
  return typeof value === 'string' ? value : '';
}

function escapeXml(value: string): string {
  const entities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' };
  return value.replace(/[<>&'"]/g, (character) => entities[character] ?? character);
}

function normalizeSkin(value: unknown): OverlaySkin {
  return typeof value === 'string' && overlaySkins.has(value as OverlaySkin) ? value as OverlaySkin : defaultSettings.skin;
}

function chooseRandomVisualSkin(previous?: ConcreteOverlaySkin): ConcreteOverlaySkin {
  const choices = randomVisualSkins.filter((skin) => skin !== previous);
  return choices[Math.floor(Math.random() * choices.length)] ?? randomVisualSkins[0]!;
}

function normalizeNeonPalette(value: unknown): NeonPalette {
  return typeof value === 'string' && neonPalettes.has(value) ? value as NeonPalette : defaultSettings.neonPalette;
}

function normalizeSpectrumPalette(value: unknown): SpectrumPalette {
  return typeof value === 'string' && spectrumPalettes.has(value) ? value as SpectrumPalette : defaultSettings.spectrumPalette;
}

function normalizeLanguage(value: unknown): 'fr' | 'en' {
  return typeof value === 'string' && supportedLanguages.has(value) ? value as 'fr' | 'en' : defaultSettings.language;
}

function normalizeAudioOutputDeviceId(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 512) : defaultSettings.audioOutputDeviceId;
}

function normalizeAppTheme(value: unknown): AppTheme {
  return typeof value === 'string' && appThemes.has(value) ? value as AppTheme : defaultSettings.appTheme;
}

function normalizeSammiPassword(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 256) : defaultSettings.sammiPassword;
}

function normalizeSammiWebhookTrigger(value: unknown): string {
  if (typeof value !== 'string') return defaultSettings.sammiWebhookTrigger;
  return value.trim().slice(0, 100) || defaultSettings.sammiWebhookTrigger;
}

function normalizeSammiMessageTemplate(value: unknown): string {
  if (typeof value !== 'string') return defaultSettings.sammiMessageTemplate;
  return value.trim().slice(0, 500) || defaultSettings.sammiMessageTemplate;
}

function normalizeAudioLevels(value: unknown): AudioLevels | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<AudioLevels>;
  if (!Array.isArray(candidate.bands)) return null;

  const bands = Array.from({ length: audioBandCount }, (_, index) => {
    const level = Number(candidate.bands![index]);
    return Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
  });
  const groups = Array.from({ length: audioGroupCount }, (_, index) => {
    const group = Number(candidate.groups?.[index]);
    return Number.isFinite(group) ? Math.min(1, Math.max(0, group)) : 0;
  });
  const suppliedLevel = Number(candidate.level);
  const level = Number.isFinite(suppliedLevel)
    ? Math.min(1, Math.max(0, suppliedLevel))
    : bands.reduce((total, band) => total + band, 0) / bands.length;

  const waveform = typeof candidate.waveform === 'string' && candidate.waveform.length <= 2048
    && /^[A-Za-z0-9+/]*={0,2}$/.test(candidate.waveform) ? candidate.waveform : '';

  return { bands, groups, level, waveform };
}

async function loadSettings(settingsPath?: string): Promise<OverlaySettings> {
  if (!settingsPath) return { ...defaultSettings };
  try {
    const settings = JSON.parse(await readFile(settingsPath, 'utf8')) as SettingsUpdate;
    return {
      skin: normalizeSkin(settings.skin),
      neonPalette: normalizeNeonPalette(settings.neonPalette),
      spectrumPalette: normalizeSpectrumPalette(settings.spectrumPalette),
      audioOutputDeviceId: normalizeAudioOutputDeviceId(settings.audioOutputDeviceId),
      startHidden: typeof settings.startHidden === 'boolean' ? settings.startHidden : defaultSettings.startHidden,
      titleMarquee: typeof settings.titleMarquee === 'boolean' ? settings.titleMarquee : defaultSettings.titleMarquee,
      language: normalizeLanguage(settings.language),
      appTheme: normalizeAppTheme(settings.appTheme),
      sammiEnabled: typeof settings.sammiEnabled === 'boolean' ? settings.sammiEnabled : defaultSettings.sammiEnabled,
      sammiPort: parsePort(settings.sammiPort, defaultSettings.sammiPort),
      sammiPassword: normalizeSammiPassword(settings.sammiPassword),
      sammiWebhookTrigger: normalizeSammiWebhookTrigger(settings.sammiWebhookTrigger),
      sammiMessageTemplate: normalizeSammiMessageTemplate(settings.sammiMessageTemplate),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn(`Paramètres du visualiseur ignorés : ${errorMessage(error)}`);
    return { ...defaultSettings };
  }
}

function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2048) request.destroy(new Error('Requête trop volumineuse.'));
    });
    request.on('error', reject);
    request.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('JSON invalide.');
        resolve(payload as Record<string, unknown>);
      } catch {
        reject(new Error('JSON invalide.'));
      }
    });
  });
}

export async function startOverlayService({
  host = '127.0.0.1',
  port = parsePort(process.env.PORT, 38491),
  mediaAppFilter = (process.env.MEDIA_APP ?? 'deezer').trim().toLowerCase(),
  backendPath,
  settingsPath,
}: StartOverlayOptions = {}): Promise<OverlayService> {
  if (!isLoopbackHost(host)) throw new Error('Le service overlay ne peut écouter que sur la machine locale.');
  const servicePort = parsePort(port, 38491);
  const serviceOrigin = localOrigin(host, servicePort);
  const savedSettings = await loadSettings(settingsPath);
  const initialEffectiveSkin = savedSettings.skin === 'random'
    ? chooseRandomVisualSkin()
    : savedSettings.skin;
  const state: ServiceState = {
    available: false,
    title: '',
    artist: '',
    album: '',
    playback: 'stopped',
    source: '',
    thumbnail: '',
    visualizer: visualizerForSkin[initialEffectiveSkin],
    skin: savedSettings.skin,
    effectiveSkin: initialEffectiveSkin,
    neonPalette: savedSettings.neonPalette,
    spectrumPalette: savedSettings.spectrumPalette,
    audioOutputDeviceId: savedSettings.audioOutputDeviceId,
    startHidden: savedSettings.startHidden,
    titleMarquee: savedSettings.titleMarquee,
    language: savedSettings.language,
    appTheme: savedSettings.appTheme,
    sammiEnabled: savedSettings.sammiEnabled,
    sammiPort: savedSettings.sammiPort,
    sammiPassword: savedSettings.sammiPassword,
    sammiWebhookTrigger: savedSettings.sammiWebhookTrigger,
    sammiMessageTemplate: savedSettings.sammiMessageTemplate,
    audio: {
      active: false,
      bands: Array(audioBandCount).fill(0),
      groups: Array(audioGroupCount).fill(0),
      level: 0,
      waveform: '',
      updatedAt: 0,
      error: '',
    },
    version: 0,
    error: '',
  };

  const manager = createSessionManager(backendPath ? { backendPath } : undefined);
  const audioSubscribers = new Set<ServerResponse>();
  let stopListening = () => {};
  let isListening = false;
  let trackKey = '';
  let correctedCoverTrackKey = '';
  let correctedCoverThumbnail = '';
  let randomTrackKey = '';
  let sammiTrackKey = '';
  let mediaStateInitialized = false;
  let sammiDeliveryQueue = Promise.resolve();
  let randomSkinTimer: ReturnType<typeof setTimeout> | undefined;
  const pendingMetadataRefreshes = new Set<ReturnType<typeof setTimeout>>();
  const activeMetadataRefreshManagers = new Set<ReturnType<typeof createSessionManager>>();
  const settingsListeners = new Set<(settings: OverlaySettings) => void>();
  let closing = false;

  function formatSammiMessage(track: Pick<ServiceState, 'title' | 'artist' | 'album' | 'source'>): string {
    const values: Record<string, string> = {
      title: track.title,
      artist: track.artist,
      album: track.album,
      source: track.source,
    };
    return state.sammiMessageTemplate.replace(/\{(title|artist|album|source)\}/gi, (_match, name: string) => (
      values[name.toLowerCase()] ?? ''
    ));
  }

  async function sendSammiWebhook(
    track: Pick<ServiceState, 'title' | 'artist' | 'album' | 'source' | 'playback'>,
    test: boolean,
  ): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), sammiRequestTimeoutMs);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (state.sammiPassword) headers.Authorization = state.sammiPassword;
      const response = await fetch(`http://127.0.0.1:${state.sammiPort}/webhook`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          trigger: state.sammiWebhookTrigger,
          title: track.title,
          artist: track.artist,
          album: track.album,
          source: track.source,
          playback: track.playback,
          message: formatSammiMessage(track),
          test,
          sentAt: new Date().toISOString(),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = (await response.text()).trim().slice(0, 300);
        throw new Error(`SAMMI Core a répondu HTTP ${response.status}${detail ? ` : ${detail}` : ''}`);
      }
    } catch (error) {
      if (controller.signal.aborted) throw new Error('SAMMI Core ne répond pas dans le délai prévu.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function queueSammiTrackChange(track: Pick<ServiceState, 'title' | 'artist' | 'album' | 'source' | 'playback'>): void {
    sammiDeliveryQueue = sammiDeliveryQueue
      .catch(() => undefined)
      .then(() => sendSammiWebhook(track, false))
      .catch((error) => console.warn(`Webhook SAMMI ignoré : ${errorMessage(error)}`));
  }

  function applyRandomVisualSkin(): void {
    state.effectiveSkin = chooseRandomVisualSkin(state.effectiveSkin);
    state.visualizer = visualizerForSkin[state.effectiveSkin];
  }

  function clearRandomSkinTimer(): void {
    if (randomSkinTimer) clearTimeout(randomSkinTimer);
    randomSkinTimer = undefined;
  }

  function syncRandomSkinTimer(restart = false): void {
    const eligible = state.skin === 'random' && state.available && state.playback === 'playing';
    if (restart || !eligible) clearRandomSkinTimer();
    if (!eligible || randomSkinTimer) return;

    const delay = randomSkinMinDelayMs
      + Math.floor(Math.random() * (randomSkinMaxDelayMs - randomSkinMinDelayMs + 1));
    randomSkinTimer = setTimeout(() => {
      randomSkinTimer = undefined;
      if (state.skin !== 'random' || !state.available || state.playback !== 'playing') return;
      applyRandomVisualSkin();
      syncRandomSkinTimer();
    }, delay);
  }

  async function reloadWindowsMetadata(expectedTrackKey: string): Promise<void> {
    if (closing || trackKey !== expectedTrackKey) return;
    // Le backend 1.0.3 mémorise parfois l'ancienne miniature avec le nouveau
    // titre. Une instance éphémère repart avec un cache vide et relit donc le
    // flux de pochette directement depuis la session Windows.
    const refreshManager = createSessionManager(backendPath ? { backendPath } : undefined);
    activeMetadataRefreshManagers.add(refreshManager);
    try {
      const sessions = await refreshManager.getAllSessions();
      if (!closing && trackKey === expectedTrackKey) updateState(sessions, 'fresh');
    } catch (error) {
      if (!closing) console.warn(`Actualisation de la pochette Windows ignorée : ${errorMessage(error)}`);
    } finally {
      if (activeMetadataRefreshManagers.delete(refreshManager)) await refreshManager.stop();
    }
  }

  function refreshWindowsMetadataAfterTrackChange(expectedTrackKey: string, staleThumbnail: string): void {
    for (const delay of windowsCoverRefreshDelaysMs) {
      const timer = setTimeout(() => {
        pendingMetadataRefreshes.delete(timer);
        if (trackKey === expectedTrackKey && state.thumbnail === staleThumbnail) {
          void reloadWindowsMetadata(expectedTrackKey);
        }
      }, delay);
      pendingMetadataRefreshes.add(timer);
    }
  }

  function matchesConfiguredApp(session: import('windows-media-sessions').MediaSession): boolean {
    const appId = String(session.sourceAppUserModelId ?? '').toLowerCase();
    const appName = String(session.sourceAppDisplayName ?? '').toLowerCase();
    return appId.includes(mediaAppFilter) || appName.includes(mediaAppFilter);
  }

  function chooseSession(sessions: import('windows-media-sessions').MediaSession[]) {
    const candidates = sessions.filter(matchesConfiguredApp);
    const playing = sessions.filter((session) => session.playbackStatus === 'playing');

    // Deezer joué dans un navigateur est souvent publié par Windows sous le nom
    // du navigateur. On privilégie toujours Deezer, mais une session en lecture
    // reste un meilleur résultat que l’absence totale de morceau.
    return candidates.find((session) => session.playbackStatus === 'playing')
      ?? candidates[0]
      ?? playing.find((session) => Boolean(session.title || session.artist))
      ?? playing[0]
      ?? null;
  }

  function updateState(
    sessions: import('windows-media-sessions').MediaSession[],
    metadataSource: 'primary' | 'fresh' = 'primary',
  ): void {
    const session = chooseSession(sessions);
    const next = session
      ? {
          available: Boolean(session.title || session.artist),
          title: session.title ?? '',
          artist: session.artist ?? '',
          album: session.albumTitle ?? '',
          playback: session.playbackStatus,
          source: session.sourceAppDisplayName || session.sourceAppUserModelId || 'Deezer',
          thumbnail: session.thumbnail ?? '',
          error: '',
        }
      : {
          available: false,
          title: '',
          artist: '',
          album: '',
          playback: 'stopped',
          source: '',
          thumbnail: '',
          error: '',
        };

    const nextTrackKey = [next.source, next.title, next.artist, next.album].join('\u001f');
    const trackChanged = nextTrackKey !== trackKey;
    const nextRandomTrackKey = [next.source, next.title, next.artist].join('\u001f');
    if (trackChanged) {
      const hadPreviousTrack = Boolean(trackKey && state.available);
      trackKey = nextTrackKey;
      correctedCoverTrackKey = '';
      correctedCoverThumbnail = '';
      if (hadPreviousTrack && next.available && (!next.thumbnail || next.thumbnail === state.thumbnail)) {
        refreshWindowsMetadataAfterTrackChange(nextTrackKey, next.thumbnail);
      }
    }
    if (metadataSource === 'fresh' && nextTrackKey === trackKey && next.thumbnail) {
      correctedCoverTrackKey = nextTrackKey;
      correctedCoverThumbnail = next.thumbnail;
    } else if (metadataSource === 'primary' && correctedCoverTrackKey === nextTrackKey) {
      next.thumbnail = correctedCoverThumbnail;
    }

    const changed = (['available', 'title', 'artist', 'album', 'playback', 'source', 'thumbnail'] as const)
      .some((key) => state[key] !== next[key]);
    Object.assign(state, next);
    const nextSammiTrackKey = next.available ? [next.title, next.artist].join('\u001f') : sammiTrackKey;
    if (!mediaStateInitialized) {
      mediaStateInitialized = true;
      sammiTrackKey = nextSammiTrackKey;
    } else if (next.available && nextSammiTrackKey !== sammiTrackKey) {
      sammiTrackKey = nextSammiTrackKey;
      if (state.sammiEnabled) {
        queueSammiTrackChange({
          title: next.title,
          artist: next.artist,
          album: next.album,
          source: next.source,
          playback: next.playback ?? 'stopped',
        });
      }
    }
    if (state.skin !== 'random' || !state.available) {
      randomTrackKey = '';
      syncRandomSkinTimer();
    } else if (nextRandomTrackKey !== randomTrackKey) {
      randomTrackKey = nextRandomTrackKey;
      applyRandomVisualSkin();
      syncRandomSkinTimer(true);
    } else {
      syncRandomSkinTimer();
    }
    if (changed) state.version += 1;
  }

  function stateForClient(): NowPlayingData {
    return {
      available: state.available,
      title: state.title,
      artist: state.artist,
      album: state.album,
      playback: state.playback,
      source: state.source,
      error: state.error || undefined,
      version: state.version,
      visualizer: state.visualizer,
      skin: state.effectiveSkin,
      neonPalette: state.neonPalette,
      spectrumPalette: state.spectrumPalette,
      titleMarquee: state.titleMarquee,
      language: state.language,
      coverUrl: `/cover/${state.version}`,
    };
  }

  function settingsForClient(): OverlaySettings {
    return {
      skin: state.skin,
      neonPalette: state.neonPalette,
      spectrumPalette: state.spectrumPalette,
      audioOutputDeviceId: state.audioOutputDeviceId,
      startHidden: state.startHidden,
      titleMarquee: state.titleMarquee,
      language: state.language,
      appTheme: state.appTheme,
      sammiEnabled: state.sammiEnabled,
      sammiPort: state.sammiPort,
      sammiPassword: state.sammiPassword,
      sammiWebhookTrigger: state.sammiWebhookTrigger,
      sammiMessageTemplate: state.sammiMessageTemplate,
    };
  }

  function audioForClient() {
    return {
      active: state.audio.active,
      bands: state.audio.bands,
      groups: state.audio.groups,
      level: state.audio.level,
      waveform: state.audio.waveform,
      updatedAt: state.audio.updatedAt,
      error: state.audio.error || undefined,
    };
  }

  async function saveSettings() {
    if (!settingsPath) return;
    await writeFile(settingsPath, `${JSON.stringify(settingsForClient(), null, 2)}\n`, 'utf8');
  }

  function notifySettingsChanged() {
    const settings = settingsForClient();
    settingsListeners.forEach((listener) => {
      try {
        listener(settings);
      } catch (error) {
        console.warn(`Écouteur de paramètres ignoré : ${errorMessage(error)}`);
      }
    });
  }

  function notifyAudioSubscribers(): void {
    const message = `event: levels\ndata: ${JSON.stringify(audioForClient())}\n\n`;
    for (const response of audioSubscribers) response.write(message);
  }

  function updateAudioLevels(value: unknown): boolean {
    const levels = normalizeAudioLevels(value);
    if (!levels) return false;

    Object.assign(state.audio, levels, {
      active: true,
      updatedAt: Date.now(),
      error: '',
    });
    notifyAudioSubscribers();
    return true;
  }

  function setAudioCaptureError(error: unknown): void {
    state.audio.active = false;
    state.audio.error = String(error || 'La capture audio a été interrompue.').slice(0, 300);
    state.audio.bands = Array(audioBandCount).fill(0);
    state.audio.groups = Array(audioGroupCount).fill(0);
    state.audio.level = 0;
    state.audio.waveform = '';
    state.audio.updatedAt = Date.now();
    notifyAudioSubscribers();
  }

  function svgPlaceholder(): string {
    const initial = (state.title || state.artist || '♫').trim().slice(0, 1).toUpperCase();
    const safeInitial = escapeXml(initial);
    const safeArtist = escapeXml((state.artist || 'Deezer').slice(0, 35));
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#9d4edd"/><stop offset="1" stop-color="#2d1157"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <circle cx="256" cy="235" r="124" fill="#ffffff" fill-opacity=".14"/>
  <text x="256" y="278" fill="white" font-family="Segoe UI, sans-serif" font-size="180" font-weight="700" text-anchor="middle">${safeInitial}</text>
  <text x="256" y="420" fill="white" fill-opacity=".75" font-family="Segoe UI, sans-serif" font-size="28" text-anchor="middle">${safeArtist}</text>
</svg>`;
  }

  function send(
    response: ServerResponse,
    status: number,
    type: string,
    body: string | Buffer,
    headers: Record<string, string> = {},
  ): void {
    response.writeHead(status, {
      'Cache-Control': 'no-store',
      'Content-Type': type,
      ...securityHeaders,
      ...headers,
    });
    response.end(body);
  }

  function sendCover(response: ServerResponse): void {
    const match = /^data:(image\/(?:avif|jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(state.thumbnail);
    if (match && match[2]!.length <= maxCoverBase64Length) {
      send(response, 200, match[1]!, Buffer.from(match[2]!, 'base64'));
      return;
    }
    send(response, 200, 'image/svg+xml; charset=utf-8', svgPlaceholder());
  }

  async function sendStatic(
    response: ServerResponse,
    name: string,
    type: string,
    headers: Record<string, string> = {},
  ): Promise<void> {
    try {
      send(response, 200, type, await readFile(join(publicDirectory, name)), headers);
    } catch (error) {
      console.error(`Impossible de charger ${name}:`, errorMessage(error));
      send(response, 500, 'text/plain; charset=utf-8', 'Erreur interne.');
    }
  }

  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    let url: URL;
    try {
      url = new URL(request.url ?? '/', serviceOrigin);
    } catch {
      send(response, 400, 'text/plain; charset=utf-8', 'URL invalide.');
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/settings') {
      const origin = requestHeader(request, 'origin');
      const contentType = requestHeader(request, 'content-type').split(';', 1)[0]?.trim().toLowerCase();
      if ((origin && origin !== serviceOrigin) || contentType !== 'application/json') {
        send(response, 403, 'text/plain; charset=utf-8', 'Origine ou type de requête non autorisé.');
        return;
      }
      try {
        const payload = await readJsonBody(request) as SettingsUpdate;
        const updatesStartHidden = Object.hasOwn(payload, 'startHidden');
        const updatesTitleMarquee = Object.hasOwn(payload, 'titleMarquee');
        const updatesLanguage = Object.hasOwn(payload, 'language');
        const updatesAppTheme = Object.hasOwn(payload, 'appTheme');
        const updatesSkin = Object.hasOwn(payload, 'skin');
        const updatesNeonPalette = Object.hasOwn(payload, 'neonPalette');
        const updatesSpectrumPalette = Object.hasOwn(payload, 'spectrumPalette');
        const updatesAudioOutputDeviceId = Object.hasOwn(payload, 'audioOutputDeviceId');
        const updatesSammiEnabled = Object.hasOwn(payload, 'sammiEnabled');
        const updatesSammiPort = Object.hasOwn(payload, 'sammiPort');
        const updatesSammiPassword = Object.hasOwn(payload, 'sammiPassword');
        const updatesSammiWebhookTrigger = Object.hasOwn(payload, 'sammiWebhookTrigger');
        const updatesSammiMessageTemplate = Object.hasOwn(payload, 'sammiMessageTemplate');
        if (!updatesStartHidden && !updatesTitleMarquee && !updatesLanguage && !updatesAppTheme && !updatesSkin && !updatesNeonPalette && !updatesSpectrumPalette && !updatesAudioOutputDeviceId && !updatesSammiEnabled && !updatesSammiPort && !updatesSammiPassword && !updatesSammiWebhookTrigger && !updatesSammiMessageTemplate) throw new Error('Aucun paramètre à enregistrer.');
        if (updatesStartHidden && typeof payload.startHidden !== 'boolean') throw new Error('Valeur de démarrage invalide.');
        if (updatesTitleMarquee && typeof payload.titleMarquee !== 'boolean') throw new Error('Valeur de défilement invalide.');
        if (updatesLanguage && (typeof payload.language !== 'string' || !supportedLanguages.has(payload.language))) throw new Error('Langue non prise en charge.');
        if (updatesAppTheme && (typeof payload.appTheme !== 'string' || !appThemes.has(payload.appTheme))) throw new Error('Thème d’application inconnu.');
        if (updatesSkin && (typeof payload.skin !== 'string' || !overlaySkins.has(payload.skin))) throw new Error('Style d’overlay inconnu.');
        if (updatesNeonPalette && (typeof payload.neonPalette !== 'string' || !neonPalettes.has(payload.neonPalette))) throw new Error('Palette néon inconnue.');
        if (updatesSpectrumPalette && (typeof payload.spectrumPalette !== 'string' || !spectrumPalettes.has(payload.spectrumPalette))) throw new Error('Palette Spectrum inconnue.');
        if (updatesAudioOutputDeviceId && (typeof payload.audioOutputDeviceId !== 'string' || payload.audioOutputDeviceId.length > 512)) throw new Error('Périphérique audio invalide.');
        if (updatesSammiEnabled && typeof payload.sammiEnabled !== 'boolean') throw new Error('Activation SAMMI invalide.');
        if (updatesSammiPort && (!Number.isInteger(payload.sammiPort) || Number(payload.sammiPort) < 1 || Number(payload.sammiPort) > 65535)) throw new Error('Port SAMMI invalide.');
        if (updatesSammiPassword && (typeof payload.sammiPassword !== 'string' || payload.sammiPassword.length > 256)) throw new Error('Mot de passe SAMMI invalide.');
        if (updatesSammiWebhookTrigger && (typeof payload.sammiWebhookTrigger !== 'string' || !payload.sammiWebhookTrigger.trim() || payload.sammiWebhookTrigger.length > 100)) throw new Error('Nom du webhook SAMMI invalide.');
        if (updatesSammiMessageTemplate && (typeof payload.sammiMessageTemplate !== 'string' || !payload.sammiMessageTemplate.trim() || payload.sammiMessageTemplate.length > 500)) throw new Error('Modèle de message SAMMI invalide.');
        if (typeof payload.startHidden === 'boolean') state.startHidden = payload.startHidden;
        if (typeof payload.titleMarquee === 'boolean') state.titleMarquee = payload.titleMarquee;
        if (typeof payload.language === 'string') state.language = payload.language as OverlaySettings['language'];
        if (typeof payload.appTheme === 'string') state.appTheme = payload.appTheme as AppTheme;
        if (typeof payload.neonPalette === 'string') state.neonPalette = payload.neonPalette as NeonPalette;
        if (typeof payload.spectrumPalette === 'string') state.spectrumPalette = payload.spectrumPalette as SpectrumPalette;
        if (typeof payload.audioOutputDeviceId === 'string') state.audioOutputDeviceId = normalizeAudioOutputDeviceId(payload.audioOutputDeviceId);
        if (typeof payload.sammiEnabled === 'boolean') state.sammiEnabled = payload.sammiEnabled;
        if (typeof payload.sammiPort === 'number') state.sammiPort = parsePort(payload.sammiPort, defaultSettings.sammiPort);
        if (typeof payload.sammiPassword === 'string') state.sammiPassword = normalizeSammiPassword(payload.sammiPassword);
        if (typeof payload.sammiWebhookTrigger === 'string') state.sammiWebhookTrigger = normalizeSammiWebhookTrigger(payload.sammiWebhookTrigger);
        if (typeof payload.sammiMessageTemplate === 'string') state.sammiMessageTemplate = normalizeSammiMessageTemplate(payload.sammiMessageTemplate);
        if (typeof payload.skin === 'string') {
          state.skin = payload.skin as OverlaySkin;
          if (state.skin === 'random') applyRandomVisualSkin();
          else {
            state.effectiveSkin = state.skin;
            state.visualizer = visualizerForSkin[state.effectiveSkin];
          }
          randomTrackKey = state.skin === 'random' && state.available
            ? [state.source, state.title, state.artist].join('\u001f')
            : '';
          syncRandomSkinTimer(true);
        }
        await saveSettings();
        notifySettingsChanged();
        send(response, 200, 'application/json; charset=utf-8', JSON.stringify(settingsForClient()));
      } catch (error) {
        send(response, 400, 'application/json; charset=utf-8', JSON.stringify({ error: errorMessage(error) }));
      }
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/sammi/test') {
      const origin = requestHeader(request, 'origin');
      const contentType = requestHeader(request, 'content-type').split(';', 1)[0]?.trim().toLowerCase();
      if ((origin && origin !== serviceOrigin) || contentType !== 'application/json') {
        send(response, 403, 'text/plain; charset=utf-8', 'Origine ou type de requête non autorisé.');
        return;
      }
      try {
        await readJsonBody(request);
        const testTrack = state.available
          ? { title: state.title, artist: state.artist, album: state.album, source: state.source, playback: state.playback }
          : { title: 'Titre de test', artist: 'What I Listen', album: 'Test SAMMI', source: 'Deezer', playback: 'playing' };
        await sendSammiWebhook(testTrack, true);
        send(response, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: true }));
      } catch (error) {
        send(response, 502, 'application/json; charset=utf-8', JSON.stringify({ error: errorMessage(error) }));
      }
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/audio-stream') {
      if (audioSubscribers.size >= maxAudioSubscribers) {
        send(response, 503, 'text/plain; charset=utf-8', 'Trop de flux audio ouverts.');
        return;
      }
      response.writeHead(200, {
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream; charset=utf-8',
        ...securityHeaders,
      });
      response.write(`retry: 2000\nevent: levels\ndata: ${JSON.stringify(audioForClient())}\n\n`);
      audioSubscribers.add(response);
      request.on('close', () => audioSubscribers.delete(response));
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      send(response, 405, 'text/plain; charset=utf-8', 'Méthode non autorisée.');
      return;
    }
    if (request.method === 'HEAD') {
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        ...securityHeaders,
      });
      response.end();
      return;
    }

    switch (url.pathname) {
      case '/':
      case '/index.html':
        await sendStatic(response, 'index.html', 'text/html; charset=utf-8', milkDropOverlayHeaders);
        break;
      case '/overlay.css':
        await sendStatic(response, 'overlay.css', 'text/css; charset=utf-8');
        break;
      case '/overlay.js':
        await sendStatic(response, 'overlay.js', 'text/javascript; charset=utf-8');
        break;
      case '/app':
      case '/app.html':
        await sendStatic(response, 'app.html', 'text/html; charset=utf-8');
        break;
      case '/app.css':
        await sendStatic(response, 'app.css', 'text/css; charset=utf-8');
        break;
      case '/app-icon.svg':
        await sendStatic(response, 'app-icon.svg', 'image/svg+xml');
        break;
      case '/app.js':
        await sendStatic(response, 'app.js', 'text/javascript; charset=utf-8');
        break;
      case '/i18n.js':
        await sendStatic(response, 'i18n.js', 'text/javascript; charset=utf-8');
        break;
      case '/shell.js':
        await sendStatic(response, 'shell.js', 'text/javascript; charset=utf-8');
        break;
      case '/settings':
      case '/settings.html':
        await sendStatic(response, 'settings.html', 'text/html; charset=utf-8');
        break;
      case '/settings.css':
        await sendStatic(response, 'settings.css', 'text/css; charset=utf-8');
        break;
      case '/settings.js':
        await sendStatic(response, 'settings.js', 'text/javascript; charset=utf-8');
        break;
      case '/changelog':
      case '/changelog.html':
        await sendStatic(response, 'changelog.html', 'text/html; charset=utf-8');
        break;
      case '/changelog.css':
        await sendStatic(response, 'changelog.css', 'text/css; charset=utf-8');
        break;
      case '/changelog.js':
        await sendStatic(response, 'changelog.js', 'text/javascript; charset=utf-8');
        break;
      case '/styles':
      case '/styles.html':
        await sendStatic(response, 'styles.html', 'text/html; charset=utf-8');
        break;
      case '/styles.css':
        await sendStatic(response, 'styles.css', 'text/css; charset=utf-8');
        break;
      case '/styles.js':
        await sendStatic(response, 'styles.js', 'text/javascript; charset=utf-8');
        break;
      case '/api/now-playing':
        send(response, 200, 'application/json; charset=utf-8', JSON.stringify(stateForClient()));
        break;
      case '/api/health':
        send(response, 200, 'application/json; charset=utf-8', JSON.stringify({
          ok: !state.error,
          sourceFilter: mediaAppFilter,
          error: state.error || undefined,
        }));
        break;
      case '/api/settings':
        send(response, 200, 'application/json; charset=utf-8', JSON.stringify(settingsForClient()));
        break;
      case '/api/audio':
        send(response, 200, 'application/json; charset=utf-8', JSON.stringify(audioForClient()));
        break;
      default:
        if (url.pathname === '/cover' || /^\/cover\/\d+$/.test(url.pathname)) {
          sendCover(response);
        } else {
          send(response, 404, 'text/plain; charset=utf-8', 'Introuvable.');
        }
    }
  });

  manager.on('error', (error) => {
    state.error = errorMessage(error);
    console.error(`Windows Media Sessions : ${errorMessage(error)}`);
  });
  manager.on('diagnostic', (error) => console.warn(`Windows Media Sessions : ${errorMessage(error)}`));
  stopListening = manager.onSessionsChanged(updateState);
  manager.getAllSessions().then(updateState).catch((error) => {
    state.error ||= errorMessage(error);
    console.error(`Initialisation Windows Media Sessions impossible : ${errorMessage(error)}`);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(servicePort, host, () => {
      server.off('error', reject);
      isListening = true;
      resolve();
    });
  });

  return {
    host,
    port: servicePort,
    url: `${serviceOrigin}/`,
    state: stateForClient,
    settings: settingsForClient,
    updateAudioLevels,
    setAudioCaptureError,
    onSettingsChanged(listener: (settings: OverlaySettings) => void) {
      settingsListeners.add(listener);
      return () => settingsListeners.delete(listener);
    },
    async close() {
      closing = true;
      stopListening();
      clearRandomSkinTimer();
      for (const timer of pendingMetadataRefreshes) clearTimeout(timer);
      pendingMetadataRefreshes.clear();
      const refreshManagers = [...activeMetadataRefreshManagers];
      activeMetadataRefreshManagers.clear();
      await Promise.allSettled(refreshManagers.map((refreshManager) => refreshManager.stop()));
      for (const response of audioSubscribers) response.end();
      audioSubscribers.clear();
      if (isListening) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        isListening = false;
      }
      await manager.stop();
    },
  };
}
