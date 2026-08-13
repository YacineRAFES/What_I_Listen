import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, net, Tray, type BrowserWindow as ElectronBrowserWindow, type Tray as ElectronTray } from 'electron';
import electronUpdater from 'electron-updater';
import { spawn, type ChildProcess } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startOverlayService, type OverlayService } from './src/overlay-service.js';

const { autoUpdater } = electronUpdater;

const projectDirectory = dirname(fileURLToPath(import.meta.url));
const preloadPath = join(projectDirectory, 'preload.cjs');
const appIconPath = join(projectDirectory, 'public', 'app-icon.ico');
const appUserModelId = 'fr.whatilisten.deezer';
const githubRepository = 'YacineRAFES/What_I_Listen';
const githubReleasesUrl = `https://api.github.com/repos/${githubRepository}/releases`;

let mainWindow: ElectronBrowserWindow | null = null;
let previewWindow: ElectronBrowserWindow | null = null;
let changelogWindow: ElectronBrowserWindow | null = null;
let updateWindow: ElectronBrowserWindow | null = null;
let nativeAudioCapture: ChildProcess | null = null;
let overlayService: OverlayService | null = null;
let tray: ElectronTray | null = null;
let isQuitting = false;
let audioCaptureRestart: Promise<void> | null = null;
let automaticUpdateState: AutomaticUpdateState | null = null;
let updateDownloadPromise: Promise<void> | null = null;

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const RELEASE_CACHE_MS = 5 * 60 * 1000;
const MAX_INSTALLER_BYTES = 512 * 1024 * 1024;

interface ReleaseAsset {
  name: string;
  downloadUrl: string;
}

interface CachedRelease {
  version: string;
  title: string;
  publishedAt: string;
  notes: string;
  assets: ReleaseAsset[];
}

let releasesCache: { releases: CachedRelease[]; updatedAt: number } | null = null;

interface AudioOutputDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

type AutomaticUpdateStatus = 'available' | 'downloading' | 'downloaded' | 'error';

interface AutomaticUpdateState {
  status: AutomaticUpdateStatus;
  currentVersion: string;
  version: string;
  language: OverlaySettings['language'];
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
  error?: string;
}

const nativeTranslations = {
  fr: {
    windowTitle: 'What I Listen — Deezer',
    show: 'Afficher What I Listen',
    preview: 'Ouvrir l’aperçu en direct',
    quit: 'Quitter',
    updateWindowTitle: 'Mise à jour — What I Listen',
  },
  en: {
    windowTitle: 'What I Listen — Deezer',
    show: 'Show What I Listen',
    preview: 'Open live preview',
    quit: 'Quit',
    updateWindowTitle: 'Update — What I Listen',
  },
};

function nativeText(key: keyof typeof nativeTranslations.fr, language: OverlaySettings['language'] = 'fr'): string {
  return (nativeTranslations[language] ?? nativeTranslations.fr)[key];
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Windows uses the AppUserModelID to associate this process with its taskbar icon.
app.setAppUserModelId(appUserModelId);

function lockWindowToOverlay(window: ElectronBrowserWindow, serviceUrl: string): void {
  const allowedOrigin = new URL(serviceUrl).origin;
  const blockExternalNavigation = (event: Electron.Event, targetUrl: string) => {
    try {
      if (new URL(targetUrl).origin !== allowedOrigin) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  };

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', blockExternalNavigation);
  window.webContents.on('will-redirect', blockExternalNavigation);
}

function showMainWindow() {
  if (!mainWindow) return createWindow({ showOnReady: true });
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  return Promise.resolve();
}

function createWindow({ showOnReady = false }: { showOnReady?: boolean } = {}) {
  const window = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 960,
    minHeight: 680,
    show: false,
    movable: true,
    resizable: true,
    thickFrame: true,
    title: 'What I Listen — Deezer',
    icon: nativeImage.createFromPath(appIconPath),
    backgroundColor: '#07111e',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#07111e',
      symbolColor: '#dbeafe',
      height: 54,
    },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  });
  window.setMenuBarVisibility(false);
  mainWindow = window;

  window.once('ready-to-show', () => {
    if (showOnReady) window.show();
  });
  window.on('closed', () => { mainWindow = null; });
  const service = overlayService;
  if (!service) throw new Error('Le service local n’est pas encore prêt.');
  lockWindowToOverlay(window, service.url);
  return window.loadURL(`${service.url}app`);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function releaseVersion(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const version = value.trim().replace(/^v/i, '');
  return /^\d+(?:\.\d+){1,3}(?:-[0-9A-Za-z.-]+)?$/.test(version) ? version : null;
}

function installerName(version: string): string {
  return `What-I-Listen-Setup-${version}.exe`;
}

function isTrustedReleaseAssetUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'github.com'
      && url.pathname.startsWith(`/${githubRepository}/releases/download/`);
  } catch {
    return false;
  }
}

function parseRelease(value: unknown): CachedRelease | null {
  const release = asRecord(value);
  if (!release || release.draft === true || release.prerelease === true) return null;
  const version = releaseVersion(release.tag_name);
  if (!version) return null;

  const assets = Array.isArray(release.assets) ? release.assets.flatMap((value) => {
    const asset = asRecord(value);
    const name = typeof asset?.name === 'string' ? asset.name : '';
    const downloadUrl = typeof asset?.browser_download_url === 'string' ? asset.browser_download_url : '';
    return name && isTrustedReleaseAssetUrl(downloadUrl) ? [{ name, downloadUrl }] : [];
  }) : [];

  return {
    version,
    title: typeof release.name === 'string' && release.name.trim() ? release.name.trim() : `v${version}`,
    publishedAt: typeof release.published_at === 'string' ? release.published_at : '',
    notes: typeof release.body === 'string' ? release.body : '',
    assets,
  };
}

async function availableReleases(forceRefresh = false): Promise<CachedRelease[]> {
  if (!forceRefresh && releasesCache && Date.now() - releasesCache.updatedAt < RELEASE_CACHE_MS) return releasesCache.releases;

  const response = await net.fetch(githubReleasesUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'What-I-Listen',
    },
  });
  if (!response.ok) throw new Error(`GitHub Releases indisponible (HTTP ${response.status}).`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error('Réponse GitHub Releases invalide.');

  const releases = payload.map(parseRelease).filter((release): release is CachedRelease => release !== null);
  releasesCache = { releases, updatedAt: Date.now() };
  return releases;
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(/[.-]/).map((part) => Number.parseInt(part, 10));
  const rightParts = right.split(/[.-]/).map((part) => Number.parseInt(part, 10));
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference) return difference;
  }
  return 0;
}

function releaseForClient(release: CachedRelease): AppRelease {
  const currentVersion = app.getVersion();
  return {
    version: release.version,
    title: release.title,
    publishedAt: release.publishedAt,
    notes: release.notes,
    isCurrent: release.version === currentVersion,
    canInstall: release.assets.some((asset) => asset.name === installerName(release.version)),
  };
}

async function getUpdateInfo(forceRefresh = false): Promise<AppUpdateInfo> {
  const releases = await availableReleases(forceRefresh);
  const currentVersion = app.getVersion();
  const clientReleases = releases.map(releaseForClient);
  return {
    currentVersion,
    releases: clientReleases,
    updateAvailable: clientReleases.some((release) => compareVersions(release.version, currentVersion) > 0),
  };
}

async function installRelease(versionValue: unknown): Promise<void> {
  const version = releaseVersion(versionValue);
  if (!version) throw new Error('Version de mise à jour invalide.');
  const releases = await availableReleases();
  const release = releases.find((candidate) => candidate.version === version);
  const asset = release?.assets.find((candidate) => candidate.name === installerName(version));
  if (!asset) throw new Error(`L’installeur de la version ${version} est introuvable.`);

  const response = await net.fetch(asset.downloadUrl);
  if (!response.ok) throw new Error(`Téléchargement impossible (HTTP ${response.status}).`);
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_INSTALLER_BYTES) throw new Error('L’installeur est trop volumineux.');
  const installer = Buffer.from(await response.arrayBuffer());
  if (!installer.length || installer.length > MAX_INSTALLER_BYTES) throw new Error('L’installeur téléchargé est invalide.');

  const installerPath = join(app.getPath('temp'), installerName(version));
  await writeFile(installerPath, installer);
  await new Promise<void>((resolve, reject) => {
    const process = spawn(installerPath, [], { detached: true, stdio: 'ignore', windowsHide: true });
    process.once('error', reject);
    process.once('spawn', () => {
      process.unref();
      resolve();
    });
  });

  isQuitting = true;
  stopNativeAudioCapture();
  try {
    await overlayService?.close();
  } finally {
    app.exit(0);
  }
}

async function showChangelogWindow(): Promise<void> {
  if (!overlayService) throw new Error('Le service local n’est pas encore prêt.');
  if (changelogWindow) {
    if (changelogWindow.isMinimized()) changelogWindow.restore();
    changelogWindow.show();
    changelogWindow.focus();
    return;
  }

  const window = new BrowserWindow({
    width: 780,
    height: 680,
    minWidth: 620,
    minHeight: 480,
    show: false,
    title: 'Changelog — What I Listen',
    icon: nativeImage.createFromPath(appIconPath),
    backgroundColor: '#100b18',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  });
  changelogWindow = window;
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { changelogWindow = null; });
  lockWindowToOverlay(window, overlayService.url);
  await window.loadURL(`${overlayService.url}changelog`);
}

function nativeCapturePath(): string {
  if (!app.isPackaged) return join(projectDirectory, 'wasapi-capture', 'what-i-listen-wasapi.exe');
  return join(process.resourcesPath, 'wasapi-capture', 'what-i-listen-wasapi.exe');
}

function parseJsonLine(line: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(line) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function audioOutputDevices(value: unknown): AudioOutputDevice[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { devices?: unknown }).devices)) return [];
  return (value as { devices: unknown[] }).devices.flatMap((device) => {
    if (!device || typeof device !== 'object') return [];
    const candidate = device as { id?: unknown; name?: unknown; isDefault?: unknown };
    if (typeof candidate.id !== 'string' || !candidate.id || typeof candidate.name !== 'string' || !candidate.name) return [];
    return [{ id: candidate.id, name: candidate.name, isDefault: candidate.isDefault === true }];
  });
}

function runNativeCaptureCommand(arguments_: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const child = spawn(nativeCapturePath(), arguments_, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => {
      const result = parseJsonLine(stdout.trim());
      if (code === 0 && result) resolve(result);
      else reject(new Error(
        (typeof result?.message === 'string' && result.message)
        || stderr.trim()
        || `Capture audio native arrêtée (code ${code ?? 'inconnu'}).`,
      ));
    });
  });
}

async function listAudioOutputDevices(): Promise<AudioOutputDevice[]> {
  const response = await runNativeCaptureCommand(['list']);
  if (response.type !== 'devices') throw new Error('Réponse invalide de la capture audio native.');
  return audioOutputDevices(response);
}

function stopNativeAudioCapture(): void {
  const capture = nativeAudioCapture;
  nativeAudioCapture = null;
  if (capture && !capture.killed) capture.kill();
}

function startNativeAudioCapture(deviceId: string): void {
  stopNativeAudioCapture();
  const arguments_ = deviceId ? ['capture', deviceId] : ['capture'];
  const capture = spawn(nativeCapturePath(), arguments_, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  nativeAudioCapture = capture;
  let pendingOutput = '';
  let reportedError = '';

  capture.stdout.setEncoding('utf8');
  capture.stdout.on('data', (chunk: string) => {
    pendingOutput += chunk;
    const lines = pendingOutput.split(/\r?\n/);
    pendingOutput = lines.pop() ?? '';
    lines.forEach((line) => {
      const message = parseJsonLine(line);
      if (!message) return;
      if (message.type === 'levels') overlayService?.updateAudioLevels(message);
      if (message.type === 'error') {
        reportedError = typeof message.message === 'string' ? message.message : 'La capture WASAPI a échoué.';
        overlayService?.setAudioCaptureError(reportedError);
      }
    });
  });
  capture.once('error', (error) => {
    if (nativeAudioCapture !== capture) return;
    nativeAudioCapture = null;
    overlayService?.setAudioCaptureError(error.message);
  });
  capture.once('exit', (code) => {
    if (nativeAudioCapture !== capture) return;
    nativeAudioCapture = null;
    if (!isQuitting) overlayService?.setAudioCaptureError(reportedError || `La capture WASAPI s’est arrêtée (code ${code ?? 'inconnu'}).`);
  });
}

function restartNativeAudioCapture(deviceId: string): Promise<void> {
  if (audioCaptureRestart) return audioCaptureRestart;
  audioCaptureRestart = Promise.resolve().then(() => startNativeAudioCapture(deviceId)).finally(() => {
    audioCaptureRestart = null;
  });
  return audioCaptureRestart;
}

async function showPreviewWindow() {
  if (!overlayService) throw new Error('Le service local n’est pas encore prêt.');

  if (previewWindow) {
    if (previewWindow.isMinimized()) previewWindow.restore();
    previewWindow.show();
    previewWindow.focus();
    return;
  }

  previewWindow = new BrowserWindow({
    width: 520,
    height: 130,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    title: 'Aperçu — What I Listen',
    icon: nativeImage.createFromPath(appIconPath),
    backgroundColor: '#100b18',
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  });
  previewWindow.setMenuBarVisibility(false);
  previewWindow.on('closed', () => { previewWindow = null; });
  const service = overlayService;
  if (!service) throw new Error('Le service local n’est pas encore prêt.');
  lockWindowToOverlay(previewWindow, service.url);
  await previewWindow.loadURL(`${service.url}?debug&preview`);
}

function updateTray(language: OverlaySettings['language']): void {
  if (!tray) return;
  tray.setToolTip(nativeText('windowTitle', language));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: nativeText('show', language), click: () => { void showMainWindow(); } },
    { label: nativeText('preview', language), click: () => { void showPreviewWindow(); } },
    { type: 'separator' },
    { label: nativeText('quit', language), click: () => app.quit() },
  ]));
  mainWindow?.setTitle(nativeText('windowTitle', language));
}

function createTray(language: OverlaySettings['language']): void {
  tray = new Tray(nativeImage.createFromPath(appIconPath).resize({ width: 32, height: 32 }));
  updateTray(language);
  tray.on('click', () => { void showMainWindow(); });
}

function currentUpdateLanguage(fallback: OverlaySettings['language'] = 'fr'): OverlaySettings['language'] {
  return overlayService?.settings().language ?? fallback;
}

function publishAutomaticUpdateState(state: AutomaticUpdateState): void {
  automaticUpdateState = state;
  if (!updateWindow || updateWindow.isDestroyed()) return;
  updateWindow.setClosable(state.status !== 'downloading');
  updateWindow.webContents.send('what-i-listen:automatic-update-state', state);
}

async function showUpdateWindow(): Promise<void> {
  if (!automaticUpdateState) return;
  if (updateWindow && !updateWindow.isDestroyed()) {
    if (updateWindow.isMinimized()) updateWindow.restore();
    updateWindow.show();
    updateWindow.focus();
    return;
  }

  const language = automaticUpdateState.language;
  const window = new BrowserWindow({
    width: 540,
    height: 470,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    minimizable: true,
    closable: automaticUpdateState.status !== 'downloading',
    show: false,
    title: nativeText('updateWindowTitle', language),
    icon: nativeImage.createFromPath(appIconPath),
    backgroundColor: '#07111e',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  });
  updateWindow = window;
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { updateWindow = null; });
  await window.loadFile(join(projectDirectory, 'public', 'update.html'));
}

function closeUpdateWindow(): void {
  if (automaticUpdateState?.status === 'downloading') return;
  updateWindow?.close();
}

function startUpdateDownload(): Promise<void> {
  if (automaticUpdateState?.status === 'downloaded') return Promise.resolve();
  if (updateDownloadPromise) return updateDownloadPromise;
  if (!automaticUpdateState || !['available', 'error'].includes(automaticUpdateState.status)) {
    return Promise.reject(new Error('Aucune mise à jour n’est prête à être téléchargée.'));
  }

  publishAutomaticUpdateState({
    ...automaticUpdateState,
    status: 'downloading',
    percent: 0,
    transferred: 0,
    total: 0,
    bytesPerSecond: 0,
    error: undefined,
  });
  updateDownloadPromise = autoUpdater.downloadUpdate()
    .then(() => undefined)
    .catch((error: unknown) => {
      if (automaticUpdateState?.status === 'downloading') {
        publishAutomaticUpdateState({
          ...automaticUpdateState,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    })
    .finally(() => { updateDownloadPromise = null; });
  return updateDownloadPromise;
}

async function installDownloadedUpdate(): Promise<void> {
  if (isQuitting || automaticUpdateState?.status !== 'downloaded') return;
  isQuitting = true;
  stopNativeAudioCapture();
  try {
    await overlayService?.close();
  } finally {
    autoUpdater.quitAndInstall(false, true);
  }
}

function startAutomaticUpdates(language: OverlaySettings['language']): void {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => {
    if (isQuitting) return;
    publishAutomaticUpdateState({
      status: 'available',
      currentVersion: app.getVersion(),
      version: info.version,
      language: currentUpdateLanguage(language),
      percent: 0,
      transferred: 0,
      total: 0,
      bytesPerSecond: 0,
    });
    void showUpdateWindow().catch((error: unknown) => {
      console.warn('La fenêtre de mise à jour n’a pas pu être ouverte :', error);
    });
  });
  autoUpdater.on('download-progress', (progress) => {
    if (!automaticUpdateState) return;
    publishAutomaticUpdateState({
      ...automaticUpdateState,
      status: 'downloading',
      percent: Math.max(0, Math.min(100, progress.percent)),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
      error: undefined,
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (!automaticUpdateState || isQuitting) return;
    publishAutomaticUpdateState({
      ...automaticUpdateState,
      status: 'downloaded',
      version: info.version,
      percent: 100,
      transferred: automaticUpdateState.total || automaticUpdateState.transferred,
      error: undefined,
    });
    void showUpdateWindow().catch((error: unknown) => {
      console.warn('La fenêtre de mise à jour n’a pas pu être rouverte :', error);
    });
  });
  autoUpdater.on('error', (error) => {
    if (!automaticUpdateState || automaticUpdateState.status === 'downloaded' || isQuitting) return;
    publishAutomaticUpdateState({
      ...automaticUpdateState,
      status: 'error',
      error: error.message,
    });
  });
  const checkForUpdates = async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error: unknown) {
      console.warn('La vérification des mises à jour a échoué :', error);
    }
  };
  void checkForUpdates();
  const updateCheckTimer = setInterval(() => { void checkForUpdates(); }, UPDATE_CHECK_INTERVAL_MS);
  updateCheckTimer.unref();
}

app.whenReady().then(async () => {
  app.setName('What I Listen');
  Menu.setApplicationMenu(null);
  ipcMain.handle('what-i-listen:open-preview', () => showPreviewWindow());
  ipcMain.handle('what-i-listen:list-audio-outputs', () => listAudioOutputDevices());
  ipcMain.handle('what-i-listen:get-app-version', () => app.getVersion());
  ipcMain.handle('what-i-listen:get-update-info', (_event, forceRefresh: unknown) => getUpdateInfo(forceRefresh === true));
  ipcMain.handle('what-i-listen:install-release', (_event, version: unknown) => installRelease(version));
  ipcMain.handle('what-i-listen:open-changelog', () => showChangelogWindow());
  ipcMain.handle('what-i-listen:get-automatic-update-state', () => automaticUpdateState);
  ipcMain.handle('what-i-listen:download-automatic-update', () => startUpdateDownload());
  ipcMain.handle('what-i-listen:restart-and-install-update', () => installDownloadedUpdate());
  ipcMain.handle('what-i-listen:close-update-window', () => closeUpdateWindow());
  const backendPath = app.isPackaged
    ? join(
        process.resourcesPath,
        'app.asar.unpacked',
        'node_modules',
        'windows-media-sessions',
        'bin',
        'win-x64',
        'windows-media-sessions-backend.exe',
      )
    : undefined;
  overlayService = await startOverlayService({
    backendPath,
    settingsPath: join(app.getPath('userData'), 'overlay-settings.json'),
  });
  startNativeAudioCapture(overlayService.settings().audioOutputDeviceId);
  await createWindow({ showOnReady: !overlayService.settings().startHidden });
  createTray(overlayService.settings().language);
  startAutomaticUpdates(overlayService.settings().language);
  let audioOutputDeviceId = overlayService.settings().audioOutputDeviceId;
  overlayService.onSettingsChanged((settings) => {
    updateTray(settings.language);
    if (audioOutputDeviceId === settings.audioOutputDeviceId) return;
    audioOutputDeviceId = settings.audioOutputDeviceId;
    void restartNativeAudioCapture(audioOutputDeviceId).catch((error: unknown) => {
      overlayService?.setAudioCaptureError(error instanceof Error ? error.message : String(error));
    });
  });

  app.on('activate', async () => {
    await showMainWindow();
  });
}).catch((error: unknown) => {
  dialog.showErrorBox('What I Listen — démarrage impossible', error instanceof Error ? error.message : String(error));
  app.exit(1);
});

app.on('before-quit', (event) => {
  if (isQuitting || !overlayService) return;
  isQuitting = true;
  event.preventDefault();
  stopNativeAudioCapture();
  overlayService.close().finally(() => app.exit(0));
});
