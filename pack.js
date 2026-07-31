/*
 * @Author: 舒克 1435787623@qq.com
 * @Date: 2026-07-30 14:05:03
 * @LastEditors: 舒克 1435787623@qq.com
 * @LastEditTime: 2026-07-31 09:54:04
 * @FilePath: \fengyu-desktop-pet\pack.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
// 直接调用打包器 API，绕开被污染环境里的 .cmd/npm shim
//
// 用法：
//   node pack.js                     打包全部角色
//   node pack.js fengyu              只打包 fengyu 这个角色（其余角色不进包）
//   node pack.js fengyu fengyu-azure 只打包这几个角色
//   npm run pack -- fengyu           （通过 npm 传参，效果同上）
process.env.ELECTRON_MIRROR = process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/';
const packager = require('@electron/packager');
const fs = require('fs');
const path = require('path');

const CHARS_DIR = path.join(__dirname, 'assets', 'characters');

// 读取全部可用角色 id（= characters 下的子目录名）
function allCharIds() {
  try {
    return fs.readdirSync(CHARS_DIR, { withFileTypes: true })
             .filter((d) => d.isDirectory()).map((d) => d.name);
  } catch (e) { return []; }
}

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// 只打包某角色时，为“其余每个角色目录”生成一条排除规则
function excludeRule(id) {
  return new RegExp('(^|[\\/\\\\])assets[\\/\\\\]characters[\\/\\\\]' + escapeRegExp(id) + '([\\/\\\\]|$)');
}

const requested = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const available = allCharIds();

// 基础排除项（脚本/日志/开发临时文件等）
// 注：用宽松匹配，避免新增文件名时又漏进包
const ignore = [
  /(^|[\/\\])dist([\/\\]|$)/,
  /(^|[\/\\])\.git([\/\\]|$)/,
  /(^|[\/\\])\.qoder([\/\\]|$)/,          // Agent skill 等开发时资产
  /\.log$/,
  /(^|[\/\\])(server|make-icon|pack)\.js$/,
  /(^|[\/\\])preview\.png$/,
  /(^|[\/\\])icon\.b64$/,
  /\.glb$/,                                // 遗留 3D 模型（源码零引用，76MB）
  /(^|[\/\\])face-collect([\/\\]|$)/,     // UI 演示页，与桌宠无关
  /(^|[\/\\])settings-preview[^\/\\]*\.html$/,   // 设置面板设计稿，仅开发参考
  /(^|[\/\\])_[^\/\\]*\.(png|jpe?g|gif)$/,       // 下划线开头的验证截图
  /(^|[\/\\])agent\.md$/,
  /e2e/,
  /petdiag/
];

let included = available;   // 默认全打
if (requested.length > 0) {
  const unknown = requested.filter((id) => !available.includes(id));
  if (unknown.length) {
    console.error('PACK_ERR 未找到角色: ' + unknown.join(', ') + '；可用角色: ' + (available.join(', ') || '（无）'));
    process.exit(1);
  }
  included = requested;
  // 把“未选中的角色目录”加入排除，使其不进包
  available.filter((id) => !included.includes(id)).forEach((id) => ignore.push(excludeRule(id)));
}

console.log('PACK 包含角色: ' + (included.join(', ') || '（无角色目录，使用兜底 assets/char.png）'));

packager({
  dir: __dirname,
  name: '漂泊者桌面精灵',
  platform: 'win32',
  arch: 'x64',
  out: 'dist',
  overwrite: true,
  icon: 'icon.ico',
  appVersion: '1.0.0',
  ignore
}).then((paths) => {
  console.log('PACK_OK ' + paths.join(', '));
}).catch((e) => {
  console.error('PACK_ERR ' + (e && e.message ? e.message : e));
  process.exit(1);
});
