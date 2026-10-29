// 阶段一验证原型：在与桌宠同款的透明无边框窗口里跑 mesh-avatar-studio 引擎。
// engine/ 是 https://github.com/moyuxianren01/mesh-avatar-studio-zh （上游
// shinshin86/mesh-avatar-studio）src/engine 的原样副本，MIT，见 engine/LICENSE。
// 素材用官方 Miko 示例，仅用于验证渲染通路，不可随应用发布（立绘非 MIT）。
//
//   node mesh-proto/main.js                                  # 肉眼查看
//   MESH_PROTO_SCHEME=petmesh node mesh-proto/main.js        # 换用自定义协议加载（同样实测通过）
//   MESH_PROTO_OUT=mesh-proto/out node mesh-proto/main.js    # 自动截图 + 缩放压力 + 退出
const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const SAMPLE = process.env.MESH_PROTO_SAMPLE || 'D:/my/test-html/建模/samples/miko-qipao';
const BUILT = path.join(SAMPLE, 'built');
const OUT = process.env.MESH_PROTO_OUT ? path.resolve(process.env.MESH_PROTO_OUT) : null;
const SCHEME = process.env.MESH_PROTO_SCHEME || 'file';   // 实测 file:// 下 ESM 图与 data URL 都通，无需自定义协议
const MIME = { '.png': 'image/png', '.json': 'application/json', '.js': 'text/javascript', '.html': 'text/html' };
if (OUT) fs.mkdirSync(OUT, { recursive: true });

// built/ 整棵树转成 data URL 交给引擎：引擎用 fetch + new Image 取资源，
// file:// 下 fetch 不可用，所以必须像桌宠现在的 imageDataURL 那样把字节递进渲染进程
function projectPayload() {
  const rig = JSON.parse(fs.readFileSync(path.join(SAMPLE, 'rig.json'), 'utf8'));
  const assets = {};
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(abs); continue; }
      const rel = path.relative(BUILT, abs).split(path.sep).join('/');
      const type = MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream';
      assets[rel] = `data:${type};base64,${fs.readFileSync(abs).toString('base64')}`;
    }
  };
  walk(BUILT);
  return { rig, assets };
}

const logs = [];
let win = null;
const wait = ms => new Promise(r => setTimeout(r, ms));

function capture(label) {
  return win.webContents.capturePage().then(image => {
    const file = path.join(OUT, `${label}.png`);
    fs.writeFileSync(file, image.toPNG());
    const size = image.getSize();
    return { label, file: `${label}.png`, px: [size.width, size.height] };
  });
}

async function evidence() {
  const shots = [];
  await wait(700);
  for (let i = 0; i < 6; i++) { shots.push(await capture(`t${i}`)); await wait(280); }
  // 模拟设置面板拖大小滑杆：窗口连续 resize 时透明窗最容易露出空白帧
  for (const [w, h] of [[300, 430], [520, 740], [450, 640]]) {
    win.setContentSize(w, h);
    await wait(160);
    shots.push(await capture(`resize-${w}x${h}`));
  }
  const proto = await win.webContents.executeJavaScript('window.__PROTO || null', true).catch(e => ({ error: String(e) }));
  fs.writeFileSync(path.join(OUT, 'diag.json'), JSON.stringify({ scheme: SCHEME, shots, proto, logs }, null, 2));
  console.log(`EVIDENCE ${path.join(OUT, 'diag.json')}`);
  app.quit();
}

function createWindow() {
  win = new BrowserWindow({
    width: 450,
    height: 640,
    useContentSize: true,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    x: 120,
    y: 80,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.webContents.on('console-message', (...args) => {
    const [event, level, message, line, sourceId] = args;
    const detail = typeof level === 'object' && level ? level.message : message;
    logs.push({ level: typeof level === 'object' ? level.level : level, text: detail, at: `${sourceId}:${line}` });
    console.log(`[renderer] ${detail}`);
  });
  if (OUT) win.webContents.once('did-finish-load', () => { setTimeout(evidence, 400); });
  if (SCHEME === 'file') win.loadFile(path.join(__dirname, 'index.html'));
  else win.loadURL(`${SCHEME}://root/mesh-proto/index.html`);
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'petmesh', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

app.whenReady().then(() => {
  const serve = request => {
    const rel = new URL(request.url).pathname.replace(/^\//, '');
    const abs = path.join(ROOT, rel);
    if (!abs.startsWith(ROOT)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(abs).toString());
  };
  if (SCHEME !== 'file') {
    if (protocol.handle) protocol.handle('petmesh', serve);
    else protocol.registerBufferProtocol('petmesh', (request, callback) => {
      const rel = new URL(request.url).pathname.replace(/^\//, '');
      const abs = path.join(ROOT, rel);
      try {
        callback({ mimeType: MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream', data: fs.readFileSync(abs) });
      } catch (e) { callback({ error: -6 }); }
    });
  }
  ipcMain.handle('proto:project', () => projectPayload());
  ipcMain.on('proto:ready', (_e, info) => console.log(`READY ${JSON.stringify(info)}`));
  ipcMain.on('proto:fail', (_e, message) => {
    console.log(`FAIL ${message}`);
    logs.push({ level: 'error', text: `proto:fail ${message}`, at: 'main' });
    if (OUT) {
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, 'diag.json'), JSON.stringify({ scheme: SCHEME, failed: message, logs }, null, 2));
      app.quit();
    }
  });
  createWindow();
});
