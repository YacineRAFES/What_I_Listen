import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, Menu, nativeImage, screen, session, Tray, type BrowserWindow as ElectronBrowserWindow, type DesktopCapturerSource, type Tray as ElectronTray } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startOverlayService, type OverlayService } from './src/overlay-service.js';

const projectDirectory = dirname(fileURLToPath(import.meta.url));
const preloadPath = join(projectDirectory, 'preload.cjs');
const audioCapturePreloadPath = join(projectDirectory, 'src', 'audio-capture-preload.cjs');

let mainWindow: ElectronBrowserWindow | null = null;
let previewWindow: ElectronBrowserWindow | null = null;
let audioCaptureWindow: ElectronBrowserWindow | null = null;
let overlayService: OverlayService | null = null;
let tray: ElectronTray | null = null;
let isQuitting = false;

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

async function getPrimaryScreenSource(): Promise<DesktopCapturerSource | null> {
  const primaryDisplayId = String(screen.getPrimaryDisplay().id);
  const sources = await desktopCapturer.getSources({ types: ['screen'] });
  return sources.find((source) => source.display_id === primaryDisplayId) ?? sources[0] ?? null;
}

function configureAudioCapture() {
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const source = await getPrimaryScreenSource();
      if (!source) throw new Error('Aucun écran Windows n’est disponible pour la capture audio.');
      callback({ video: source, audio: 'loopback' });
    } catch (error) {
      overlayService?.setAudioCaptureError(error instanceof Error ? error.message : String(error));
      callback({});
    }
  }, { useSystemPicker: false });

  ipcMain.handle('audio-capture:source-id', async () => {
    const source = await getPrimaryScreenSource();
    if (!source) throw new Error('Aucun écran Windows n’est disponible pour la capture audio.');
    return source.id;
  });
  ipcMain.on('audio-capture:levels', (_event, levels: unknown) => {
    overlayService?.updateAudioLevels(levels);
  });
  ipcMain.on('audio-capture:error', (_event, message: unknown) => {
    overlayService?.setAudioCaptureError(message);
  });
}

function createAudioCaptureWindow() {
  if (audioCaptureWindow) return Promise.resolve();

  const window = new BrowserWindow({
    show: false,
    skipTaskbar: true,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      preload: audioCapturePreloadPath,
      sandbox: true,
    },
  });
  audioCaptureWindow = window;
  window.on('closed', () => {
    audioCaptureWindow = null;
    if (!isQuitting) overlayService?.setAudioCaptureError('La fenêtre de capture audio a été fermée.');
  });
  const service = overlayService;
  if (!service) throw new Error('Le service local n’est pas encore prêt.');
  return window.loadURL(`${service.url}audio-capture`);
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b877ff"/><stop offset="1" stop-color="#64e58b"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="#1b1029"/><path d="M20 7v12.2a4.5 4.5 0 1 1-2-3.75V10l8-2v9.2a4.5 4.5 0 1 1-2-3.75V5z" fill="url(#g)"/></svg>`;
  tray = new Tray(nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`));
  updateTray(language);
  tray.on('click', () => { void showMainWindow(); });
}

app.whenReady().then(async () => {
  app.setName('What I Listen');
  ipcMain.handle('what-i-listen:open-preview', () => showPreviewWindow());
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
  await createWindow({ showOnReady: !overlayService.settings().startHidden });
  createTray(overlayService.settings().language);
  overlayService.onSettingsChanged(({ language }) => updateTray(language));

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
  audioCaptureWindow?.destroy();
  overlayService.close().finally(() => app.exit(0));
});
