interface AudioLevels {
  bands: number[];
  groups: number[];
  level: number;
  waveform: string;
}

interface AudioOutputDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

interface AppRelease {
  version: string;
  title: string;
  publishedAt: string;
  notes: string;
  isCurrent: boolean;
  canInstall: boolean;
}

interface AppUpdateInfo {
  currentVersion: string;
  releases: AppRelease[];
  updateAvailable: boolean;
}

type AutomaticUpdateStatus = 'available' | 'downloading' | 'downloaded' | 'error';

interface AutomaticUpdateState {
  status: AutomaticUpdateStatus;
  currentVersion: string;
  version: string;
  language: 'fr' | 'en';
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
  error?: string;
}

type VisualizerMode = 'bars' | 'spectrum' | 'ripple' | 'pulse' | 'battery' | 'meter' | 'oscilloscope' | 'tunnel' | 'particles' | 'spiral' | 'plasma' | 'kaleidoscope' | 'fractal' | 'fluid' | 'feedback' | 'milkdrop';
type OverlaySkin = 'random' | 'luna' | 'winamp' | 'glass' | 'aura' | 'neon' | 'spectrum' | 'battery' | 'meter' | 'oscilloscope' | 'tunnel' | 'particles' | 'spiral' | 'plasma' | 'kaleidoscope' | 'fractal' | 'fluid' | 'feedback' | 'milkdrop-spiral' | 'milkdrop-fractal' | 'milkdrop-neon' | 'milkdrop-liquid';
type ConcreteOverlaySkin = Exclude<OverlaySkin, 'random'>;
type NeonPalette = 'violet-cyan' | 'sunset' | 'laser';
type SpectrumPalette = 'modern' | 'ocean-mist' | 'fire-storm' | 'scope';
type AppTheme = 'dark' | 'light';

interface OverlaySettings {
  skin: OverlaySkin;
  neonPalette: NeonPalette;
  spectrumPalette: SpectrumPalette;
  audioOutputDeviceId: string;
  startHidden: boolean;
  titleMarquee: boolean;
  language: 'fr' | 'en';
  appTheme: AppTheme;
}

interface NowPlayingData {
  available: boolean;
  title: string;
  artist: string;
  album: string;
  playback: string;
  source: string;
  version: number;
  coverUrl: string;
  visualizer: VisualizerMode;
  skin: ConcreteOverlaySkin;
  neonPalette: NeonPalette;
  spectrumPalette: SpectrumPalette;
  titleMarquee: boolean;
  language: 'fr' | 'en';
  error?: string;
}

interface I18nApi {
  readonly language: 'fr' | 'en';
  readonly languages: readonly ('fr' | 'en')[];
  ready: Promise<void> | null;
  t(key: string): string;
  apply(root?: Document | HTMLElement): void;
  setLanguage(language: string): boolean;
}

interface Window {
  i18n: I18nApi;
  whatIListen?: {
    openPreview(): Promise<void>;
    listAudioOutputs(): Promise<AudioOutputDevice[]>;
    getAppVersion(): Promise<string>;
    getUpdateInfo(forceRefresh?: boolean): Promise<AppUpdateInfo>;
    installRelease(version: string): Promise<void>;
    openChangelog(): Promise<void>;
    getAutomaticUpdateState(): Promise<AutomaticUpdateState | null>;
    downloadAutomaticUpdate(): Promise<void>;
    restartAndInstallUpdate(): Promise<void>;
    closeUpdateWindow(): Promise<void>;
    onAutomaticUpdateState(listener: (state: AutomaticUpdateState) => void): () => void;
  };
}

declare module 'windows-media-sessions' {
  interface MediaSession {
    albumTitle?: string;
    playbackStatus?: string;
    sourceAppDisplayName?: string;
    sourceAppUserModelId?: string;
    thumbnail?: string;
    title?: string;
    artist?: string;
  }

  interface SessionManager {
    getAllSessions(): Promise<MediaSession[]>;
    onSessionsChanged(listener: (sessions: MediaSession[]) => void): () => void;
    on(event: 'error' | 'diagnostic', listener: (error: Error) => void): void;
    stop(): Promise<void>;
  }

  export function createSessionManager(options?: { backendPath?: string }): SessionManager;
}

declare module 'butterchurn' {
  interface ButterchurnAudioFrame {
    timeByteArray: Uint8Array;
    timeByteArrayL: Uint8Array;
    timeByteArrayR: Uint8Array;
  }

  interface ButterchurnVisualizer {
    loadPreset(preset: unknown, blendTime?: number): Promise<void> | void;
    loseGLContext(): void;
    render(options?: { audioLevels?: ButterchurnAudioFrame; elapsedTime?: number }): unknown;
    setRendererSize(width: number, height: number, options?: Record<string, number | boolean>): void;
  }

  const butterchurn: {
    createVisualizer(audioContext: BaseAudioContext | null, canvas: HTMLCanvasElement, options: Record<string, number | boolean>): ButterchurnVisualizer;
  };
  export default butterchurn;
}

declare module 'butterchurn-presets' {
  const presets: { getPresets(): Record<string, unknown> };
  export default presets;
}
