const { contextBridge, ipcRenderer } = require('electron');

// 立绘与角色数据统一由主进程读取并通过 IPC 下发（data URL 避免 file:// 污染画布导致抠图失败）
contextBridge.exposeInMainWorld('petAPI', {
  dragMove: (dx, dy) => ipcRenderer.send('drag-move', { dx, dy }),
  quit: () => ipcRenderer.send('quit-app'),
  hide: () => ipcRenderer.send('toggle-visible'),
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  openSettings: () => ipcRenderer.send('open-settings'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setScale: (s) => ipcRenderer.send('set-scale', s),
  setEffects: (on) => ipcRenderer.send('set-effects', on),
  onSettingsChanged: (cb) => ipcRenderer.on('settings-changed', (_e, cfg) => cb(cfg)),
  // 角色切换
  getCharacters: () => ipcRenderer.invoke('get-characters'),
  getCurrentCharacter: () => ipcRenderer.invoke('get-current-character'),
  setCharacter: (id) => ipcRenderer.send('set-character', id),
  onCharacterChanged: (cb) => ipcRenderer.on('character-changed', (_e, c) => cb(c))
});
