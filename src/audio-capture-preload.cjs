const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('audioCapture', {
  getSourceId() {
    return ipcRenderer.invoke('audio-capture:source-id');
  },
  publishLevels(levels) {
    ipcRenderer.send('audio-capture:levels', levels);
  },
  reportError(message) {
    ipcRenderer.send('audio-capture:error', String(message || 'Capture audio indisponible.'));
  },
});
