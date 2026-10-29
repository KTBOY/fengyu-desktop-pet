import { createMeshAvatarImpl } from './engine/createMeshAvatar.js';

const probe = document.createElement('canvas').getContext('webgl2');
const info = {
  webgl2: !!probe,
  webgl2Version: probe ? probe.getParameter(probe.VERSION) : null,
  dpr: window.devicePixelRatio,
  assetCount: 0,
  frames: 0,
  avgAdvanceMs: 0,
  coverage: 0
};
window.__PROTO = info;

function measureCoverage(canvas) {
  const sw = 160, sh = Math.max(1, Math.round(sw * canvas.height / canvas.width));
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const g = c.getContext('2d');
  g.drawImage(canvas, 0, 0, sw, sh);
  const d = g.getImageData(0, 0, sw, sh).data;
  let on = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 16) on++;
  return on / (sw * sh);
}

try {
  const { rig, assets } = await window.protoAPI.getProject();
  info.assetCount = Object.keys(assets).length;

  const canvas = document.getElementById('gl');
  const avatar = await createMeshAvatarImpl(canvas, { rig, assets, manual: true });

  // 外部时钟：桌宠需要能在窗口隐藏/穿透时停住，所以用 manual + 自己 rAF
  const pose = { gazeX: 0, gazeY: 0, angleY: 0 };
  avatar.setParameters(pose);

  let last = performance.now();
  let advanceMs = 0;
  (function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t0 = performance.now();
    avatar.advance(dt);
    advanceMs += performance.now() - t0;
    info.frames++;
    info.avgAdvanceMs = advanceMs / info.frames;
    info.canvasPx = [canvas.width, canvas.height];
    info.coverage = measureCoverage(canvas);
  })(performance.now());

  // 交互通路：视线与头部随鼠标（替代现在整张图歪一下）
  window.addEventListener('pointermove', e => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    pose.gazeX = Math.max(-1, Math.min(1, nx));
    pose.gazeY = Math.max(-1, Math.min(1, ny));
    pose.angleY = pose.gazeY * 8;
    avatar.setParameters(pose);
  });

  // 口型与情绪：桌宠的台词气泡可以直接接这两个调用
  window.addEventListener('click', () => {
    avatar.setEmotion('happy');
    avatar.speakKana('あいちゃうえお');
  });

  window.protoAPI.ready({ webgl2: info.webgl2, assetCount: info.assetCount, canvasPx: info.canvasPx });
} catch (error) {
  info.error = String(error && error.message || error);
  window.protoAPI.fail(info.error);
}
