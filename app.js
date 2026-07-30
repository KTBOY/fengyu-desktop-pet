/* app.js —— 基于真实立绘的桌宠：呼吸/摆动/鼠标跟随倾斜/点击弹跳/星光粒子 + 交互 */
(function () {
  'use strict';

  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const bubble = document.getElementById('bubble');

  // 逻辑尺寸（= CSS 像素），高分屏按 dpr 放大画布后备缓冲
  const W = 450, H = 640;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const FIT = 0.93;                 // 立绘相对画布的占比（留出呼吸/旋转余量）
  let baseScale = 1, drawW = 0, drawH = 0;
  let scaledSprite = null;          // 预缩放到显示尺寸的立绘位图（避免每帧缩放大图）
  const cx = W / 2, groundY = H - 6;

  // ---------- 星光粒子 ----------
  const sparks = [];
  for (let i = 0; i < 16; i++) {
    sparks.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 1.2 + Math.random() * 2.6,
      sp: 0.15 + Math.random() * 0.5,
      ph: Math.random() * Math.PI * 2,
      drift: (Math.random() - 0.5) * 0.25
    });
  }
  const burst = [];                 // 点击迸发的爱心/星星

  function drawStar(x, y, z, alpha, color) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - z * 2);
    ctx.quadraticCurveTo(x + z * 0.5, y - z * 0.5, x + z * 2, y);
    ctx.quadraticCurveTo(x + z * 0.5, y + z * 0.5, x, y + z * 2);
    ctx.quadraticCurveTo(x - z * 0.5, y + z * 0.5, x - z * 2, y);
    ctx.quadraticCurveTo(x - z * 0.5, y - z * 0.5, x, y - z * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function drawHeart(x, y, z, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#e86a7c';
    ctx.beginPath();
    ctx.moveTo(x, y + z);
    ctx.bezierCurveTo(x - z * 1.4, y - z * 0.4, x - z * 0.6, y - z * 1.5, x, y - z * 0.5);
    ctx.bezierCurveTo(x + z * 0.6, y - z * 1.5, x + z * 1.4, y - z * 0.4, x, y + z);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---------- 状态 ----------
  let clickT = -1e9;
  let leanTarget = 0, lean = 0;     // 鼠标跟随倾斜
  let hoverGlow = 0;
  let dragging = false;             // 供动画循环判断是否处于拖拽（跳过重绘）
  let accumDX = 0, accumDY = 0;     // 累计的拖拽位移，按帧合并后发送给主进程

  function computeLayout() {
    baseScale = Math.min((W * FIT) / Sprite.w, (H * FIT) / Sprite.h);
    drawW = Sprite.w * baseScale;
    drawH = Sprite.h * baseScale;
    // 预缩放：把 1280x1822 大图一次性缩到显示尺寸，之后每帧只画这张小图
    const sw = Math.max(1, Math.round(drawW));
    const sh = Math.max(1, Math.round(drawH));
    scaledSprite = document.createElement('canvas');
    scaledSprite.width = sw;
    scaledSprite.height = sh;
    const sctx = scaledSprite.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(Sprite.canvas, 0, 0, sw, sh);
  }

  function loop(now) {
    requestAnimationFrame(loop);

    // 拖拽中：只把本帧累计位移发给主进程（合并多次 pointermove），跳过重绘，
    // 让合成器专心平滑移动窗口，画面保留上一帧随窗口一起走。
    if (dragging) {
      if ((accumDX || accumDY) && window.petAPI) {
        window.petAPI.dragMove(accumDX, accumDY);
        accumDX = 0; accumDY = 0;
      }
      return;
    }

    ctx.clearRect(0, 0, W, H);
    if (!Sprite.ready || !scaledSprite) return;

    const breath = Math.sin(now / 1500);
    const sX = 1 - breath * 0.006;
    const sY = 1 + breath * 0.010;
    const bob = breath * 2.2;
    lean += (leanTarget - lean) * 0.08;
    let rot = Math.sin(now / 2100) * 0.012 + lean;

    // 点击弹跳（阻尼正弦）
    const dt = (now - clickT) / 1000;
    let squash = 0;
    if (dt >= 0 && dt < 1.3) squash = Math.exp(-dt * 7) * Math.sin(dt * 22) * 0.13;
    const scaleX = sX * (1 - squash * 0.7);
    const scaleY = sY * (1 + squash);

    // 地面阴影（随呼吸缩放）
    ctx.save();
    ctx.fillStyle = 'rgba(70,55,30,0.16)';
    const shW = drawW * 0.34 * (1 - squash * 0.5);
    ctx.beginPath();
    ctx.ellipse(cx, groundY - 2, shW, drawW * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 立绘：以底部中心为锚点，做呼吸缩放 + 轻微旋转（画预缩放小图）
    ctx.save();
    ctx.translate(cx, groundY - bob);
    ctx.rotate(rot);
    ctx.scale(scaleX, scaleY);
    if (hoverGlow > 0.01) {
      ctx.shadowColor = 'rgba(255,224,150,' + (0.5 * hoverGlow) + ')';
      ctx.shadowBlur = 26 * hoverGlow;
    }
    ctx.drawImage(scaledSprite, -drawW / 2, -drawH, drawW, drawH);
    ctx.restore();
    hoverGlow += ((dt < 0.6 ? 1 : 0) - hoverGlow) * 0.12;

    // 环绕星光
    for (const s of sparks) {
      s.y -= s.sp; s.x += s.drift;
      if (s.y < -6) { s.y = H + 6; s.x = Math.random() * W; }
      const tw = 0.35 + 0.65 * (0.5 + Math.sin(now / 380 + s.ph) / 2);
      drawStar(s.x, s.y, s.r * (0.7 + tw * 0.5), tw * 0.85, '#ffe79c');
    }

    // 点击迸发粒子
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.life -= 0.016;
      if (p.life <= 0) { burst.splice(i, 1); continue; }
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.99;
      const a = Math.max(0, Math.min(1, p.life));
      if (p.heart) drawHeart(p.x, p.y, 6 + (1 - a) * 4, a);
      else drawStar(p.x, p.y, 3 + (1 - a) * 3, a, '#ffd76a');
    }
  }

  // ---------- 台词气泡 ----------
  const LINES = [
    '今天也要元气满满哦～', '呼呼，摸鱼被我发现啦！', '要不要一起喝杯茶？',
    '我在这里陪着你～', '记得多喝水、少熬夜！', '风起了，我的羽毛在跳舞',
    '拖着我到处走走吧！', '嘻嘻，被你戳到痒痒啦', '专注一点，你可以的！'
  ];
  let bubbleTimer = 0;
  function say(text, ms) {
    bubble.textContent = text;
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms || 2600);
  }
  function sayRandom() { say(LINES[(Math.random() * LINES.length) | 0]); }

  function spawnBurst() {
    const bx = cx, by = groundY - drawH * 0.62;
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const spd = 1.6 + Math.random() * 2.4;
      burst.push({
        x: bx + (Math.random() - 0.5) * 30, y: by + (Math.random() - 0.5) * 30,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: 0.9 + Math.random() * 0.5, heart: Math.random() < 0.45
      });
    }
  }

  // ---------- 交互 ----------
  let suppressClick = false, downX = 0, downY = 0;

  // 使用指针捕获：按下后即使光标短暂跑出窗口，pointermove/up 仍持续触发，拖拽不脱手
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true; suppressClick = false;
    accumDX = 0; accumDY = 0;
    downX = e.screenX; downY = e.screenY;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) {
      // 累计光标位移（CSS 像素=DIP，与主进程 setPosition 一致），由动画循环按帧合并发送
      accumDX += e.movementX;
      accumDY += e.movementY;
      return;
    }
    const r = canvas.getBoundingClientRect();
    const nx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    leanTarget = Math.max(-1, Math.min(1, nx)) * 0.05;   // 朝鼠标方向轻微倾斜
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    // 冲掉最后一段位移，避免松手瞬间丢帧
    if ((accumDX || accumDY) && window.petAPI) { window.petAPI.dragMove(accumDX, accumDY); accumDX = 0; accumDY = 0; }
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    // 松开位置与按下位置相差较大 → 判定为拖拽，抑制随后的 click 互动
    if (Math.hypot(e.screenX - downX, e.screenY - downY) > 5) {
      suppressClick = true;
      say('到这里休息一下～', 1600);
    }
  });
  canvas.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    clickT = performance.now();
    spawnBurst();
    sayRandom();
  });
  canvas.addEventListener('dblclick', () => {
    clickT = performance.now();
    spawnBurst();
    say('哇！你戳我两下～最喜欢你了！', 2600);
  });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (window.petAPI) window.petAPI.showContextMenu();
  });
  canvas.addEventListener('pointerleave', () => { if (!dragging) leanTarget = 0; });

  // 键盘快捷键：Esc / Ctrl+Q 退出
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || (e.ctrlKey && (e.key === 'q' || e.key === 'Q'))) {
      if (window.petAPI) window.petAPI.quit();
    }
  });

  setInterval(() => { if (Math.random() < 0.5) sayRandom(); }, 18000);

  // ---------- 启动 ----------
  const src = (window.petAPI && window.petAPI.spriteDataURL) ? window.petAPI.spriteDataURL : 'assets/char.png';
  Sprite.load(src, (err) => {
    if (err) { say('立绘加载失败：找不到 assets/char.png', 6000); return; }
    computeLayout();
    setTimeout(() => say('你好呀，我来啦～', 3000), 600);
  });
  requestAnimationFrame(loop);
})();
