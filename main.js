const { app, BrowserWindow, ipcMain, Menu, Tray, screen } = require('electron');
const path = require('path');

let win = null;
let tray = null;

const WIN_W = 450;
const WIN_H = 640;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x: width - WIN_W - 40,
    y: height - WIN_H,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false            // 关闭沙箱，preload 才能用 require('fs') 读取立绘并暴露 petAPI
    }
  });

  win.loadFile('index.html');
  win.setAlwaysOnTop(true, 'screen-saver');
}

// ---------- 拖拽：按渲染层传来的位移增量移动窗口（事件驱动、按帧合并，低延迟且平滑）----------
ipcMain.on('drag-move', (_e, { dx, dy }) => {
  if (!win) return;
  const [x, y] = win.getPosition();
  win.setPosition(Math.round(x + dx), Math.round(y + dy));
});

// ---------- 退出 / 显隐 ----------
ipcMain.on('quit-app', () => app.quit());

ipcMain.on('toggle-visible', () => {
  if (!win) return;
  if (win.isVisible()) win.hide(); else win.show();
});

// ---------- 右键上下文菜单 ----------
ipcMain.on('show-context-menu', () => {
  if (!win) return;
  const menu = Menu.buildFromTemplate([
    {
      label: '置顶显示',
      type: 'checkbox',
      checked: win.isAlwaysOnTop(),
      click: (item) => win.setAlwaysOnTop(item.checked, 'screen-saver')
    },
    { label: '隐藏', click: () => win.hide() },
    {
      label: '穿透鼠标(8秒后自动恢复)',
      click: () => {
        win.setIgnoreMouseEvents(true, { forward: true });
        setTimeout(() => win && win.setIgnoreMouseEvents(false), 8000);
      }
    },
    { type: 'separator' },
    { label: '退出凤羽', click: () => app.quit() }
  ]);
  menu.popup({ window: win });
});

// ---------- 系统托盘：始终可用的退出入口 ----------
function createTray() {
  try {
    tray = new Tray(path.join(__dirname, 'icon.ico'));
  } catch (e) {
    return; // 图标缺失时跳过托盘，不影响主功能
  }
  tray.setToolTip('凤羽桌面精灵');
  const menu = Menu.buildFromTemplate([
    { label: '显示 / 隐藏', click: () => { if (win.isVisible()) win.hide(); else win.show(); } },
    {
      label: '置顶显示',
      type: 'checkbox',
      checked: true,
      click: (item) => win && win.setAlwaysOnTop(item.checked, 'screen-saver')
    },
    { type: 'separator' },
    { label: '退出凤羽', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => { if (win.isVisible()) win.hide(); else win.show(); });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('before-quit', () => { if (tray) { tray.destroy(); tray = null; } });
app.on('window-all-closed', () => app.quit());
