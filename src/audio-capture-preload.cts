const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('audioCapture', {
  getSourceId() {
    return ipcRenderer.invoke('audio-capture:source-id');
  },
  publishLevels(levels: AudioLevels) {
    ipcRenderer.send('audio-capture:levels', levels);
  },
  reportError(message: unknown) {
    ipcRenderer.send('audio-capture:error', String(message || 'Capture audio indisponible.'));
  },
});
