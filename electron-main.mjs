import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, Menu, nativeImage, screen, session, Tray } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startOverlayService } from './src/overlay-service.mjs';

const projectDirectory = dirname(fileURLToPath(import.meta.url));
const preloadPath = join(projectDirectory, 'preload.cjs');
const audioCapturePreloadPath = join(projectDirectory, 'src', 'audio-capture-preload.cjs');

let mainWindow = null;
let previewWindow = null;
let audioCaptureWindow = null;
let overlayService = null;
let tray = null;
let isQuitting = false;

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function showMainWindow() {
  if (!mainWindow) return createWindow({ showOnReady: true });
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  return Promise.resolve();
}

function createWindow({ showOnReady = false } = {}) {
  mainWindow = new BrowserWindow({
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

  mainWindow.once('ready-to-show', () => {
    if (showOnReady) mainWindow?.show();
  });
  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  return mainWindow.loadURL(`${overlayService.url}app`);
}

async function getPrimaryScreenSource() {
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
      overlayService?.setAudioCaptureError(error.message);
      callback({});
    }
  }, { useSystemPicker: false });

  ipcMain.handle('audio-capture:source-id', async () => {
    const source = await getPrimaryScreenSource();
    if (!source) throw new Error('Aucun écran Windows n’est disponible pour la capture audio.');
    return source.id;
  });
  ipcMain.on('audio-capture:levels', (_event, levels) => {
    overlayService?.updateAudioLevels(levels);
  });
  ipcMain.on('audio-capture:error', (_event, message) => {
    overlayService?.setAudioCaptureError(message);
  });
}

function createAudioCaptureWindow() {
  if (audioCaptureWindow) return Promise.resolve();

  audioCaptureWindow = new BrowserWindow({
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
  audioCaptureWindow.on('closed', () => {
    audioCaptureWindow = null;
    if (!isQuitting) overlayService?.setAudioCaptureError('La fenêtre de capture audio a été fermée.');
  });
  return audioCaptureWindow.loadURL(`${overlayService.url}audio-capture`);
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
  await previewWindow.loadURL(`${overlayService.url}?debug&preview`);
}

function createTray() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b877ff"/><stop offset="1" stop-color="#64e58b"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="#1b1029"/><path d="M20 7v12.2a4.5 4.5 0 1 1-2-3.75V10l8-2v9.2a4.5 4.5 0 1 1-2-3.75V5z" fill="url(#g)"/></svg>`;
  tray = new Tray(nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`));
  tray.setToolTip('What I Listen — Deezer');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Afficher What I Listen', click: () => { void showMainWindow(); } },
    { label: 'Ouvrir l’aperçu en direct', click: () => { void showPreviewWindow(); } },
    { type: 'separator' },
    { label: 'Quitter', click: () => app.quit() },
  ]));
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
  configureAudioCapture();
  await createWindow({ showOnReady: !overlayService.settings().startHidden });
  await createAudioCaptureWindow();
  createTray();

  app.on('activate', async () => {
    await showMainWindow();
  });
}).catch((error) => {
  dialog.showErrorBox('What I Listen — démarrage impossible', error.message);
  app.exit(1);
});

app.on('before-quit', (event) => {
  if (isQuitting || !overlayService) return;
  isQuitting = true;
  event.preventDefault();
  audioCaptureWindow?.destroy();
  overlayService.close().finally(() => app.exit(0));
});
