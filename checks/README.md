# Checks

Every check serves the project over a local HTTP server and drives Chromium and Firefox with Playwright 1.62.1. Each exits 1 on failure.

```sh
npm install                                   # Playwright 1.62.1, from package.json
npx playwright install chromium firefox
node checks/contrast.mjs                      # [--fallback] [--browser=firefox] [--random=40] [--seed=1] [--verbose]
node checks/scoping.mjs
node checks/playground.mjs
```

- `contrast.mjs` loads the built `dials.css` and `dials-base.css`, alone, with each `themes/*.css`, and with 40 seeded sets of extreme random dials (yellows, near-white, near-black, very low chroma, saturated, with random balance, tint and white-text settings). In a light page, a dark page and an `.is-dark` band, it measures: every text token (`--text-strong`, `--text`, `--text-muted`, `--text-quiet`, `--link`, `--link-hover`) on `--surface`, `--surface-raised` and `--surface-lowered` at 4.5:1; each group's on-solid on solid, and on-soft on soft and on surface, at 4.5:1; `--focus` and `--border-strong` on surface and raised at 3:1; `--on-gradient` on both gradient ends at 4.5:1 (themes only). It also fails any of those foregrounds that is translucent, and checks that on-solid text is opaque on a translucent fill. With `--fallback` it measures the same pairings on the fallback for older browsers, emulated as below, in a light page and an `.is-dark` band (the fallback has no dark page), and reports the random dial sets' pass rate.
- `exceptions.json` lists failures the contrast check tolerates, each with a reason. Normal mode has none, and no theme ever gets one. The fallback has one per colour group, for random dial sets only: its on-solid text is a fixed white or black, which extreme fills can defeat.
- `scoping.mjs` checks that `[data-dials]` re-derives colour and space, `--grey` changes paper and ink, an exact `--paper-light` wins, base rules lose to a later zero-specificity rule even on `:hover` and `:focus-visible`, that the fallback (emulated) follows a site's purple brand and exact paper, re-derives a `[data-dials]` scope, keeps `.is-danger` winning and darkens an `.is-dark` band, and that the last resort (emulated) is valid and flat.
- `playground.mjs` loads `site/` and checks there are no console errors, and that every preset, theme, Randomise, the scheme switch, the format switch and both export modes work.
- `lib.mjs` holds the shared server and browser launcher, and `emulateFallback`, which emulates an older browser on the text of `dials.css`: it turns the fallback's `@supports` on and breaks relative colour, `light-dark()` and gradient interpolation (and `color-mix()`, for the last resort) everywhere else, so anything that relies on them fails as it would there. Both checks print what it patched. If Playwright's own Firefox build isn't installed, it uses `DIALS_FIREFOX` or another Firefox build in the Playwright cache.
