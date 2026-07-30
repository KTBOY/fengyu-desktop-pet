/**
 * character.js —— 精灵图加载 + Canvas 边缘洪水填充抠图（去白底，保留人物内部白色）
 * 对外暴露 window.Sprite
 */
(function () {
  'use strict';

  // 判断是否"背景白" —— 接近纯白且低饱和
  function isBgColor(px, o) {
    const r = px[o], g = px[o + 1], b = px[o + 2];
    if (r < 236 || g < 236 || b < 236) return false;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return (mx - mn) <= 22;
  }

  // 从四条边界洪水填充，把与边界连通的白色像素设为透明
  function floodRemove(px, w, h) {
    const N = w * h;
    const visited = new Uint8Array(N);
    const stack = new Int32Array(N);      // 用定长栈避免数组扩容开销
    let sp = 0;
    const push = (i) => { if (i >= 0 && i < N && !visited[i]) { visited[i] = 1; stack[sp++] = i; } };

    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }

    while (sp > 0) {
      const i = stack[--sp];
      const o = i * 4;
      if (!isBgColor(px, o)) continue;    // 碰到人物轮廓即停止
      px[o + 3] = 0;                       // 透明
      const x = i % w, y = (i / w) | 0;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (y > 0) push(i - w);
      if (y < h - 1) push(i + w);
    }
  }

  // 侵蚀 1~2 圈近白描边，消除白色光晕
  function erodeHalo(px, w, h, rings) {
    const N = w * h;
    for (let r = 0; r < rings; r++) {
      const clear = [];
      for (let i = 0; i < N; i++) {
        const o = i * 4;
        if (px[o + 3] === 0) continue;
        const R = px[o], G = px[o + 1], B = px[o + 2];
        if (Math.min(R, G, B) < 224) continue;         // 只处理近白像素
        const x = i % w, y = (i / w) | 0;
        const t =
          (x > 0 && px[(i - 1) * 4 + 3] === 0) ||
          (x < w - 1 && px[(i + 1) * 4 + 3] === 0) ||
          (y > 0 && px[(i - w) * 4 + 3] === 0) ||
          (y < h - 1 && px[(i + w) * 4 + 3] === 0);
        if (t) clear.push(i);
      }
      for (const i of clear) px[i * 4 + 3] = 0;
    }
  }

  // 边缘羽化：与透明相邻的不透明像素降一点 alpha，过渡更自然
  function feather(px, w, h) {
    const N = w * h;
    const soft = [];
    for (let i = 0; i < N; i++) {
      const o = i * 4;
      if (px[o + 3] === 0) continue;
      const x = i % w, y = (i / w) | 0;
      let tn = 0;
      if (x > 0 && px[(i - 1) * 4 + 3] === 0) tn++;
      if (x < w - 1 && px[(i + 1) * 4 + 3] === 0) tn++;
      if (y > 0 && px[(i - w) * 4 + 3] === 0) tn++;
      if (y < h - 1 && px[(i + w) * 4 + 3] === 0) tn++;
      if (tn > 0) soft.push([i, tn]);
    }
    for (const [i, tn] of soft) px[i * 4 + 3] = Math.round(255 * (1 - 0.22 * tn));
  }

  const Sprite = {
    canvas: null, w: 0, h: 0, ready: false, cutout: false,

    load(src, onready) {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0);
        try {
          const data = cx.getImageData(0, 0, w, h);
          floodRemove(data.data, w, h);
          erodeHalo(data.data, w, h, 2);
          feather(data.data, w, h);
          cx.putImageData(data, 0, 0);
          this.cutout = true;
        } catch (e) {
          // file:// 直接加载会污染画布导致抠图失败（仅浏览器预览时）——退回原图
          this.cutout = false;
        }
        this.canvas = cv; this.w = w; this.h = h; this.ready = true;
        onready && onready();
      };
      img.onerror = () => { onready && onready(new Error('image load failed')); };
      img.src = src;
    }
  };

  window.Sprite = Sprite;
})();
