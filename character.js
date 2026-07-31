/**
 * character.js —— 精灵图加载 + Canvas 边缘洪水填充抠图（去白底，保留人物内部白色）
 * 性能要点：
 *  1) 像素处理放入 Web Worker，主线程不再被 200 万像素的抠图卡死（启动秒开）；
 *  2) 处理结果按 src 缓存，多角色共用同一张立绘时切换零成本；
 *  3) Worker 不可用时退回主线程同步处理，行为与旧版一致。
 * 对外暴露 window.Sprite
 */
(function () {
  'use strict';

  // ---------- 像素处理核心（同一份实现：Worker 内与主线程兜底共用） ----------

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
  // 用整幅 Uint8Array 记邻接数（旧版给每个边缘像素 new 一个小数组，触发大量 GC）
  function feather(px, w, h) {
    const N = w * h;
    const tn = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const o = i * 4;
      if (px[o + 3] === 0) continue;
      const x = i % w, y = (i / w) | 0;
      let t = 0;
      if (x > 0 && px[(i - 1) * 4 + 3] === 0) t++;
      if (x < w - 1 && px[(i + 1) * 4 + 3] === 0) t++;
      if (y > 0 && px[(i - w) * 4 + 3] === 0) t++;
      if (y < h - 1 && px[(i + w) * 4 + 3] === 0) t++;
      tn[i] = t;
    }
    for (let i = 0; i < N; i++) {
      if (tn[i]) px[i * 4 + 3] = Math.round(255 * (1 - 0.22 * tn[i]));
    }
  }

  function processPixels(px, w, h) {
    floodRemove(px, w, h);
    erodeHalo(px, w, h, 2);
    feather(px, w, h);
  }

  // ---------- Worker：用函数源码拼脚本，保持单一实现 ----------
  let worker;                         // undefined=未创建 null=不可用
  const pending = [];                 // FIFO 回调队列（Worker 消息按提交顺序返回）
  function getWorker() {
    if (worker !== undefined) return worker;
    try {
      const src = [isBgColor, floodRemove, erodeHalo, feather, processPixels]
        .map((f) => f.toString()).join('\n') +
        '\nself.onmessage = function (e) {' +
        '  var px = new Uint8ClampedArray(e.data.buf);' +
        '  processPixels(px, e.data.w, e.data.h);' +
        '  self.postMessage({ buf: px.buffer }, [px.buffer]);' +
        '};';
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = (e) => { const cb = pending.shift(); cb && cb(e.data); };
    } catch (e) { worker = null; }
    return worker;
  }

  const cache = new Map();            // src -> { canvas, w, h, cutout }

  const Sprite = {
    canvas: null, w: 0, h: 0, ready: false, cutout: false,

    _apply(entry, onready) {
      this.canvas = entry.canvas; this.w = entry.w; this.h = entry.h;
      this.cutout = entry.cutout; this.ready = true;
      onready && onready();
    },

    load(src, onready) {
      const hit = cache.get(src);     // 同图秒回：两个角色共用一张立绘时切换不再重算
      if (hit) { this._apply(hit, onready); return; }

      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0);

        const done = (cutout) => {
          const entry = { canvas: cv, w, h, cutout };
          cache.set(src, entry);
          this._apply(entry, onready);
        };

        let data;
        try {
          data = cx.getImageData(0, 0, w, h);
        } catch (e) {
          // file:// 直接加载会污染画布导致抠图失败（仅浏览器预览时）——退回原图
          done(false);
          return;
        }

        const wk = getWorker();
        if (wk) {
          // 转移 buffer 零拷贝送入 Worker，处理完再写回；主线程全程不阻塞
          pending.push((res) => {
            cx.putImageData(new ImageData(new Uint8ClampedArray(res.buf), w, h), 0, 0);
            done(true);
          });
          wk.postMessage({ buf: data.data.buffer, w, h }, [data.data.buffer]);
        } else {
          processPixels(data.data, w, h);
          cx.putImageData(data, 0, 0);
          done(true);
        }
      };
      img.onerror = () => { onready && onready(new Error('image load failed')); };
      img.src = src;
    }
  };

  window.Sprite = Sprite;
})();
