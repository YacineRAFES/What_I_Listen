const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whatIListen', {
  openPreview: () => ipcRenderer.invoke('what-i-listen:open-preview'),
  listAudioOutputs: () => ipcRenderer.invoke('what-i-listen:list-audio-outputs'),
  getAppVersion: () => ipcRenderer.invoke('what-i-listen:get-app-version'),
  getUpdateInfo: (forceRefresh = false) => ipcRenderer.invoke('what-i-listen:get-update-info', forceRefresh),
  installRelease: (version: string) => ipcRenderer.invoke('what-i-listen:install-release', version),
  openChangelog: () => ipcRenderer.invoke('what-i-listen:open-changelog'),
  getAutomaticUpdateState: () => ipcRenderer.invoke('what-i-listen:get-automatic-update-state'),
  downloadAutomaticUpdate: () => ipcRenderer.invoke('what-i-listen:download-automatic-update'),
  restartAndInstallUpdate: () => ipcRenderer.invoke('what-i-listen:restart-and-install-update'),
  closeUpdateWindow: () => ipcRenderer.invoke('what-i-listen:close-update-window'),
  onAutomaticUpdateState: (listener: (state: unknown) => void) => {
    const channel = 'what-i-listen:automatic-update-state';
    const wrappedListener = (_event: unknown, state: unknown) => listener(state);
    ipcRenderer.on(channel, wrappedListener);
    return () => ipcRenderer.removeListener(channel, wrappedListener);
  },
});
