import { app, BrowserWindow, dialog, Menu, nativeImage, Tray } from 'electron';
import { join } from 'node:path';
import { startOverlayService } from './src/overlay-service.mjs';

let mainWindow = null;
let overlayService = null;
let tray = null;
let isQuitting = false;

const nativeTranslations = {
  fr: {
    windowTitle: 'What I Listen — Deezer',
    show: 'Afficher What I Listen',
    quit: 'Quitter',
  },
  en: {
    windowTitle: 'What I Listen — Deezer',
    show: 'Show What I Listen',
    quit: 'Quit',
  },
};

function nativeText(key, language = 'fr') {
  return (nativeTranslations[language] ?? nativeTranslations.fr)[key];
}

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

function updateTray(language) {
  if (!tray) return;
  tray.setToolTip(nativeText('windowTitle', language));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: nativeText('show', language), click: () => { void showMainWindow(); } },
    { type: 'separator' },
    { label: nativeText('quit', language), click: () => app.quit() },
  ]));
  mainWindow?.setTitle(nativeText('windowTitle', language));
}

function createTray(language) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b877ff"/><stop offset="1" stop-color="#64e58b"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="#1b1029"/><path d="M20 7v12.2a4.5 4.5 0 1 1-2-3.75V10l8-2v9.2a4.5 4.5 0 1 1-2-3.75V5z" fill="url(#g)"/></svg>`;
  tray = new Tray(nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`));
  updateTray(language);
  tray.on('click', () => { void showMainWindow(); });
}

app.whenReady().then(async () => {
  app.setName('What I Listen');
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
}).catch((error) => {
  dialog.showErrorBox('What I Listen — démarrage impossible', error.message);
  app.exit(1);
});

app.on('before-quit', (event) => {
  if (isQuitting || !overlayService) return;
  isQuitting = true;
  event.preventDefault();
  overlayService.close().finally(() => app.exit(0));
});
