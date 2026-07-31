# Resonance HUD

A dark-gold game HUD design language for web interfaces, packaged as an Agent Skill.

Near-black base, a single brand-gold accent, hairline borders, pure right angles, L-shaped corner brackets, bilingual CJK/Latin section labels, diamond nodes. Every ornament is drawn with CSS or inline SVG — no image assets, no web fonts, crisp at any DPI.

Open [demo.html](demo.html) in a browser to see every component.

## Install

```bash
npx skills add https://github.com/KTBOY/resonance-hud --skill resonance-hud
```

Or copy the directory into your project's `.qoder/skills/` (Qoder) / `.claude/skills/` (Claude Code).

## Use

Once installed, ask your agent for a game-style or HUD interface:

- 「用鸣潮那种风格做一个设置面板」
- 「把这个 dashboard 改成游戏 HUD 风格」
- 「深色金调的科技感界面」

The skill activates on those requests and applies the token system and component recipes.

## What's inside

| File | Purpose |
|---|---|
| `SKILL.md` | Design tokens, six signature elements, hard rules, anti-patterns, checklist |
| `reference.md` | Copy-paste recipes: title bar, item picker, switch, segmented control, footer, chamfers |
| `demo.html` | Runnable component gallery — open it in a browser |

## Why this exists

Asking an AI for "a beautiful interface" reliably produces the same thing: light grey background, white rounded cards, one blue accent, 16px radius everywhere. Not wrong, just anonymous.

Giving it a concrete reference system works better than asking for taste. This skill is one such system, reverse-engineered from a shipped game UI: the exact hex values, the size ratios, the ornament geometry, and the mistakes that look fine in code review but wrong on screen.

## Design tokens

```css
--gold:        #c9ac67;   /* brand accent — never themed */
--gold-bright: #e6cf95;
--cream:       #fafae9;
--bg-0:        #14161a;
--bg-1:        #1b1e23;
--hair:        rgba(201, 172, 103, .2);
```

Full set and usage rules in [SKILL.md](SKILL.md).

## Scope

Vanilla CSS custom properties and HTML. No framework, no build step, no dependencies. Works in any project that can load a stylesheet — React, Vue, Electron, plain HTML.

Fits: settings panels, overlays, launchers, HUD dashboards, character/inventory pickers, desktop companion apps.

Does not fit: content-heavy reading interfaces, light themes, products needing a soft or friendly tone.

## Credits and legal

The palette and geometry are an independent reverse-engineering of a visual style, sampled from publicly accessible web pages for study purposes. This project ships no game assets, no fonts, no logos, and no artwork.

Not affiliated with, endorsed by, or sponsored by any game developer or publisher. Game names appearing in the documentation are used descriptively to identify the aesthetic reference.

## License

MIT
