/* app.js —— 基于真实立绘的桌宠：呼吸/摆动/鼠标跟随倾斜/点击弹跳/星光粒子 + 交互 */
(function () {
  'use strict';

  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const bubble = document.getElementById('bubble');

  // 逻辑尺寸（= CSS 像素），高分屏按 dpr 放大画布后备缓冲
  const BASE_W = 450, BASE_H = 640;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let scale = 1;
  let W = BASE_W, H = BASE_H;
  let cx = W / 2, groundY = H - 6;
  let bubbleZone = 62;              // 顶部气泡预留区高度，由主进程下发（窗口高度已含这段）
  let stageH = BASE_H;              // 扣掉气泡区后留给人物的高度

  const FIT = 0.93;                 // 立绘相对人物区的占比（留出呼吸/旋转余量）
  let baseScale = 1, drawW = 0, drawH = 0;
  let scaledSprite = null;          // 预缩放到显示尺寸的立绘位图（避免每帧缩放大图）
  let rescaleTimer = 0;

  // ---------- 星光粒子 ----------
  const sparks = [];
  for (let i = 0; i < 8; i++) {          // 8 颗足够营造氛围，逐帧贝塞尔绘制成本减半（低配机友好）
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

  // ---------- 主题 / 台词（随角色切换）----------
  const DEFAULT_THEME = {
    primary: '#d9b45c', primaryDark: '#c9932f', ink: '#6b4a1f', sub: '#a08050',
    panelBg1: '#fffdf7', panelBg2: '#fdf3dd', bubbleBg: 'rgba(255,252,245,0.96)',
    track1: '#e8c979', track2: '#d9b45c',
    spark: '#ffe79c', heart: '#e86a7c', burst: '#ffd76a', glow: '255,224,150'
  };
  // 特效颜色（供 canvas 逐帧绘制读取，非 CSS）
  const fx = { spark: DEFAULT_THEME.spark, heart: DEFAULT_THEME.heart, burst: DEFAULT_THEME.burst, glow: DEFAULT_THEME.glow };
  const DEFAULT_LINES = [
    '今天也要元气满满哦～', '呼呼，摸鱼被我发现啦！', '要不要一起喝杯茶？',
    '我在这里陪着你～', '记得多喝水、少熬夜！', '风起了，我的羽毛在跳舞',
    '拖着我到处走走吧！', '嘻嘻，被你戳到痒痒啦', '专注一点，你可以的！'
  ];
  let lines = DEFAULT_LINES;

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
    ctx.fillStyle = fx.heart;
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
  let effectsOn = true;             // 环绕星光开关（不影响点击迸发的爱心/星星）

  function computeLayout(immediate) {
    baseScale = Math.min((W * FIT) / Sprite.w, (stageH * FIT) / Sprite.h);
    drawW = Sprite.w * baseScale;
    drawH = Sprite.h * baseScale;
    // 拖动缩放滑块时会连续触发，合并后再重缩大图；期间沿用旧位图按新尺寸拉伸，只是略软
    if (immediate || !scaledSprite) rebuildScaledSprite();
    else {
      clearTimeout(rescaleTimer);
      rescaleTimer = setTimeout(rebuildScaledSprite, 80);
    }
  }

  // 高质量降采样：单步把 1280x1822 直缩到小尺寸会丢细节发糊，先逐级减半再定最终尺寸
  function downscale(src, dw, dh) {
    let cur = src, cw = src.width, ch = src.height;
    while (cw > dw * 2 && ch > dh * 2) {
      const nw = Math.max(dw, cw >> 1), nh = Math.max(dh, ch >> 1);
      const half = document.createElement('canvas');
      half.width = nw; half.height = nh;
      const hctx = half.getContext('2d');
      hctx.imageSmoothingEnabled = true;
      hctx.imageSmoothingQuality = 'high';
      hctx.drawImage(cur, 0, 0, nw, nh);
      cur = half; cw = nw; ch = nh;
    }
    const out = document.createElement('canvas');
    out.width = dw; out.height = dh;
    // 不能带 willReadFrequently：该画布是每帧 drawImage 的源，
    // 这个标志会把它固定在 CPU 软件后端，每帧都要重新上传 GPU，丢掉硬件加速
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(cur, 0, 0, dw, dh);
    return out;
  }

  // 轻度锐化补偿降采样的软化；邻域按 alpha 加权，避免把透明区的白底混进轮廓形成白边
  function sharpen(cv, amount) {
    const w = cv.width, h = cv.height;
    if (w < 3 || h < 3 || amount <= 0) return cv;
    const c = cv.getContext('2d', { willReadFrequently: true });
    const img = c.getImageData(0, 0, w, h);
    const src = img.data;
    const out = new Uint8ClampedArray(src);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        if (src[i + 3] === 0) continue;
        let sr = 0, sg = 0, sb = 0, sa = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const j = i + (dy * w + dx) * 4;
            const wa = src[j + 3];
            sr += src[j] * wa; sg += src[j + 1] * wa; sb += src[j + 2] * wa; sa += wa;
          }
        }
        if (sa === 0) continue;
        out[i]     = src[i]     + amount * (src[i]     - sr / sa);
        out[i + 1] = src[i + 1] + amount * (src[i + 1] - sg / sa);
        out[i + 2] = src[i + 2] + amount * (src[i + 2] - sb / sa);
      }
    }
    img.data.set(out);
    c.putImageData(img, 0, 0);
    return cv;
  }

  function rebuildScaledSprite() {
    if (!Sprite.ready) return;
    // 按物理像素生成（含 dpr）：画布已带 dpr 变换，若只做 CSS 尺寸会被再上采样一次而发虚
    const sw = Math.max(1, Math.round(drawW * dpr));
    const sh = Math.max(1, Math.round(drawH * dpr));
    scaledSprite = downscale(Sprite.canvas, sw, sh);
    // 缩得越小锐化越强，抵消细节丢失；原尺寸附近不处理，避免过冲出现描边感
    sharpen(scaledSprite, Math.min(0.35, Math.max(0, (1 - sw / Sprite.w) * 0.45)));
  }

  // 按窗口实际内容尺寸重建画布与布局；窗口尺寸由主进程按缩放比例设定，这里只跟随，
  // 避免两边各算一套导致失配（人物区 = 窗口高 - 顶部气泡预留区）
  function relayout(force) {
    const prevW = W, prevH = H;
    const nw = Math.max(1, window.innerWidth);
    const nh = Math.max(1, window.innerHeight);
    if (!force && nw === W && nh === H && scaledSprite) return;

    W = nw; H = nh;
    // 真实缩放按"高度"反推：窗口宽度在小尺寸下有最小值下限，用宽度反推会偏大
    scale = (H - bubbleZone) / BASE_H;
    stageH = Math.max(40, H - bubbleZone);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // 改后备缓冲尺寸会重置变换，须重新按 dpr 缩放
    cx = W / 2;
    groundY = H - 6;

    // 星光按新旧画布比例重映射，避免缩小后粒子滞留在视野外
    for (const s of sparks) { s.x *= W / prevW; s.y *= H / prevH; }

    // 气泡：字号随缩放收窄但上下都要封顶——下限 12px 保可读，
    // 上限 16px 保证两行总高不超出 BUBBLE_ZONE（否则大缩放下第二行被窗口裁掉）；
    // 宽度尽量用满窗口（窗口已保证最小宽度），行数由 CSS 限制为最多 2 行
    bubble.style.fontSize = Math.min(16, Math.max(12, Math.round(14 * scale))) + 'px';
    bubble.style.maxWidth = Math.max(80, W - 16) + 'px';

    if (Sprite.ready) computeLayout();

    // 改 canvas.width 的瞬间画布已被清空，若等下一个 rAF 才重绘，
    // 透明窗口会露出 1~2 帧空白（拖动缩放滑杆时表现为人物闪烁）。
    // 这里同步补画一帧堵住间隙；期间沿用旧位图按新尺寸拉伸，只是略软
    lastLayoutT = performance.now();
    render(lastLayoutT, 1);
  }

  window.addEventListener('resize', () => relayout());

  let skipToggle = false;           // 空闲隔帧渲染的翻转标记
  let lastLayoutT = -1e9;           // 最近一次画布重建时刻（relayout 补帧用）

  function loop(now) {
    requestAnimationFrame(loop);

    // 拖拽中：把本帧累计位移合并后发给主进程移动窗口。
    // 注意仍要照常重绘——透明无边框窗口在移动时不保证保留上一帧画布内容，
    // 若此时跳过重绘，移动过程中窗口会显示为空白，导致人物"消失"。
    if (dragging && (accumDX || accumDY) && window.petAPI) {
      window.petAPI.dragMove(accumDX, accumDY);
      accumDX = 0; accumDY = 0;
    }

    // 空闲判定：无拖拽/无迸发粒子/无光晕/倾斜已收敛/弹跳已结束 → 隔帧渲染（约 30fps）。
    // 额外要求"布局最近没变过"：缩放滑杆拖动期间窗口连续 resize，
    // 每次 resize 都会清空画布，此时跳帧会让空白帧被合成器显示出来（人物闪烁）
    const dt = (now - clickT) / 1000;
    const idle = !dragging && burst.length === 0 && hoverGlow === 0 &&
                 lean === leanTarget && dt > 1.3 &&
                 now - lastLayoutT > 600;
    if (idle && (skipToggle = !skipToggle)) return;
    render(now, idle ? 2 : 1);
  }

  // 单帧绘制；loop 按帧率策略调用，relayout 在画布重建后也会直接补一帧
  function render(now, step) {
    const dt = (now - clickT) / 1000;

    ctx.clearRect(0, 0, W, H);
    if (!Sprite.ready || !scaledSprite) return;

    const breath = Math.sin(now / 1500);
    const sX = 1 - breath * 0.006;
    const sY = 1 + breath * 0.010;
    const bob = breath * 2.2;
    lean += (leanTarget - lean) * 0.08;
    if (Math.abs(leanTarget - lean) < 0.0005) lean = leanTarget;   // 收敛后取等，供空闲判定
    let rot = Math.sin(now / 2100) * 0.012 + lean;

    // 点击弹跳（阻尼正弦）
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
      ctx.shadowColor = 'rgba(' + fx.glow + ',' + (0.5 * hoverGlow) + ')';
      ctx.shadowBlur = 26 * hoverGlow;
    }
    ctx.drawImage(scaledSprite, -drawW / 2, -drawH, drawW, drawH);
    ctx.restore();
    hoverGlow += ((dt < 0.6 ? 1 : 0) - hoverGlow) * 0.12;
    if (dt >= 0.6 && hoverGlow < 0.02) hoverGlow = 0;   // 指数逼近永远到不了 0，主动归零以彻底关掉 shadowBlur

    // 环绕星光
    if (effectsOn) {
      for (const s of sparks) {
        s.y -= s.sp * step; s.x += s.drift * step;
        if (s.y < -6) { s.y = H + 6; s.x = Math.random() * W; }
        const tw = 0.35 + 0.65 * (0.5 + Math.sin(now / 380 + s.ph) / 2);
        drawStar(s.x, s.y, s.r * (0.7 + tw * 0.5), tw * 0.85, fx.spark);
      }
    }

    // 点击迸发粒子
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.life -= 0.016;
      if (p.life <= 0) { burst.splice(i, 1); continue; }
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.99;
      const a = Math.max(0, Math.min(1, p.life));
      if (p.heart) drawHeart(p.x, p.y, 6 + (1 - a) * 4, a);
      else drawStar(p.x, p.y, 3 + (1 - a) * 3, a, fx.burst);
    }
  }

  // ---------- 台词气泡 ----------
  let bubbleTimer = 0;
  function say(text, ms) {
    bubble.textContent = text;
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms || 2600);
  }
  function sayRandom() { say(lines[(Math.random() * lines.length) | 0]); }

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

  // 键盘快捷键：Esc / Ctrl+Q 退出，Ctrl+, 打开设置
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || (e.ctrlKey && (e.key === 'q' || e.key === 'Q'))) {
      if (window.petAPI) window.petAPI.quit();
    } else if (e.ctrlKey && e.key === ',') {
      if (window.petAPI && window.petAPI.openSettings) window.petAPI.openSettings();
    }
  });

  setInterval(() => { if (Math.random() < 0.5) sayRandom(); }, 18000);

  // 应用主进程下发的设置，只处理发生变化的项
  function applySettings(cfg) {
    if (!cfg) return;
    if (cfg.effects != null) effectsOn = !!cfg.effects;
    if (cfg.bubbleZone != null && cfg.bubbleZone !== bubbleZone) {
      bubbleZone = cfg.bubbleZone;
      relayout(true);                 // 预留区变了要重算人物区
    } else {
      relayout();                     // 尺寸未变时内部会早退
    }
  }

  // 应用角色主题：写入 CSS 变量（气泡）+ 更新特效色（canvas 用）
  function applyTheme(theme) {
    const t = Object.assign({}, DEFAULT_THEME, theme || {});
    const rs = document.documentElement.style;
    rs.setProperty('--bubble-bg', t.bubbleBg);
    rs.setProperty('--primary', t.primary);
    rs.setProperty('--ink', t.ink);
    fx.spark = t.spark; fx.heart = t.heart; fx.burst = t.burst; fx.glow = t.glow;
  }

  // 切换 / 初次加载角色：换主题 → 换台词 → 重载立绘 → 重算布局
  function applyCharacter(char, mode) {
    if (!char) { fallbackLoad(); return; }
    applyTheme(char.theme);
    lines = (Array.isArray(char.lines) && char.lines.length) ? char.lines : DEFAULT_LINES;
    Sprite.load(char.imageDataURL || 'assets/char.png', (err) => {
      if (err) { say('立绘加载失败', 4000); return; }
      computeLayout(true);
      if (mode === 'switch') setTimeout(() => say('我换了个模样，好看吗～', 2400), 150);
      else if (mode === 'hello') setTimeout(() => say('你好呀，我来啦～', 3000), 600);
    });
  }

  function fallbackLoad() {   // 非 Electron 预览或无角色数据时的兜底
    Sprite.load('assets/char.png', (err) => {
      if (err) { say('立绘加载失败：找不到 assets/char.png', 6000); return; }
      computeLayout(true);
      setTimeout(() => say('你好呀，我来啦～', 3000), 600);
    });
  }

  // ---------- 启动 ----------
  relayout(true);
  if (window.petAPI) {
    if (window.petAPI.onSettingsChanged) window.petAPI.onSettingsChanged(applySettings);
    if (window.petAPI.getSettings) window.petAPI.getSettings().then(applySettings).catch(() => {});
    if (window.petAPI.onCharacterChanged) window.petAPI.onCharacterChanged((c) => applyCharacter(c, 'switch'));
    if (window.petAPI.getCurrentCharacter) {
      window.petAPI.getCurrentCharacter().then((c) => applyCharacter(c, 'hello')).catch(fallbackLoad);
    } else {
      fallbackLoad();
    }
  } else {
    fallbackLoad();
  }
  requestAnimationFrame(loop);
})();
