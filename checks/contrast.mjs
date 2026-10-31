// Contrast check for the shipped files.
// Loads the built dials.css + dials-base.css (plus each themes/*.css, or a seeded set of extreme
// random dials) on a test page served over HTTP, in Chromium and Firefox, and measures every
// pairing Dials promises, in a light page, a dark page and an .is-dark band inside a light page.
// Exits 1 on any failure not listed in checks/exceptions.json.
// --fallback measures the fallback for older browsers instead (emulated: see emulateFallback in
// lib.mjs), in a light page and an .is-dark band, as the fallback has no dark page.
//
//   node checks/contrast.mjs [--fallback] [--browser=chromium|firefox] [--random=40] [--seed=1] [--verbose]
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve, launch, pageHelpers, emulateFallback, ROOT } from './lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const BROWSERS = args.browser ? [args.browser] : ['chromium', 'firefox'];
const RANDOM = +(args.random ?? 40), SEED = +(args.seed ?? 1);
const MODE = args.fallback ? 'fallback' : 'normal';
const SCHEMES = [['light', 'light', 'page'], ['dark', 'dark', 'page'], ['band', 'light', 'band']].filter(s => MODE === 'normal' || s[0] !== 'dark');
let emulated = null;
if (MODE === 'fallback') {
  const r = emulateFallback(readFileSync(join(ROOT, 'dials.css'), 'utf8'));
  if (!r.patched['@supports color-mix']) { console.error('contrast.mjs: dials.css has no fallback block to test'); process.exit(1); }
  console.log('fallback mode, emulated, patched: ' + Object.entries(r.patched).filter(([, n]) => n).map(([k, n]) => `${k} ×${n}`).join(', '));
  emulated = r.css;
}
const GROUPS = ['brand', 'accent', 'neutral', 'success', 'warning', 'danger', 'info'];
const TEXT = ['--text-strong', '--text', '--text-muted', '--text-quiet', '--link', '--link-hover'];
const SURFACES = ['--surface', '--surface-raised', '--surface-lowered'];

// [foreground, background, minimum, label]
function pairs(withGradient) {
  const p = [];
  for (const t of TEXT) for (const s of SURFACES) p.push([t, s, 4.5, 'text']);
  for (const g of GROUPS) {
    p.push([`--${g}-on-solid`, `--${g}-solid`, 4.5, 'on-solid']);
    p.push([`--${g}-on-soft`, `--${g}-soft`, 4.5, 'on-soft']);
    p.push([`--${g}-on-soft`, '--surface', 4.5, 'on-soft']);
  }
  for (const s of ['--surface', '--surface-raised']) {
    p.push(['--focus', s, 3, 'focus']);
    p.push(['--border-strong', s, 3, 'border']);
  }
  if (withGradient) { p.push(['--on-gradient', '--gradient-from', 4.5, 'gradient']); p.push(['--on-gradient', '--gradient-to', 4.5, 'gradient']); }
  return p;
}
const OPAQUE = new Set(['--focus', '--border-strong', ...TEXT, ...GROUPS.map(g => `--${g}-on-solid`), '--on-gradient']);

// ---- seeded random extreme dials ----
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function randomSets(n, seed) {
  const r = mulberry32(seed), oneOf = a => a[Math.floor(r() * a.length)], between = (a, b) => a + (b - a) * r(), f = (x, d = 3) => +x.toFixed(d);
  const KIND = {
    yellow: () => `hsl(${Math.round(between(45, 75))} ${Math.round(between(80, 100))}% ${Math.round(between(45, 65))}%)`,
    'near-white': () => `oklch(${f(between(0.93, 1))} ${f(between(0, 0.04))} ${Math.round(between(0, 360))})`,
    'near-black': () => `oklch(${f(between(0, 0.14))} ${f(between(0, 0.05))} ${Math.round(between(0, 360))})`,
    'low-chroma': () => `oklch(${f(between(0.3, 0.85))} ${f(between(0, 0.02))} ${Math.round(between(0, 360))})`,
    saturated: () => `hsl(${Math.round(between(0, 360))} 100% ${Math.round(between(35, 60))}%)`,
  };
  const kinds = Object.keys(KIND), sets = [];
  for (let i = 0; i < n; i++) {
    const main = kinds[i % kinds.length], d = {};
    for (const c of ['brand', 'accent', 'success', 'warning', 'danger', 'info', 'grey']) d[`--${c}`] = KIND[r() < 0.6 ? main : oneOf(kinds)]();
    d['--balance'] = r() < 0.5 ? 0 : 1;
    d['--fill-lightness'] = f(between(0.3, 0.75), 2);
    d['--dark-lift'] = f(between(0, 0.3), 2);
    d['--tint-strength'] = Math.round(between(4, 20)) + '%';
    d['--tint-vividness'] = f(between(1, 3), 1);
    d['--white-text-until'] = f(between(0.15, 0.3));
    sets.push({ name: `random:${i + 1}:${main}`, dials: d });
  }
  return sets;
}

// ---- the test page ----
const PROBES = [...new Set(pairs(true).flat().filter(x => typeof x === 'string' && x.startsWith('--')))];
const page = (url) => {
  const theme = url.searchParams.get('theme');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>contrast</title>
${emulated ? `<style>${emulated}</style>` : '<link rel="stylesheet" href="/dials.css">'}<link rel="stylesheet" href="/dials-base.css">
${theme ? `<link rel="stylesheet" href="/themes/${theme}.css">` : ''}<style id="dials"></style></head>
<body><div id="page" style="color: rgb(1, 2, 3)"></div><div class="is-dark"><div id="band" style="color: rgb(1, 2, 3)"></div></div></body></html>`;
};

async function measure(p, dialsCss, withGradient) {
  return p.evaluate(({ probes, list, dialsCss, opaque, schemes }) => {
    document.getElementById('dials').textContent = dialsCss || '';
    const out = [];
    const read = (box) => {
      const c = {};
      for (const v of probes) {
        let el = box.querySelector(`[data-v="${v}"]`);
        if (!el) { el = document.createElement('i'); el.dataset.v = v; el.style.color = `var(${v})`; box.appendChild(el); }
        const s = getComputedStyle(el).color;
        c[v] = s === 'rgb(1, 2, 3)' ? null : __rgba(s);
      }
      return c;
    };
    for (const [scheme, root, box] of schemes) {
      document.documentElement.style.colorScheme = root;
      const c = read(document.getElementById(box));
      for (const [fg, bg, min, kind] of list) {
        const a = c[fg], b = c[bg];
        if (!a || !b) { out.push({ scheme, fg, bg, min, kind, ratio: null, why: `${!a ? fg : bg} is invalid` }); continue; }
        const ratio = __ratio(a, b);
        const why = opaque.includes(fg) && a[3] < 1 ? `${fg} is translucent (alpha ${a[3]})` : ratio < min ? null : undefined;
        out.push({ scheme, fg, bg, min, kind, ratio, why, fgHex: __hex(a), bgHex: __hex(b) });
      }
    }
    return out;
  }, { probes: PROBES, list: pairs(withGradient), dialsCss, opaque: [...OPAQUE], schemes: SCHEMES });
}

const exceptions = JSON.parse(readFileSync(join(ROOT, 'checks/exceptions.json'), 'utf8')).exceptions || [];
const excepted = (browser, input, r) => exceptions.find(e => (e.mode ?? 'normal') === MODE &&
  [browser, '*'].includes(e.browser ?? '*') && (e.input === '*' || e.input === input || (e.input.endsWith('*') && input.startsWith(e.input.slice(0, -1))))
  && [r.scheme, '*'].includes(e.scheme ?? '*') && e.pair === `${r.fg} on ${r.bg}`);

const themes = readdirSync(join(ROOT, 'themes')).filter(f => f.endsWith('.css')).map(f => f.slice(0, -4)).sort();
const inputs = [{ name: 'dials.css', theme: null, gradient: true },
  ...themes.map(t => ({ name: `theme:${t}`, theme: t, gradient: true })),
  ...randomSets(RANDOM, SEED).map(s => ({ ...s, theme: null, gradient: false }))];
const css = d => ':root {\n' + Object.entries(d).map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}';

const server = await serve({ '/__contrast': page });
let exitCode = 0;
const summary = [];
try {
  for (const name of BROWSERS) {
    const browser = await launch(name), p = await browser.newPage();
    await p.addInitScript(pageHelpers);
    const errors = []; p.on('pageerror', e => errors.push(String(e)));
    let checked = 0, failed = 0, skipped = 0, worst = { ratio: Infinity };
    const rnd = { checked: 0, failed: 0, sets: new Set() };
    const fails = [];
    let loaded = undefined;
    for (const inp of inputs) {
      if (loaded !== inp.theme) { await p.goto(`${server.url}/__contrast${inp.theme ? `?theme=${inp.theme}` : ''}`, { waitUntil: 'load' }); loaded = inp.theme; }
      const res = await measure(p, inp.dials ? css(inp.dials) : '', inp.gradient);
      for (const r of res) {
        checked++;
        const random = inp.name.startsWith('random:');
        if (random) rnd.checked++;
        if (random && r.why !== undefined) { rnd.failed++; rnd.sets.add(inp.name); }
        if (r.why === undefined) { if (r.ratio - r.min < worst.ratio - (worst.min || 0)) worst = { ...r, input: inp.name }; continue; }
        const why = r.why || `${r.ratio.toFixed(2)} < ${r.min}`;
        const ex = excepted(name, inp.name, r);
        if (ex) { skipped++; if (args.verbose) console.log(`  excepted [${name}] ${inp.name} ${r.scheme}: ${r.fg} on ${r.bg} ${why} (${ex.reason})`); continue; }
        failed++;
        fails.push(`  FAIL [${name}] ${inp.name.padEnd(22)} ${r.scheme.padEnd(5)} ${(r.fg + ' on ' + r.bg).padEnd(40)} ${why}${r.fgHex ? `  (${r.fgHex} on ${r.bgHex})` : ''}`);
      }
    }
    // the on-solid result is opaque even when the fill isn't
    const alpha = await p.evaluate(() => {
      document.getElementById('dials').textContent = ':root { --brand: rgb(230 120 20 / 50%); --white-text-until: 0.3; }';
      const el = document.createElement('i'); el.style.color = 'var(--brand-on-solid)'; document.body.appendChild(el);
      return __rgba(getComputedStyle(el).color)[3];
    });
    checked++;
    if (alpha !== 1) { failed++; fails.push(`  FAIL [${name}] translucent --brand: --brand-on-solid alpha is ${alpha}, expected 1`); }
    // the cap on --white-text-until is the last luminance where white still gives 4.5:1: a fill
    // just under it (#d04a04, luminance 0.18316) keeps white text when the dial asks for it
    if (MODE === 'normal') {
      const cap = await p.evaluate(() => {
        document.getElementById('dials').textContent = ':root { --brand: #d04a04; --white-text-until: 0.18333; }';
        const c = (v) => { const el = document.createElement('i'); el.style.color = `var(${v})`; document.body.appendChild(el); const r = __rgba(getComputedStyle(el).color); el.remove(); return r; };
        const fg = c('--brand-on-solid'), bg = c('--brand-solid');
        return { fg: __hex(fg), bg: __hex(bg), ratio: __ratio(fg, bg) };
      });
      checked++;
      if (cap.fg !== '#ffffff' || cap.ratio < 4.5) { failed++; fails.push(`  FAIL [${name}] --brand: #d04a04 with --white-text-until: 0.18333: --brand-on-solid is ${cap.fg} on ${cap.bg} at ${cap.ratio.toFixed(3)}:1, expected white at 4.5:1 or more`); }
    }
    for (const e of errors) { failed++; fails.push(`  FAIL [${name}] page error: ${e}`); }
    fails.slice(0, 200).forEach(f => console.log(f));
    if (fails.length > 200) console.log(`  … and ${fails.length - 200} more`);
    const line = `${name} ${browser.version()}${MODE === 'fallback' ? ', fallback' : ''}: ${inputs.length} inputs (dials.css, ${themes.length} themes, ${RANDOM} random dial sets, seed ${SEED}) × ${SCHEMES.length} schemes, ` +
      `${checked} pairings checked, ${failed} failed, ${skipped} excepted. Tightest pass: ${worst.input} ${worst.scheme} ${worst.fg} on ${worst.bg} ${worst.ratio?.toFixed(2)} (min ${worst.min}).` +
      (RANDOM ? ` Random dial sets: ${rnd.checked - rnd.failed} of ${rnd.checked} pairings pass (${(100 * (rnd.checked - rnd.failed) / rnd.checked).toFixed(1)}%), ${RANDOM - rnd.sets.size} of ${RANDOM} sets pass in full.` : '');
    summary.push(line);
    if (failed) exitCode = 1;
    await browser.close();
  }
} finally { await server.close(); }
console.log('\n' + summary.join('\n'));
console.log(exitCode ? 'Contrast check FAILED' : 'Contrast check passed');
process.exit(exitCode);
