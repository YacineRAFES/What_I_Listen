const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whatIListen', {
  openPreview: () => ipcRenderer.invoke('what-i-listen:open-preview'),
  listAudioOutputs: () => ipcRenderer.invoke('what-i-listen:list-audio-outputs'),
  getAppVersion: () => ipcRenderer.invoke('what-i-listen:get-app-version'),
  getUpdateInfo: (forceRefresh = false) => ipcRenderer.invoke('what-i-listen:get-update-info', forceRefresh),
  installRelease: (version: string) => ipcRenderer.invoke('what-i-listen:install-release', version),
  openChangelog: () => ipcRenderer.invoke('what-i-listen:open-changelog'),
});
