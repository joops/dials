# Checks

Every check serves the project over a local HTTP server and drives Chromium and Firefox with Playwright 1.62.1. Each exits 1 on failure.

```sh
npm install                                   # Playwright 1.62.1, from package.json
npx playwright install chromium firefox
node checks/contrast.mjs                      # [--browser=firefox] [--random=40] [--seed=1] [--verbose]
node checks/scoping.mjs
node checks/playground.mjs
```

- `contrast.mjs` loads the built `dials.css` and `dials-base.css`, alone, with each `themes/*.css`, and with 40 seeded sets of extreme random dials (yellows, near-white, near-black, very low chroma, saturated, with random balance, tint and white-text settings). In a light page, a dark page and an `.is-dark` band, it measures: every text token (`--text-strong`, `--text`, `--text-muted`, `--text-quiet`, `--link`, `--link-hover`) on `--surface`, `--surface-raised` and `--surface-lowered` at 4.5:1; each group's on-solid on solid, and on-soft on soft and on surface, at 4.5:1; `--focus` and `--border-strong` on surface and raised at 3:1; `--on-gradient` on both gradient ends at 4.5:1 (themes only). It also fails any of those foregrounds that is translucent, and checks that on-solid text is opaque on a translucent fill.
- `exceptions.json` lists failures the contrast check tolerates, each with a reason. It is empty.
- `scoping.mjs` checks that `[data-dials]` re-derives colour and space, `--grey` changes paper and ink, an exact `--paper-light` wins, base rules lose to a later zero-specificity rule even on `:hover` and `:focus-visible`, and the fallback block (forced on) is valid, flat and wins over the derived chain.
- `playground.mjs` loads `site/` and checks there are no console errors, and that every preset, theme, Randomise, the scheme switch, the format switch and both export modes work.
- `lib.mjs` holds the shared server and browser launcher. If Playwright's own Firefox build isn't installed, it uses `DIALS_FIREFOX` or another Firefox build in the Playwright cache.
