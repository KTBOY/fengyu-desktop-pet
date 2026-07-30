// 直接调用打包器 API，绕开被污染环境里的 .cmd/npm shim
process.env.ELECTRON_MIRROR = process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/';
const packager = require('@electron/packager');

packager({
  dir: __dirname,
  name: '凤羽桌面精灵',
  platform: 'win32',
  arch: 'x64',
  out: 'dist',
  overwrite: true,
  icon: 'icon.ico',
  appVersion: '1.0.0',
  ignore: [
    /(^|[\/\\])dist([\/\\]|$)/,
    /\.log$/,
    /(^|[\/\\])(server|make-icon|pack)\.js$/,
    /(^|[\/\\])preview\.png$/,
    /(^|[\/\\])icon\.b64$/,
    /e2e/,
    /petdiag/
  ]
}).then((paths) => {
  console.log('PACK_OK ' + paths.join(', '));
}).catch((e) => {
  console.error('PACK_ERR ' + (e && e.message ? e.message : e));
  process.exit(1);
});
