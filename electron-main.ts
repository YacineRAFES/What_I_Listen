import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Tray, type BrowserWindow as ElectronBrowserWindow, type Tray as ElectronTray } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startOverlayService, type OverlayService } from './src/overlay-service.js';

const projectDirectory = dirname(fileURLToPath(import.meta.url));
const preloadPath = join(projectDirectory, 'preload.cjs');
const appIconPath = join(projectDirectory, 'public', 'app-icon.svg');

let mainWindow: ElectronBrowserWindow | null = null;
let previewWindow: ElectronBrowserWindow | null = null;
let nativeAudioCapture: ChildProcess | null = null;
let overlayService: OverlayService | null = null;
let tray: ElectronTray | null = null;
let isQuitting = false;
let audioCaptureRestart: Promise<void> | null = null;

interface AudioOutputDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

const nativeTranslations = {
  fr: {
    windowTitle: 'What I Listen — Deezer',
    show: 'Afficher What I Listen',
    preview: 'Ouvrir l’aperçu en direct',
    quit: 'Quitter',
  },
  en: {
    windowTitle: 'What I Listen — Deezer',
    show: 'Show What I Listen',
    preview: 'Open live preview',
    quit: 'Quit',
  },
};

function nativeText(key: keyof typeof nativeTranslations.fr, language: OverlaySettings['language'] = 'fr'): string {
  return (nativeTranslations[language] ?? nativeTranslations.fr)[key];
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function showMainWindow() {
  if (!mainWindow) return createWindow({ showOnReady: true });
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  return Promise.resolve();
}

function createWindow({ showOnReady = false }: { showOnReady?: boolean } = {}) {
  const window = new BrowserWindow({
    width: 920,
    height: 720,
    minWidth: 720,
    minHeight: 590,
    show: false,
    title: 'What I Listen — Deezer',
    icon: nativeImage.createFromPath(appIconPath),
    backgroundColor: '#100b18',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  });
  mainWindow = window;

  window.once('ready-to-show', () => {
    if (showOnReady) window.show();
  });
  window.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    window.hide();
  });
  window.on('closed', () => { mainWindow = null; });
  const service = overlayService;
  if (!service) throw new Error('Le service local n’est pas encore prêt.');
  return window.loadURL(`${service.url}app`);
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

app.whenReady().then(async () => {
  app.setName('What I Listen');
  ipcMain.handle('what-i-listen:open-preview', () => showPreviewWindow());
  ipcMain.handle('what-i-listen:list-audio-outputs', () => listAudioOutputDevices());
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
