# Changelog

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
