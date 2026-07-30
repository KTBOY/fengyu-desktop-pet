const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// 读取立绘并转为 data URL，避免渲染进程用 file:// 加载图片污染画布导致抠图失败
let spriteDataURL = '';
try {
  const buf = fs.readFileSync(path.join(__dirname, 'assets', 'char.png'));
  spriteDataURL = 'data:image/png;base64,' + buf.toString('base64');
} catch (e) {
  spriteDataURL = '';
}

contextBridge.exposeInMainWorld('petAPI', {
  spriteDataURL,
  dragMove: (dx, dy) => ipcRenderer.send('drag-move', { dx, dy }),
  quit: () => ipcRenderer.send('quit-app'),
  hide: () => ipcRenderer.send('toggle-visible'),
  showContextMenu: () => ipcRenderer.send('show-context-menu')
});
