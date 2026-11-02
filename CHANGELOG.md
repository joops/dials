# Changelog

## 0.3.0

The type pass: leading, tracking, weight and line length are dials, and Dials works out the leading and tracking for every size from two ends each.

### Upgrading from 0.2

- **Type dials always apply, with their defaults.** Leading, tracking, weight and line length are dials, and `dials-base.css` applies them whether you set them or not: with none set it uses their defaults (leading 1.6 at body size to 1.15 at the h1 step, tracking 0, weights 400 and 600, no line-length cap), and setting a dial to its default changes nothing. `dials.css` still sets no type on any element. Against 0.2, with nothing set: **headings below h1 now get the leading curve's looser line height for their size** instead of a flat 1.15 (with the house type at 1280px, h2 is about 1.27 and h3 about 1.36 rather than 1.15, and an h5 at body size 1.6), h1 keeps 1.15; letter spacing is `0` rather than `normal`, which renders the same; and `strong` and `b` take `--weight-strong`, 600, rather than the browser's `bolder` (700 on body text). Everything else matches 0.2: CI compares every computed property of every element base styles against 0.2.0's files and allows only those. A site's own rules still win over all of it: letter spacing, line length, the leading of captions and `pre` and the weight of `strong` sit in a cascade layer, `@layer dials-type`.
- **Themes set type dials to suit them.** Each theme carries its type preset's leading, tracking, weight and line-length dials, so a site gets what the playground's theme menu shows: Editorial and Paper take the Editorial type preset's, Midnight and Ink Compact's, Soft Friendly's, Quiet Balanced's, Loud and Retro Dramatic's, and Terminal Terminal's. Hi-Fi, the house theme and `dials.css`'s default, sets none and keeps the defaults. Loud's and Retro's font links add their heading face at 800.
- **The rules block in AGENTS.md changed: copy it again.** The type rule now says line height, letter spacing and weight come from the type tokens and dials, and that the leading and tracking tokens go on every element that sets its own font size, never on a wrapper for children to inherit. A new rule says a dial the reference says `dials.css` doesn't declare is read with its default as the fallback (`var(--weight-heading, 600)`).
- **The colour rules in the rules block now treat the on- and line colours as guaranteed defaults, not the only colours allowed.** A solid or soft background still sets its text colour in the same rule, and the matching on- colour (or a line, for borders, icons and large text) is the default Dials guarantees; any other colour, a solid or soft one included, is the site's choice if it passes the contrast rule.

### Added

- **Type dials, always applied with their defaults**: `--leading-body` (line height at body size, 1.6), `--leading-display` (line height at the h1 step, `--size-5`, and above, 1.15), `--tracking-small` (letter spacing at `--size--2`, in em, 0), `--tracking-display` (at `--size-5` and above, 0), `--tracking-caps` (extra for capitals, 0), `--weight-body` (400), `--weight-heading` (600), `--line-length` (no cap) and `--font-accent`, an optional third face (the body face). The value in brackets is the default, which Dials uses until you set the dial; `dials.css` doesn't declare these at `:root`, so read one in your own CSS with its default as the fallback.
- **`--leading`**, a length: the line height for the size it's on. It runs in a straight line in size, `m × size + g`, through `--leading-body` at `--size-0` and `--leading-display` at `--size-5`, the h1 step, so the gap above the text is fixed and bigger text gets proportionally tighter lines. Outside those two sizes it keeps the end ratio: small print keeps body leading (a fixed gap would have given captions about 1.9), and the display sizes above h1 keep `--leading-display`.
- **`--tracking`**, a length: the letter spacing for the size it's on. It's 0 at `--size-0` and slides to `--tracking-small` at `--size--2` and `--tracking-display` at `--size-5`, evenly per step of the scale (in log size), held at the end values beyond them. The display end is the h1 step, the largest heading `dials-base.css` styles, because a designer reads the display dials as what the main heading gets, and the reference sites' display tracking is already at full strength by about 32px. **`--tracking-caps-total`** adds `--tracking-caps`, for text in capitals.
- **`--weight-strong`**: the body weight plus 200, at most 900. A fixed step rather than a dial: it's the usual semibold-over-regular contrast and it follows a light or heavy body face. `strong`, buttons, labels, `summary`, `th` and `legend` use it (600 with nothing set, as in 0.2).
- **`--size-7`, `--size-8`**: two more steps of the scale, for display type.
- **`dials-base.css`** applies them per element: body takes `--weight-body` and `--leading-body` (as a number, so it inherits as one); headings take `--weight-heading`, `--leading` and `--tracking`; captions, `small`, buttons and `pre` take `--leading` or `--tracking` as their size needs; `strong` and `b` take `--weight-strong`; paragraphs, list items, quotes and captions take `--line-length`. Rules for letter spacing, line length, the leading of captions and `pre` and the weight of `strong` sit in a cascade layer, `@layer dials-type`, so any rule of a site's own wins over them, whatever its specificity or order, including a reset loaded before Dials.
- **`.is-typeset`** (`dials-base.css`), opt-in on `<html>` or any section: kerning at every size, tabular figures in tables, `text-wrap: pretty` on paragraphs, list items and quotes.
- **Type presets** set type dials to suit them: Balanced (1.6 to 1.1, display −0.02em, 70ch), Compact (1.45 to 1.15, captions +0.015em, display −0.015em), Dramatic (1.55 to 1.0, display −0.035em, capitals +0.1em, headings 800), Editorial (1.65 to 1.08, captions +0.01em, display −0.02em, capitals +0.06em, headings 400, 66ch), Friendly (1.65 to 1.2, captions +0.02em, 70ch) and Terminal (1.5 to 1.2, capitals +0.08em, headings 500). Hi-Fi sets none, so `dials.css`'s defaults still match it. The playground's Type tab and its theme menu apply them.
- **Patterns**: a "Type" section in [docs/tokens.md](docs/tokens.md#type) covers components that set their own size, an eyebrow in capitals, a lede, display type, line length on a component, the accent face and `.is-typeset`.
- **Playground**: sliders for every type dial, behind a "Leading, tracking and weight (optional)" disclosure, each showing its default until moved, like the other dials, an accent face picker, the scale ladder up to `--size-8` with each size's leading and tracking, and an article specimen built from the type tokens. The light and dark preview panes under the controls take their type from the type tokens, so every type dial moves them. Randomise also picks leading, tracking, weights and line length within ranges that read well.

### Browser support

The type rules for properties 0.2 left alone are in a cascade layer with `revert-layer` (Chrome and Edge 99+, Safari 15.4+, Firefox 97+, all older than what Dials' colour needs).

The leading and tracking curves need `tan()`, `atan2()` and `log()` (Chrome and Edge 120+, Safari 15.4+, Firefox 118+); `tan(atan2(a, b))` turns two lengths into a number, since Firefox has no typed division. Without them, `dials-base.css` keeps headings at `--leading-display` (1.15 by default) for every size and body at `--leading-body`, and letter spacing and the leading of captions inherit as they would without Dials. The colour fallbacks are unchanged and `src/fallback.css` still has no `calc()`.

### Checks

- New `checks/type.mjs`, in CI: every element `dials-base.css` styles renders identically, in every computed property and in its box, with every type dial set to its default and with none set, at 360px and 1280px, in Chromium and Firefox, alone, with each of the ten themes, after a zero-specificity reset loaded before `dials-base.css`, and in the playground's scoped demo; against 0.2.0's files (`checks/fixtures/v0.2.0/`) only line height, letter spacing, the weight of `strong` and the sizes they move differ; `dials.css` alone sets no type on any element, even with every type dial set; across 30 random dial sets and three widths, `--leading`, `--tracking` and `--tracking-caps-total` are exact at `--size--2`, `--size-0` and `--size-5`, held beyond them (`--size-6` to `--size-8` included), monotonic between and on the reference formula; each family of dials moves only its own properties, also in a `[data-dials]` scope; and without the maths functions (emulated) headings keep `--leading-display`.
- `checks/playground.mjs`: the type dials sit in a closed disclosure that opens from the keyboard and show their defaults; every dial set to its default leaves the page's type as it was; each dial moves the light and dark preview panes; a theme applies its type preset's dials and presets put the ones they don't set back to their defaults; Randomise sets them within their ranges; the exports carry set dials only.

### Known

- `dials.css` is the file sites copied as 0.3.0, so it's unchanged by the decision that type dials always apply: its comments on the type dials still say an unset one keeps 0.2's type, and its gates (`--dl-leading-on`, `--dl-tracking-on`, `--dl-weight-strong-on`) are no longer read. Both go in the next version. [docs/tokens.md](docs/tokens.md) states the defaults as they work.

## 0.2.0

The colour pass, from field testing on two real sites.

### Upgrading from 0.1

- **Rename `--accent` to `--secondary`**, and its tokens and class with it: `--accent-solid` → `--secondary-solid` (and `-on-solid`, `-soft`, `-on-soft`, `-line`), `.is-accent` → `.is-secondary`. The old names still work in 0.2 and are deprecated: a site that sets `--accent`, at `:root` or on a `[data-dials]` element, still gets its colour (while it's set, it wins over `--secondary`), and `--accent-*` and `.is-accent` point at the secondary group.
- **Gradients are gone** (breaking). Remove the dials `--gradient-from`, `--gradient-to` and `--gradient-angle` from your own file, and replace the tokens:
  - `--gradient-soft` → a wash between two soft tints, declared once in your own file: `--wash: linear-gradient(in oklab 90deg, var(--brand-soft), var(--danger-soft));`. Body text (`--text`, `--text-strong`) keeps 4.5:1 on it.
  - `--gradient-soft-from` / `--gradient-soft-to` → the soft tints themselves (`--brand-soft` …).
  - `--gradient-solid` → `linear-gradient(in oklab 90deg, var(--brand-solid), var(--danger-solid))` in your own file, as decoration only.
  - `--on-gradient` → no replacement: no single text colour passes across a band. Put text on a solid panel (`--solid` with `--on-solid`) or on a wash.
  - See "Gradients are patterns" in [docs/tokens.md](docs/tokens.md#gradients-are-patterns).
- **Coloured text is closer to your colour.** `--link`, `--focus` and every `--*-on-soft` were darkened (in dark, lightened) to a fixed OKLCH lightness; now they move only as far as 4.5:1 needs, so most sites' links get lighter and more saturated in light. If you set a colour to pass on purpose, it now stays exactly as set.
- **`--*-line` is now strong**: a 3:1 colour for borders, icons and large text, where it was a decorative 40% tint into paper. Borders built on `--line` (or `--*-line`) get heavier. To keep one subtle, such as around a tinted message box, use the pattern in [docs/tokens.md](docs/tokens.md#a-subtle-border-in-a-groups-colour): `color-mix(in oklab, var(--line) 40%, var(--border))`, declared once on the component; or use `--border` for a plain one.
- **The rules block in AGENTS.md is new, and version-agnostic**: copy it again once. From now on it names no dial, token or class (names are in `docs/tokens.md`, for the version you use) and doesn't change between minor versions unless the CHANGELOG says so.

### Changed

- **Coloured text and lines move only as far as their contrast needs.** `--*-on-soft` (so `--link` and `--focus`) and `--*-line` used fixed lightness caps (OKLCH L 0.45 or less in light, 0.8 or more in dark), which over-shot: text landed at 7 to 10.5:1 where 4.5:1 was the target, and the caps cost chroma at the gamut edge. A teal `#007a70`, already 5.2:1 on white, became `#00655c`; an orange `#d04a04` became a deep red `#a01600`; teal text on a navy band went to 10.5:1. Now each colour's linear-light RGB is scaled to the luminance that clears its target on the least contrasting background it sits on (its soft tint, `--surface-lowered` or `--surface-raised`), darker in light and lighter in dark, which keeps its hue and saturation; in dark, once a channel reaches 1, it mixes towards white only as far as still needed. A colour that already passes keeps its exact value. The target has 0.1 of headroom so 8-bit painting can't round it under. Now `#007a70` stays `#007a70`, `#d04a04` gives `#c34503` (4.58:1 at worst), and teal on the navy band gives 4.6 to 4.9:1. The formula is explained in `src/colour.css`.
- **`--*-line` guarantees 3:1** on its soft tint and every surface, by the same rule with a 3:1 target, starting from the dial rather than the fill, so a bright colour survives in its line where `--balance` darkens the fill. Use it for borders, icons and large text (24px, or 18.66px bold, and up). `--neutral-line` is still `--border`.
- **`--link-hover`** is the link a step stronger (0.08 darker in OKLCH lightness in light, lighter in dark), moved on to 7:1 if that's short. It was a fixed lightness cap, which left it identical to the link when the link was already past the cap.
- The target luminance is carried in a colour's alpha, scaled up three times in light, so Firefox rounding a mix's alpha to three decimals costs a third as much. In the contrast check, Firefox's tightest 7:1 hover rises from 7.01:1 to 7.05:1, level with Chromium.
- `--white-text-until` and on-solid text are unchanged: on-solid compares one fill against a fixed threshold, so the new rule has nothing to simplify there.
- The fallback for browsers without relative colour can't move a colour only as far as it needs: on-soft is still the dial mixed 26% into ink, and line is now the dial mixed 40% into ink (was 40% into paper), which holds 3:1 for every theme and the random dial sets, light and in `.is-dark` bands. Both over-shoot for most colours there.
- **The rules block in AGENTS.md is version-agnostic**: it says how to use and tune Dials and names no dial, token or class, except `dials.css`, `dials-base.css`, `docs/tokens.md`, `[data-dials]` and the `--dl-` prefix. It points at the `docs/tokens.md` of the version in use (and how to find a pinned version's), and doesn't change between minor versions unless the CHANGELOG says so. It adds the token rule: Dials has a token only where it works something out or guarantees something; anything built from tokens is a documented pattern.

### Removed

- **Breaking**: the gradient dials `--gradient-from`, `--gradient-to`, `--gradient-angle`, and the tokens `--gradient-solid`, `--gradient-soft`, `--gradient-soft-from`, `--gradient-soft-to` and `--on-gradient`, from the chain, both fallbacks, the presets, themes, docs and playground. The dials only pointed at tokens, `--on-gradient` was judged at the midpoint so either end could fail, and any two soft tints already give what `--gradient-soft` promised. They're patterns now: see "Upgrading from 0.1".

### Deprecated

- `--accent`, `--accent-solid`, `--accent-on-solid`, `--accent-soft`, `--accent-on-soft`, `--accent-line` and `.is-accent`: renamed `--secondary` …; they still work in 0.2.

### Checks

- Contrast: each group's line at 3:1 on its soft tint and every surface; on-soft at 4.5:1 on all three surfaces as well as its tint; `--text` on every soft tint and on a wash; `--link-hover` at 7:1. A new over-shoot check fails a coloured text or line that moves further than its target needs (more than 0.35 past it, at worst), and the field numbers above are asserted in Chromium and Firefox. The gradient pairings are gone.
- Scoping: a site that sets `--accent` at `:root` or in a scope still gets its colour, in the chain and the fallback, and `--accent-*` and `.is-accent` follow.

## 0.1.2

### Fixed

- **`--white-text-until` was capped at 0.183, short of where white text stops passing.** White keeps 4.5:1 up to a luminance of 1.05 / 4.5 − 0.05 = 0.18333, so a fill between the two, such as `#d04a04` (luminance 0.18316: white 4.503:1, black 4.663:1), couldn't keep white text. The cap is now 0.18333, and the contrast check tests that fill. The default stays at 0.179.

## 0.1.1

### Fixed

- **The fallback for older browsers forced the house theme on every site.** In a browser without relative colour (iOS 16 and 17, Safari before 18, Chrome and Edge before 119, Firefox before 128), every page showed Dials' orange Hi-Fi colours whatever its dials said: the fallback block set the colour dials themselves, at a higher specificity than a site's own, and flat values for every token. It now never sets a dial. For browsers with `color-mix()`, it works every colour token out again from the site's dials with `color-mix()` alone, so a site's colours, theme, exact paper and ink and `[data-dials]` scopes apply, and `.is-dark` bands are dark. It sits at the end of `dials.css` with the same selectors as the derived chain, so it wins over the chain there while a site's own file still wins over it. Button text is a fixed white or black per group there, with the fill pulled a fixed amount to keep 4.5:1 in every theme.
- The fallback now also covers Chrome and Edge 119–122, which have relative colour but not `light-dark()`: its `@supports` asks for both.

### Changed

- Browsers without `color-mix()` either (2022 and older) get a last-resort block of flat Hi-Fi colours, generated by `tools/fallback.mjs` into `src/fallback-flat.css`. `build.py --check` fails when it's out of date with `src/colour.css`, and refuses a fallback that sets a dial, uses relative colour, `light-dark()` or `calc()`, or misses a colour token.
- Checks: `node checks/contrast.mjs --fallback` runs every theme and the random dial sets on the fallback, emulated, in CI. `checks/scoping.mjs` checks that the fallback follows a site's brand, exact paper, scopes and bands. Exceptions can be marked fallback-only.

## 0.1.0 (unreleased)

The first release: the engineering core.

- Dials: seven colour dials with plain names (`--brand`, `--accent`, `--success`, `--warning`, `--danger`, `--info`, `--grey`), number dials, type and space dials, and three faces (`--font-body`, `--font-heading`, `--font-mono`). Internal plumbing is prefixed `--dl-`.
- Paper and ink are derived from `--grey` at four lightness dials (`--paper-lightness` …), or set exactly with `--paper-light`, `--paper-dark`, `--ink-light`, `--ink-dark`.
- `[data-dials]` scopes: dials set on any element with the attribute re-derive every token inside it.
- Contrast: an opaque focus ring and field borders at 3:1 or more; on-solid text switches at a hard threshold, held between 0.175 and 0.183 luminance, judged on the colour as painted, and always opaque; on-soft text is held at its lightness limit even for colours outside sRGB; tints mix in OKLab, so they keep their hue on tinted paper.
- New tokens: `--shadow-color`, `--shadow-s`/`-m`/`-l`, `--border-width-s`/`-m`/`-l`, `--line`, `--radius-base` (renamed from the unitless `--radius`).
- `dials.css` sets `color-scheme: light dark`; themes no longer force a scheme.
- A fallback block for browsers without relative colour: the Hi-Fi theme as flat colours.
- `dials-base.css`: every rule at zero specificity, states included; logical properties.
- One source: `src/`, `presets/` and `themes.json`, built by `build.py` into the dist files, the themes, the playground's data and the token reference (`docs/tokens.md`, `docs/tokens.json`).
- Checks: contrast (every theme and random extreme dials, Chromium and Firefox), scoping and playground smoke tests, all in CI.
- MIT licence.
