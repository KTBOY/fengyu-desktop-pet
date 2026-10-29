const { contextBridge, ipcRenderer } = require('electron');

// 与桌宠主进程同一套做法：字节由主进程读，data URL 过桥，渲染进程不碰 fs
contextBridge.exposeInMainWorld('protoAPI', {
  getProject: () => ipcRenderer.invoke('proto:project'),
  ready: info => ipcRenderer.send('proto:ready', info),
  fail: message => ipcRenderer.send('proto:fail', message)
});
