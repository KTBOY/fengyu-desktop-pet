---
name: resonance-hud
description: Applies a dark-gold game HUD design language to web interfaces — near-black base, single brand-gold accent, hairline borders, pure right angles, L-shaped corner brackets, bilingual CJK/Latin section labels, diamond nodes and dotted-bracket ornaments. Use when building game-style or tech-noir UI, settings panels, overlays, launchers, HUD dashboards, desktop pet/companion apps, or when the user asks for a "鸣潮 / Wuthering Waves 风格", "游戏 HUD 风格", "深色金调", "二次元科技感" interface. Vanilla CSS variables and HTML, no framework or asset dependencies.
---

# Resonance HUD

A design language for dark, gold-accented game HUD interfaces. Every ornament is drawn with CSS or inline SVG — no image assets, no web fonts, crisp at any DPI.

## When to use

Fits: settings panels, overlays, launchers, HUD dashboards, character/inventory pickers, desktop companion apps, anything that should feel like an in-game terminal.

Does not fit: content-heavy reading interfaces, forms with many inputs, light-theme products, anything needing a friendly/soft tone. The palette is high-contrast and the ornaments compete with dense text.

## Design tokens

Copy verbatim. These values are sampled from a shipped product, not invented — do not "improve" the hues.

```css
:root {
  /* Brand — fixed, never themed per-user or per-content */
  --gold:        #c9ac67;
  --gold-bright: #e6cf95;
  --gold-dim:    rgba(201, 172, 103, .3);

  /* Text */
  --cream:     #fafae9;
  --cream-dim: rgba(250, 250, 233, .45);

  /* Surfaces */
  --bg-0: #14161a;                       /* deepest */
  --bg-1: #1b1e23;                       /* panel top */
  --card: rgba(255, 255, 255, .035);      /* card fill — translucent, not solid */
  --hair: rgba(201, 172, 103, .2);        /* hairline border */

  /* Accent slot — the ONE token allowed to change with content */
  --theme: #d9b45c;

  --ease:  cubic-bezier(.32,.72,.24,1);
  --latin: "Bahnschrift", "DIN Alternate", "Segoe UI", sans-serif;
}
```

`--latin` matters: the wide-tracked Latin labels need a condensed technical face. `Bahnschrift` ships with Windows 10+, `DIN Alternate` with macOS. Never substitute a humanist sans.

## Panel base

```css
.panel {
  position: relative;
  background:
    radial-gradient(130% 80% at 100% 0%, rgba(201,172,103,.11), transparent 62%),
    linear-gradient(168deg, var(--bg-1), var(--bg-0) 62%);
  box-shadow: 0 20px 60px rgba(0,0,0,.6);
  overflow: hidden;
}
/* Diagonal scanline texture — 2.2% opacity, texture only, must not read as stripes */
.panel::before {
  content: '';
  position: absolute; inset: 0;
  background: repeating-linear-gradient(115deg,
    rgba(255,255,255,.022) 0 1px, transparent 1px 5px);
  pointer-events: none;
}
/* Gold hairline along the top edge */
.panel::after {
  content: '';
  position: absolute; left: 0; right: 0; top: 0; height: 1px;
  background: linear-gradient(90deg, var(--gold), rgba(201,172,103,.35));
  pointer-events: none; z-index: 3;
}
```

The off-center radial glow (anchored top-right) plus the top hairline is what separates this from generic dark mode. Keep both.

## Six signature elements

Use at least four. All six is not too many — the density is the point.

### 1. Corner brackets

The load-bearing element. L-shaped gold marks on opposite corners of every card.

```css
.card { position: relative; background: var(--card); border: 1px solid var(--hair); padding: 13px 14px; }
.card::before, .card::after {
  content: ''; position: absolute;
  width: 9px; height: 9px;
  border-color: var(--gold); pointer-events: none;
}
.card::before { left: -1px;  top: -1px;    border-top: 1.5px solid; border-left: 1.5px solid; }
.card::after  { right: -1px; bottom: -1px; border-bottom: 1.5px solid; border-right: 1.5px solid; }
```

`-1px` offsets so brackets sit on top of the 1px border rather than inside it. For selected/active states, light all four corners with `--gold-bright`.

### 2. Bilingual section header

CJK title, connecting rule, wide-tracked uppercase Latin. The size ratio is not adjustable: CJK 13px semibold, Latin 8.5px with 2.2px tracking.

```html
<div class="card-head">
  <span class="mk"></span>
  <span class="zh">共鸣者</span>
  <span class="ln"></span>
  <span class="en">RESONATOR</span>
</div>
```

```css
.card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.card-head .mk { width: 3px; height: 12px; background: var(--gold); flex: none; }
.card-head .zh { font-size: 13px; font-weight: 600; letter-spacing: 1.5px; }
.card-head .ln { flex: 1; height: 1px; background: linear-gradient(90deg, var(--gold-dim), transparent); }
.card-head .en { font: 400 8.5px/1 var(--latin); letter-spacing: 2.2px; color: var(--gold-dim); }
```

The Latin label is decoration with a job: it names the domain concept. Translate the meaning, do not transliterate — 人物大小 becomes `SCALE`, not `RENWU DAXIAO`.

### 3. Diamond nodes

45°-rotated squares replace dots, bullets and slider thumbs.

```css
.diamond {
  width: 9px; height: 9px;
  background: var(--gold); transform: rotate(45deg);
  box-shadow: 0 0 8px rgba(201,172,103,.7);
}
```

### 4. Oversized numeric readout

Any numeric value gets promoted to a hero element in Latin mono-ish type with a gold bloom.

```css
.readout {
  font: 700 32px/1 var(--latin);
  color: var(--gold-bright); letter-spacing: 1px;
  text-shadow: 0 0 18px rgba(201,172,103,.45);
}
.readout small { font-size: 13px; margin-left: 2px; color: var(--gold-dim); }
```

### 5. Dotted bracket ornaments

2×3 dot grids flanking a centered label. Mirror the right one with `scaleX(-1)`.

```css
.dots {
  display: grid;
  grid-template-columns: 2px 2px; grid-template-rows: 2px 2px 2px;
  gap: 1.5px; opacity: .55;
}
.dots i { background: var(--gold); }
.dots.mirror { transform: scaleX(-1); }
```

### 6. Angular slider

Thin track, diamond thumb, gold fill driven by a `--pct` variable set from JS.

```css
input[type=range] {
  width: 100%; height: 22px;
  -webkit-appearance: none; background: transparent; display: block; cursor: pointer;
}
input[type=range]::-webkit-slider-runnable-track {
  height: 4px;
  background:
    linear-gradient(90deg, var(--gold), var(--gold-bright)) 0/var(--pct, 50%) 100% no-repeat,
    rgba(255,255,255,.1);
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px; height: 12px; margin-top: -4px;
  background: var(--gold-bright); border: none;
  transform: rotate(45deg);
  box-shadow: 0 0 10px rgba(201,172,103,.85);
  transition: box-shadow .12s var(--ease);
}
input[type=range]:active::-webkit-slider-thumb { box-shadow: 0 0 16px rgba(230,207,149,1); }
```

## Hard rules

**Zero border radius.** Pure right angles everywhere. Rounded corners destroy this language faster than any wrong color. Chamfers (45° cut corners) are the sanctioned alternative — see the rule below.

**A chamfer must have its edge expressed.** Cutting a corner with `clip-path` only reads as design if something traces the diagonal. Two ways that happen for free:

- The element has a `border` — the border is clipped along with the box, so it follows the cut automatically. Use this for icon frames, badges, buttons.
- The element is a solid filled shape — the fill *is* the edge. Use this for toggle knobs, indicators, tags.

A large **borderless** surface (a panel, a window) has neither, so a bare diagonal reads as damage — users report it as a rendering bug. Either draw an explicit hairline along the cut, or leave big surfaces square. Small chamfered components against square panels is the stronger composition anyway.

```css
/* Safe: border traces the cut */
.icoframe {
  border: 1px solid var(--gold-dim);
  clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
}
/* Safe: solid fill is its own edge */
.switch::after {
  background: var(--gold-bright);
  clip-path: polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%);
}
```

**One accent color.** Gold carries every highlight, focus and active state. Adding a second accent makes it generic sci-fi.

**Brand gold never themes.** When content has its own color (a character, a team, a category), inject it into `--theme` and let it tint *content surfaces only* — thumbnails, avatar backgrounds. The gold skeleton stays gold. Per-item colors go on the item, not the root:

```css
/* Each item carries its own --c; the global theme does not repaint siblings */
.item .thumb { background: linear-gradient(165deg, color-mix(in srgb, var(--c, var(--theme)) 32%, #12141a), #12141a); }
```

```js
el.style.setProperty('--c', item.color);
```

**Hairlines stay hairlines.** 1px borders, 1.5px brackets. Thicker reads as a cheap bootstrap theme.

**Restraint on glow.** `box-shadow` bloom belongs on the diamond thumb, the readout and the active toggle. Not on cards, not on text bodies.

## Anti-patterns

These are mistakes that look correct in code review and wrong on screen.

**Bare chamfers on borderless surfaces.** Covered in the hard rules above. Worth restating because it is the single most common way this style goes wrong: a `clip-path` cut on a panel with no border and no fill edge looks broken, not styled.

**`clip-path` on a range track.** Applying it to `::-webkit-slider-runnable-track` also clips the thumb — the diamond disappears. Style the track with background layers only.

**Scroll containers eating hover lift.** `overflow-x: auto` clips vertically too, so `translateY(-2px)` on hover and active-state shadows get cut off. Pad the container and cancel the space with negative margin:

```css
.gallery {
  display: flex; gap: 9px; overflow-x: auto;
  padding: 6px 4px 12px; margin: -6px -4px -12px;
  scrollbar-width: none;
}
.gallery::-webkit-scrollbar { display: none; }
```

**Diamond thumbs clipped by input height.** A 12px square rotated 45° needs ~17px of diagonal. Give the range at least `height: 22px`.

**Latin labels as gibberish.** Wide-tracked Latin is only atmospheric when it means something. Untranslated pinyin or invented words break the illusion for anyone who reads English.

**Emoji.** Never. Inline SVG stroke icons at 1.8–2.2 stroke width, gold or cream.

## Naming vocabulary

Renaming plain settings labels into in-world terms is a large part of the effect. Translate function, keep it guessable:

| Plain | In-world | Latin |
|---|---|---|
| 设置 | 共鸣终端 | `RESONANCE TERMINAL` |
| 角色 | 共鸣者 | `RESONATOR` |
| 大小 / 缩放 | 显形尺度 | `SCALE` |
| 音量 | 声压 | `AMPLITUDE` |
| 已保存 | 参数已同步 | `SYNCED` |

Do not rename destructive or safety-critical actions. 删除 stays 删除.

## Build order

1. Drop the token block into `:root`.
2. Build the panel base (gradient + scanline + top hairline).
3. Convert every container to `.card` with corner brackets, radius 0.
4. Replace every section title with the bilingual header.
5. Promote the most important number to a `.readout`.
6. Swap dots/bullets/thumbs for diamonds.
7. Add the dotted-bracket footer.
8. Verify against the checklist below.

## Checklist

- [ ] No `border-radius` anywhere; any chamfer has a border or solid fill tracing its cut
- [ ] Exactly one accent hue (gold); content colors confined to `--theme` / per-item `--c`
- [ ] Every card has corner brackets; active state lights all four
- [ ] Every section header is CJK + rule + tracked Latin
- [ ] Latin labels are meaningful translations
- [ ] Scanline texture under 3% opacity
- [ ] Diamond thumb visible and unclipped at both slider extremes
- [ ] Hover lift not clipped by scroll containers
- [ ] No emoji, no image assets, no web fonts
- [ ] Contrast: `--cream` on `--bg-0` for body text; `--cream-dim` only for secondary

## Additional resources

- Full component recipes (title bar, item picker, switch, footer, presets) — [reference.md](reference.md)
- Runnable component gallery — [demo.html](demo.html)
