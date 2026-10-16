const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('goooooookHost', {
  getStatus: () => ipcRenderer.invoke('host:getStatus'),
  openController: () => ipcRenderer.invoke('host:openController'),
  openDataFolder: () => ipcRenderer.invoke('host:openDataFolder'),
  quit: () => ipcRenderer.invoke('host:quit'),
  onStatus: callback => {
    if (typeof callback !== 'function') return;
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('host-status', listener);
    return () => ipcRenderer.removeListener('host-status', listener);
  }
});
