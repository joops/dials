# Dials

**An AI-first CSS framework for building sites and web apps.**

**Try it:** [joops.github.io/dials](https://joops.github.io/dials/), the playground. Turn the dials, pick a theme, and copy the CSS.

Dials is a token-based system designed to produce a huge diversity of looks from only a few dials: seven colours, a handful of type and space settings, three font faces and a corner radius. Everything else is derived from these values using plain CSS, live in the browser: every surface, text level, border and colour group, in light and dark, with contrast checked in CI; and every text and space size, fluid from phone to desktop with no breakpoints.

Other calculators and systems generate colours, type and space once, as fixed values, which limits what a theme can change on a live site. Dials derives all three dynamically from the values you define, so a theme can change the whole look of a page or app: its colours, type scale, spacing, faces and corners.

AI-first means an agent gets a short set of rules and a small set of tokens, so it can build a theme quickly and stay within the guidelines, and you can riff on it in real time to dial in the perfect look for your new project. The rules are in [AGENTS.md](AGENTS.md): copy the rules block into your project's own `AGENTS.md` or `CLAUDE.md`. It names no tokens, so it doesn't change between minor versions unless the CHANGELOG says so; every name is in [docs/tokens.md](docs/tokens.md), for the version you use.

## Quick start

```html
<!-- 1. Dials, with the Hi-Fi house theme as its default, and Hi-Fi's faces -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Michroma&family=Barlow:wght@400;700&family=Share+Tech+Mono&display=swap">
<link rel="stylesheet" href="dials.css">
<link rel="stylesheet" href="dials-base.css">   <!-- optional: plain HTML styled from the tokens -->

<!-- 2. Your own file, loaded last: your dials and your components -->
<link rel="stylesheet" href="site.css">
```

```css
/* site.css */
:root {
  --brand: hsl(262 70% 52%);
  --secondary: hsl(172 60% 40%);
  --radius-base: 8;
}
.btn { background: var(--solid); color: var(--on-solid); padding: var(--space-2xs) var(--space-s);
       border-radius: var(--radius-m); border: var(--border-width-s) solid transparent; }
```

```html
<button class="btn">Save</button> <button class="btn is-danger">Delete</button>
```

No build step and no dependencies. To use a ready-made theme, load it after `dials.css` instead of (or before) your own dials, with the Google Fonts link named at the top of the theme file:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&family=Source+Serif+4:wght@400;700&display=swap">
<link rel="stylesheet" href="dials.css">
<link rel="stylesheet" href="themes/editorial.css">
```

Each theme loads its own faces: the link at the top of `themes/<name>.css` covers its heading, body and mono faces, at only the weights each face has. A face you set yourself needs its own link; `--font-mono` defaults to the system monospace stack in every theme except Hi-Fi (Share Tech Mono) and Terminal (IBM Plex Mono).

## How it works

- **Dials** are the only values you type: `--brand`, `--secondary`, `--success`, `--warning`, `--danger`, `--info` and `--grey` (any CSS colour, preferably HSL), a few numbers (`--balance`, `--tint-strength`, `--text-contrast` …), the type and space dials (`--size-min`/`--size-max`, `--ratio-min`/`--ratio-max`, `--space-density`, `--radius-base` …) and the faces (`--font-body`, `--font-heading`, `--font-mono`).
- **Paper and ink** (the page background and the strongest text) are derived from `--grey` at four lightness dials. To use exact colours, set `--paper-light`, `--paper-dark`, `--ink-light` or `--ink-dark`.
- **Tokens** are worked out from the dials: `--surface*`, `--text*`, `--border*`, `--focus`, `--shadow-*`, seven colour groups with five roles each (`--brand-solid`, `--brand-on-solid`, `--brand-soft`, `--brand-on-soft`, `--brand-line` …), and every `--size-*`, `--space-*` and `--radius-*`. Internal plumbing is prefixed `--dl-`; don't use it.
- **Groups**: components use the ungrouped `--solid`, `--on-solid`, `--soft`, `--on-soft` and `--line`; a class such as `.is-danger` points them at a group.
- **Light and dark**: `dials.css` sets `:root { color-scheme: light dark; }`, so the page follows the visitor. To force one, set `:root { color-scheme: light; }` (or `dark`) in your own file. `class="is-dark"` makes any band dark; `class="is-light"` makes one light. Themes never set the scheme.
- **Contrast**: text tokens keep 4.5:1 on every surface, button text is white or black (whichever contrasts more), each group's `-line` (borders, icons and large text) keeps 3:1, and focus rings and control borders keep 3:1, in light and dark. Coloured text and lines keep your colour and move only as far as their target needs: a teal that already gives 5:1 on white stays exactly as set, and one that doesn't is darkened (or, in dark, lightened) just past the line, keeping its hue and saturation. The contrast check verifies it for every theme and 40 sets of extreme random dials, in Chromium and Firefox, and fails a colour that moves further than it needs.
- **Type**: leading, tracking and weight are dials too, and they always apply, with defaults (leading 1.6 at body size to 1.15 at h1, no extra tracking, weights 400 and 600) until you set them. Setting one to its default changes nothing. Set the leading at two ends, body text (`--leading-body`) and the h1 step (`--leading-display`, which the display sizes above it keep), and the tracking at the smallest size and at h1 (`--tracking-small`, `--tracking-display`, plus `--tracking-caps` for capitals). `--leading` and `--tracking` then work out the right value for whatever size they're on: bigger text gets proportionally tighter lines, display type can tighten and captions open up, with no per-step values. `--weight-body`, `--weight-heading` and an optional third face, `--font-accent`, complete the set. Line length is left to your layout: see the patterns. `dials-base.css` applies them to plain HTML; components apply `--leading` and `--tracking` on each element that sets a size (they're lengths, so they mustn't be inherited). The [Type patterns](docs/tokens.md#type) show how, and `class="is-typeset"` opts a page into kerning, tabular figures in tables and pretty wrapping.
- **Patterns, not tokens**: Dials has a token only where it works something out or guarantees something. Anything you can build from tokens, such as a gradient, is a pattern: [docs/tokens.md](docs/tokens.md#patterns) shows how (a wash between two soft tints carries body text; a band from a solid is decoration only).

## Scoping: re-theme part of a page

Dials live on `:root`, but the derived tokens are also declared on any element with a `data-dials` attribute, so dials set there re-derive everything inside it:

```html
<aside data-dials style="--brand: hsl(270 60% 50%); --space-density: .8">
  … buttons, links and spacing in here use the purple brand and tighter space …
</aside>
```

It works for any dial, from a class too (`.promo { --brand: … }` on an element that has `data-dials`). One caveat: a dial whose value points at a token, such as `--space-min: var(--size-min)`, is resolved where it's set. If a scope changes what it points at, set that dial on the scope as well. For Shadow DOM, the dials and the derived tokens are also declared on `:host`, so `dials.css` adopted inside a shadow root applies to it (not yet covered by the checks).

## Files

| File | What it is |
|---|---|
| `dials.css` | Everything: colour, type and space, then the fallback for older browsers. Hi-Fi is its default |
| `dials-colour.css`, `dials-scale.css` | The colour half and the type-and-space half on their own (no fallback) |
| `dials-base.css` | Optional: plain HTML elements styled from the tokens, at zero specificity, with logical properties |
| `themes/*.css` | Ready-made themes: dial settings only, loaded after `dials.css` |
| `presets/{colour,type,space}/*.css` | The parts themes are made from; mix your own |
| `docs/tokens.md`, `docs/tokens.json` | The complete public token reference |
| `AGENTS.md` | The rules for agents and builders |
| `site/` | The playground: open it over HTTP (`python3 -m http.server`, then `/site/`) |
| `src/`, `themes.json`, `build.py` | The sources and the build (see Contributing) |
| `checks/`, `tools/` | The contrast, scoping and playground checks; the fallback generator |
| `brand/` | Logo files and the script that builds them |

## Themes

| File | Theme | Presets |
|---|---|---|
| `themes/hi-fi.css` | Hi-Fi (default) | Hi-Fi colours, Hi-Fi type, Machined space |
| `themes/editorial.css` | Editorial | Nord colours, Editorial type, Roomy space |
| `themes/midnight.css` | Midnight | Dracula colours, Compact type, Compact space |
| `themes/soft.css` | Soft | Catppuccin colours, Friendly type, Roomy space |
| `themes/retro.css` | Retro | Gruvbox colours, Dramatic type, Square space |
| `themes/terminal.css` | Terminal | Tokyo Night colours, Terminal type, Compact space |
| `themes/paper.css` | Paper | Solarized colours, Editorial type, Default space |
| `themes/quiet.css` | Quiet | Calm colours, Balanced type, Airy layout space |
| `themes/loud.css` | Loud | Vivid colours, Dramatic type, Roomy space |
| `themes/ink.css` | Ink | Monochrome colours, Compact type, Square space |

Every theme works in light and dark. Some palettes were designed for one side (Dracula and One Dark for dark); their other side is derived from `--grey`.

Each theme sets its type preset's leading, tracking and weight dials, so a site gets what the playground's theme menu shows; Hi-Fi, the house theme, leaves them at their defaults.

## Browser support

Dials needs `color-mix()`, `light-dark()` and relative colour: Chrome and Edge 123+, Safari 18+, Firefox 128+.

Older browsers get a fallback built into the end of `dials.css`, in two steps:

- **With `color-mix()` but without relative colour or `light-dark()`** (Chrome and Edge 111–122, Safari 16.2–17, which includes iOS 16 and 17, and Firefox 113–127): a block that works every colour token out again from your dials with `color-mix()` alone, so your colours, themes, exact paper and ink, and `[data-dials]` scopes all apply. It's an approximation: the page is light (`.is-dark` bands are still dark); paper and ink come from `--grey` at fixed mixes, so the lightness dials, `--balance`, `--dark-lift`, `--tint-vividness` and `--text-contrast` have no effect; button text can't switch with the fill, so each group has a fixed choice (white on brand, secondary, danger and info, black on success and warning) and its fill is pulled a fixed amount darker or lighter to keep 4.5:1; and coloured text and lines are the dial mixed a fixed amount into ink, so they hold their contrast but over-shoot it for most colours. Every theme passes the contrast check in this mode; with extreme dials of your own, check on-solid text yourself (`node checks/contrast.mjs --fallback` shows how).
- **Without `color-mix()` either** (Chrome and Edge before 111, Safari before 16.2, Firefox before 113: 2022 and older): flat colours, the Hi-Fi house theme in light, generated by `tools/fallback.mjs` from the built file. Colour dials have no effect there, but every token is a valid colour, so pages stay readable and buttons stay visible.

Type and space work as normal in both. Your own file, loaded after `dials.css`, still wins over the fallback, so set dials there as usual.

The leading and tracking curves need `tan()`, `atan2()` and `log()` (Chrome and Edge 120+, Safari 15.4+, Firefox 118+). Without them, `dials-base.css` keeps headings at `--leading-display` (or 1.15) for every size, body text at `--leading-body`, and leaves letter spacing alone; the weight and line-length dials work everywhere.

Don't register the tokens with `@property`: they must work out their colour where they're used, which is what makes dark bands and scopes work.

## FAQ

**Why HSL dials when the maths is OKLCH?** HSL is the easiest format to reason about and to tell an agent ("the same blue, a bit darker"); any CSS colour works. Dials converts to OKLCH and OKLab internally, where lightness is perceptual, so the derived tokens hold their contrast whatever format you write.

**Can I turn the derivation off and use exact colours?** Leave `--balance` at 0 (the default) for fills exactly as set, and set `--paper-light` and friends for exact paper and ink.

## Contributing

The hand-edited sources are `src/colour.css`, `src/scale.css`, `src/base.css`, `src/fallback.css`, `src/patterns.md`, `presets/*/*.css` and `themes.json`; everything in the file list above that sits at the root, in `themes/`, `docs/` or `site/` (except `site/index.html`) is generated.

```sh
python3 build.py              # build
python3 build.py --check      # fail if anything generated is stale
npm install && npx playwright install chromium firefox
node tools/fallback.mjs       # regenerate src/fallback-flat.css after changing src/colour.css, then build again
node checks/contrast.mjs      # contrast: every theme and 40 random extreme dial sets, Chromium and Firefox
node checks/contrast.mjs --fallback   # the same, for the fallback for older browsers (emulated)
node checks/scoping.mjs       # scopes, grey, exact paper, base specificity, the fallback following your dials
node checks/playground.mjs    # the playground loads cleanly and every preset and theme applies
```

CI runs all of these on every push and pull request (`.github/workflows/check.yml`).

## Thanks

Inspired by [Utopia](https://utopia.fyi) for fluid type and space, and by [web.dev's Baseline colour themes](https://web.dev/articles/baseline-in-action-color-theme), [Web Awesome](https://webawesome.com/docs/tokens/color) and [Radix Themes](https://www.radix-ui.com/themes) for colour.

## Licence

The code is MIT licensed: see [LICENSE](LICENSE). Copyright (c) 2026 joops.

The Dials name and logo (everything in `brand/`) are not covered by the code licence. You may use the code under any name; please don't use the Dials name or logo for your own product or fork without permission.
