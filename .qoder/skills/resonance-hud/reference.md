# Component recipes

Copy-paste implementations for components not covered in SKILL.md. All assume the token block from SKILL.md is present.

## Title bar (frameless window)

For Electron or any custom-chrome window. Diamond mark, bilingual title stack, close button.

```html
<div class="titlebar">
  <span class="diamond"></span>
  <span class="tt">
    <b>共鸣终端</b>
    <i>RESONANCE TERMINAL</i>
  </span>
  <button class="close" aria-label="关闭">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2.2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
  </button>
</div>
```

```css
.titlebar {
  position: relative;
  display: flex; align-items: center; gap: 10px;
  padding: 11px 8px 9px 16px;
  -webkit-app-region: drag;              /* Electron only */
}
.titlebar .tt { flex: 1; line-height: 1.15; }
.titlebar .tt b { font-size: 12.5px; font-weight: 600; letter-spacing: 1px; }
.titlebar .tt i {
  display: block; font-style: normal;
  font: 400 8.5px/1 var(--latin);
  letter-spacing: 2.4px; color: var(--gold-dim);
  margin-top: 2px;
}
.titlebar .close {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--cream-dim);
  transition: all .15s var(--ease);
  -webkit-app-region: no-drag;           /* Electron only */
}
.titlebar .close:hover { color: #ff6b5e; background: rgba(255,107,94,.12); }
```

Electron notes: set `frame: false` on the window, and `backgroundColor: '#14161a'` to avoid a white flash before first paint. Only add `transparent: true` if the panel actually needs non-rectangular edges — transparency forces per-pixel desktop compositing and costs real frame time on low-end GPUs.

## Page header

Large CJK name, tracked Latin subtitle, status line with a diamond indicator.

```html
<div class="head">
  <h1>穗穗</h1>
  <div class="sub">RESONATOR / ACTIVE</div>
  <div class="state"><s></s>参数即时同步 · 自动写入配置</div>
</div>
```

```css
.head { padding: 2px 2px 14px; }
.head h1 { font-size: 24px; font-weight: 700; letter-spacing: 3px; line-height: 1.2; }
.head .sub { font: 400 9px/1 var(--latin); letter-spacing: 3.4px; color: var(--gold); margin-top: 5px; }
.head .state {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--cream-dim); margin-top: 9px;
}
.head .state s {
  width: 4px; height: 4px; background: #6ee7a0;
  transform: rotate(45deg); text-decoration: none;
  box-shadow: 0 0 6px #6ee7a0;
}
```

Green `#6ee7a0` is the one permitted exception to the single-accent rule, reserved for live/synced status. Keep it at 4px.

## Item picker (avatar / character / preset grid)

Horizontal scroller. Selected item gets four brackets and a gold border. Each item carries its own `--c`.

```html
<div class="picker">
  <button class="item active" style="--c:#d9b45c">
    <span class="cn"></span><span class="cn"></span><span class="cn"></span><span class="cn"></span>
    <div class="thumb"><img src="a.png" alt="穗穗"></div>
    <div class="nm">穗穗</div>
  </button>
</div>
```

```css
.picker {
  display: flex; gap: 9px; overflow-x: auto;
  padding: 6px 4px 12px; margin: -6px -4px -12px;   /* see SKILL.md anti-patterns */
  scrollbar-width: none;
}
.picker::-webkit-scrollbar { display: none; }

.item {
  position: relative; flex: none;
  width: 84px; padding: 6px 6px 7px;
  background: rgba(0,0,0,.28);
  border: 1px solid rgba(255,255,255,.07);
  text-align: center; cursor: pointer;
  transition: all .2s var(--ease);
}
.item:hover { transform: translateY(-2px); border-color: rgba(201,172,103,.4); }
.item.active {
  border-color: var(--gold);
  background: rgba(201,172,103,.1);
  box-shadow: 0 0 0 1px rgba(201,172,103,.25), 0 6px 18px rgba(0,0,0,.5);
}

/* Four corner brackets, only on the active item */
.item .cn { position: absolute; width: 7px; height: 7px; border-color: var(--gold-bright); opacity: 0; transition: opacity .2s; }
.item.active .cn { opacity: 1; }
.item .cn:nth-of-type(1) { left: -1px;  top: -1px;    border-top: 1.5px solid;    border-left: 1.5px solid; }
.item .cn:nth-of-type(2) { right: -1px; top: -1px;    border-top: 1.5px solid;    border-right: 1.5px solid; }
.item .cn:nth-of-type(3) { left: -1px;  bottom: -1px; border-bottom: 1.5px solid; border-left: 1.5px solid; }
.item .cn:nth-of-type(4) { right: -1px; bottom: -1px; border-bottom: 1.5px solid; border-right: 1.5px solid; }

/* Content tint comes from --c, with a bottom vignette so labels stay readable */
.item .thumb {
  height: 86px; overflow: hidden;
  display: flex; align-items: flex-end; justify-content: center;
  background:
    linear-gradient(180deg, transparent 60%, rgba(0,0,0,.5)),
    linear-gradient(165deg, color-mix(in srgb, var(--c, var(--theme)) 32%, #12141a), #12141a);
}
.item img { max-width: 100%; max-height: 100%; object-fit: contain; pointer-events: none; }
.item .nm {
  font-size: 11.5px; letter-spacing: .5px; margin-top: 6px;
  color: var(--cream-dim);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.item.active .nm { color: var(--cream); font-weight: 600; }
```

## Toggle switch

Rectangular, not a pill. Off state is a dim cream block; on state is gold with bloom.

```html
<button class="switch" role="switch" aria-checked="true" aria-label="星光特效"></button>
```

```css
.switch {
  position: relative; flex: none;
  width: 44px; height: 20px;
  background: rgba(0,0,0,.45);
  border: 1px solid rgba(255,255,255,.14);
  cursor: pointer;
  transition: all .2s var(--ease);
}
.switch::after {
  content: '';
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 14px;
  background: rgba(250,250,233,.5);
  transition: transform .2s var(--ease), background .2s;
  /* Slanted knob. Safe without an outline: a solid fill defines its own edge. */
  clip-path: polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%);
}
.switch[aria-checked="true"] {
  border-color: var(--gold);
  background: rgba(201,172,103,.2);
  box-shadow: 0 0 12px rgba(201,172,103,.3);
}
.switch[aria-checked="true"]::after {
  transform: translateX(22px);
  background: var(--gold-bright);
}
```

```js
btn.onclick = () => btn.setAttribute('aria-checked', btn.getAttribute('aria-checked') !== 'true');
```

Drive state through `aria-checked` rather than a class — accessibility and styling from one source.

## Icon frame

Square gold-tinted frame for an inline SVG icon, used in list rows. Opposite corners chamfered.

```css
.icoframe {
  width: 34px; height: 34px; flex: none;
  display: flex; align-items: center; justify-content: center;
  color: var(--gold);
  background: rgba(201,172,103,.1);
  border: 1px solid var(--gold-dim);
  /* Top-left + bottom-right chamfer. The border is clipped along with the box,
     so it traces the diagonal automatically — no separate outline needed. */
  clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
}
```

## Segmented control with sliding indicator

The indicator is a separate absolutely-positioned element driven by `--i`, with a gold underline rather than a filled pill.

```html
<div class="seg">
  <span class="pill"></span>
  <button data-v="50">小</button>
  <button data-v="75">中</button>
  <button data-v="100" class="active">默认</button>
  <button data-v="130">大</button>
</div>
```

```css
.seg {
  position: relative;
  display: grid; grid-template-columns: repeat(4, 1fr);
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(0,0,0,.25);
}
.seg .pill {
  position: absolute; top: 0; bottom: 0; left: 0; width: 25%;
  background: rgba(201,172,103,.18);
  border-bottom: 1.5px solid var(--gold);
  transform: translateX(calc(var(--i, 0) * 100%));
  transition: transform .28s var(--ease), opacity .18s;
  pointer-events: none;
}
.seg button {
  position: relative;                    /* stack above the pill */
  padding: 6px 0; border: none; background: none;
  font: inherit; font-size: 12.5px; letter-spacing: 1px;
  color: var(--cream-dim); cursor: pointer;
  transition: color .18s var(--ease);
}
.seg button:hover { color: var(--cream); }
.seg button.active { color: var(--gold-bright); font-weight: 600; }
```

```js
// Fade the indicator out when the current value matches no segment
const i = buttons.findIndex(b => Number(b.dataset.v) === value);
pill.style.opacity = i < 0 ? '0' : '1';
if (i >= 0) pill.style.setProperty('--i', i);
```

Width must be `100% / n` and the grid must have no `gap`, otherwise `translateX(i * 100%)` drifts.

## Footer ornament

```html
<div class="foot">
  <span class="dots"><i></i><i></i><i></i><i></i><i></i><i></i></span>
  ESC TO CLOSE · DRAG TO MOVE
  <span class="dots mirror"><i></i><i></i><i></i><i></i><i></i><i></i></span>
</div>
```

```css
.foot {
  display: flex; align-items: center; justify-content: center; gap: 9px;
  padding-top: 10px;
  font: 400 8.5px/1 var(--latin);
  letter-spacing: 2px; color: var(--cream-dim);
}
```

## Hairline divider with node

For separating rows inside a card.

```css
.divider {
  position: relative;
  height: 1px; margin: 12px 0;
  background: linear-gradient(90deg, transparent, var(--hair) 20%, var(--hair) 80%, transparent);
}
.divider::after {
  content: '';
  position: absolute; left: 50%; top: -2.5px;
  width: 5px; height: 5px; margin-left: -2.5px;
  background: var(--gold-dim); transform: rotate(45deg);
}
```

## Panel-edge chamfer (optional, use with care)

Component-level chamfers (icon frames, toggle knobs) are safe and encouraged — see above. This section is about cutting the corner of a large **borderless** surface, which needs extra work.

```css
.panel--chamfer {
  clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%);
}
/* Outline along the diagonal: length 18√2 ≈ 25.5px, 2px thick so clip-path
   trims the outer half and leaves a clean 1px edge */
.chamfer-line {
  position: absolute; top: 9px; right: -3.75px;
  width: 25.5px; height: 2px;
  background: var(--gold);
  transform: rotate(45deg);
  pointer-events: none; z-index: 3;
}
```

Also shorten the panel's top hairline to `right: 18px` so it stops where the cut begins. In Electron the window needs `transparent: true` for the cut to show through.

## Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: .01ms !important; animation-duration: .01ms !important; }
}
```
