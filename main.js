const { app, BrowserWindow, ipcMain, Menu, Tray, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
let tray = null;
let settingsWin = null;

const BASE_W = 450;
const BASE_H = 640;
const BUBBLE_ZONE = 76;             // 窗口顶部为台词气泡预留的固定高度，不随缩放收缩；
                                    // 按渲染层字号上限 16px 两行留足余量（16*1.35*2+padding+border+top≈63）
const BUBBLE_MIN_W = 260;           // 窗口最小宽度：人物缩小时气泡仍有足够横向空间，最长台词两行内完整显示
const MIN_SCALE = 0.3;
const MAX_SCALE = 1.5;

let scale = 1;                      // 人物整体缩放，1 = 原始 450x640
let effects = true;                 // 星光特效开关
let charId = null;                  // 当前选中角色 id
let characters = [];                // 角色注册表 [{ id, name, theme, lines, imageDataURL }]

function clampScale(s) {
  const v = Math.round((Number(s) || 1) * 100) / 100;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));
}

// 窗口 = 人物区(随缩放) + 顶部气泡区(固定)，渲染层按窗口实际尺寸布局
// 宽度设下限 BUBBLE_MIN_W：人物很小时窗口仍够宽，气泡不至于挤成多行
function winSize() {
  return { w: Math.max(BUBBLE_MIN_W, Math.round(BASE_W * scale)), h: Math.round(BASE_H * scale) + BUBBLE_ZONE };
}

// ---------- 配置持久化（缩放比例记忆到 userData/config.json）----------
function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}
function loadConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    if (cfg && cfg.scale != null) scale = clampScale(cfg.scale);
    if (cfg && cfg.effects != null) effects = !!cfg.effects;
    if (cfg && cfg.charId) charId = cfg.charId;
  } catch (e) { /* 首次运行或文件损坏：保持默认 */ }
}
let saveTimer = null;
function saveConfigDebounced() {
  clearTimeout(saveTimer);            // 拖动滑块会高频触发，合并后再落盘
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(configPath(), JSON.stringify({ scale, effects, charId }), 'utf8'); } catch (e) {}
  }, 400);
}

// 设置项变更后统一推给渲染层，渲染层按需增量应用
function broadcastSettings() {
  if (win && !win.isDestroyed()) win.webContents.send('settings-changed', { scale, effects, bubbleZone: BUBBLE_ZONE });
}

// ---------- 角色注册表：扫描 assets/characters/<id>/meta.json，读图转 data URL ----------
function charsDir() { return path.join(__dirname, 'assets', 'characters'); }

function loadCharacters() {
  characters = [];
  let dirs = [];
  try {
    dirs = fs.readdirSync(charsDir(), { withFileTypes: true })
             .filter((d) => d.isDirectory()).map((d) => d.name);
  } catch (e) { /* 无 characters 目录：走下方兜底 */ }

  for (const dir of dirs) {
    try {
      const base = path.join(charsDir(), dir);
      const meta = JSON.parse(fs.readFileSync(path.join(base, 'meta.json'), 'utf8'));
      const imgPath = path.resolve(base, meta.image || 'char.png');   // 相对角色目录，可用 ../ 复用共享图
      const buf = fs.readFileSync(imgPath);
      const ext = path.extname(imgPath).toLowerCase();
      const mime = (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png';
      characters.push({
        id: meta.id || dir,
        name: meta.name || dir,
        theme: meta.theme || {},
        lines: Array.isArray(meta.lines) ? meta.lines : [],
        imageDataURL: 'data:' + mime + ';base64,' + buf.toString('base64')
      });
    } catch (e) { /* 跳过损坏/缺图的角色目录，不影响其他角色 */ }
  }

  // 兜底：没有任何有效角色时，用旧的 assets/char.png 合成默认穗穗，保证老结构仍能启动
  if (characters.length === 0) {
    try {
      const buf = fs.readFileSync(path.join(__dirname, 'assets', 'char.png'));
      characters.push({ id: 'fengyu', name: '穗穗', theme: {}, lines: [], imageDataURL: 'data:image/png;base64,' + buf.toString('base64') });
    } catch (e) { /* 立绘也缺失：列表为空，渲染层退回占位路径 */ }
  }

  // 校正选中项：配置里的 charId 若不存在（被删/被排除打包），回退到第一个
  if (!characters.some((c) => c.id === charId)) charId = characters[0] ? characters[0].id : null;
}

function currentCharacter() { return characters.find((c) => c.id === charId) || characters[0] || null; }
function fullChar(c) { return c ? { id: c.id, name: c.name, theme: c.theme, lines: c.lines, imageDataURL: c.imageDataURL } : null; }

ipcMain.handle('get-characters', () =>
  characters.map((c) => ({ id: c.id, name: c.name, theme: c.theme, imageDataURL: c.imageDataURL })));
ipcMain.handle('get-current-character', () => fullChar(currentCharacter()));
ipcMain.on('set-character', (_e, id) => {
  if (!characters.some((c) => c.id === id)) return;
  charId = id;
  const payload = fullChar(currentCharacter());
  if (win && !win.isDestroyed()) win.webContents.send('character-changed', payload);
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('character-changed', payload);
  saveConfigDebounced();
});

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const { w, h } = winSize();

  win = new BrowserWindow({
    width: w,
    height: h,
    x: width - w - 40,
    y: height - h,
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

// ---------- 缩放：同步窗口尺寸与渲染层绘制比例 ----------
function applyScale(next) {
  if (!win) return;
  scale = clampScale(next);

  const [x, y] = win.getPosition();
  const [w, h] = win.getSize();
  const { w: nw, h: nh } = winSize();

  // Windows 下 resizable:false 会拦截 setBounds，临时放开再恢复
  win.setResizable(true);
  // 以底部中心为锚点：缩放时人物"站立"的位置不跑偏
  win.setBounds({
    x: Math.round(x + (w - nw) / 2),
    y: Math.round(y + (h - nh)),
    width: nw,
    height: nh
  });
  win.setResizable(false);

  broadcastSettings();
  saveConfigDebounced();
}

ipcMain.handle('get-settings', () => ({ scale, effects, bubbleZone: BUBBLE_ZONE }));
ipcMain.on('set-scale', (_e, s) => applyScale(s));
ipcMain.on('set-effects', (_e, on) => {
  effects = !!on;
  broadcastSettings();
  saveConfigDebounced();
});

// ---------- 设置面板窗口 ----------
function createSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  const b = win ? win.getBounds() : { x: 300, y: 300, width: BASE_W, height: BASE_H };
  settingsWin = new BrowserWindow({
    width: 380,
    height: 560,
    useContentSize: true,               // 按内容区计算，避免挤出滚动条
    frame: false,                       // 无边框：页内自绘标题栏/关闭钮（Win11 自动圆角）
    backgroundColor: '#f2f4f7',         // 与面板底色一致，避免加载瞬间白闪
    x: Math.max(0, b.x - 400),
    y: Math.max(0, b.y + 40),
    title: '穗穗设置',
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  settingsWin.setMenu(null);
  settingsWin.loadFile('settings.html');
  settingsWin.setAlwaysOnTop(true, 'screen-saver');   // 与宠物同层，避免被宠物窗口盖住
  settingsWin.on('closed', () => { settingsWin = null; });
}

ipcMain.on('open-settings', () => createSettingsWindow());

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
    { label: '设置…', click: () => createSettingsWindow() },
    { type: 'separator' },
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
    { label: '退出穗穗', click: () => app.quit() }
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
  tray.setToolTip('穗穗桌面精灵');
  const menu = Menu.buildFromTemplate([
    { label: '显示 / 隐藏', click: () => { if (win.isVisible()) win.hide(); else win.show(); } },
    { label: '设置…', click: () => createSettingsWindow() },
    {
      label: '置顶显示',
      type: 'checkbox',
      checked: true,
      click: (item) => win && win.setAlwaysOnTop(item.checked, 'screen-saver')
    },
    { type: 'separator' },
    { label: '退出穗穗', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => { if (win.isVisible()) win.hide(); else win.show(); });
}

app.whenReady().then(() => {
  loadConfig();
  loadCharacters();
  createWindow();
  createTray();
});

app.on('before-quit', () => { if (tray) { tray.destroy(); tray = null; } });
app.on('window-all-closed', () => app.quit());
