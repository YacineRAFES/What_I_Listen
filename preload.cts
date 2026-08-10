const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whatIListen', {
  openPreview: () => ipcRenderer.invoke('what-i-listen:open-preview'),
});
