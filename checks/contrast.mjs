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
const GROUPS = ['brand', 'secondary', 'neutral', 'success', 'warning', 'danger', 'info'];
const COLOURED = GROUPS.filter(g => g !== 'neutral');
const TEXT = ['--text-strong', '--text', '--text-muted', '--text-quiet', '--link', '--link-hover'];
const SURFACES = ['--surface', '--surface-raised', '--surface-lowered'];
// the wash pattern in docs/tokens.md: two soft tints blended in oklab, with body text on it (this is its midpoint)
const WASH = 'color-mix(in oklab, var(--brand-soft), var(--info-soft))';

// [foreground, background, minimum, label]. --link-hover is held to 7:1, except in the fallback (4.5:1).
function pairs() {
  const p = [];
  for (const t of TEXT) for (const s of SURFACES) p.push([t, s, t === '--link-hover' && MODE === 'normal' ? 7 : 4.5, t === '--link-hover' ? 'hover' : 'text']);
  for (const g of GROUPS) {
    p.push([`--${g}-on-solid`, `--${g}-solid`, 4.5, 'on-solid']);
    for (const s of [`--${g}-soft`, ...SURFACES]) p.push([`--${g}-on-soft`, s, 4.5, 'on-soft']);
    p.push(['--text', `--${g}-soft`, 4.5, 'text on soft']);
    if (g !== 'neutral') for (const s of [`--${g}-soft`, ...SURFACES]) p.push([`--${g}-line`, s, 3, 'line']);
  }
  p.push(['--text', WASH, 4.5, 'wash']);
  for (const s of ['--surface', '--surface-raised']) {
    p.push(['--focus', s, 3, 'focus']);
    p.push(['--border-strong', s, 3, 'border']);
  }
  return p;
}
const OPAQUE = new Set(['--focus', '--border-strong', ...TEXT, ...GROUPS.map(g => `--${g}-on-solid`), ...GROUPS.map(g => `--${g}-on-soft`), ...COLOURED.map(g => `--${g}-line`)]);

// No over-shoot: a group's on-soft and line keep the colour they start from (the fill, clipped to
// sRGB, and the dial) when it already passes; when they move, they stop just past the target (the
// target plus Dials' 0.1 headroom, plus 0.25 for painting in 8 bits) on the least contrasting of
// their soft tint and the surfaces. Normal mode only: the fallback can't move a colour only as far
// as it needs.
const clip = (c) => `color(from ${c} srgb-linear clamp(0, r, 1) clamp(0, g, 1) clamp(0, b, 1))`;
const TIGHT = COLOURED.flatMap(g => [
  { token: `--${g}-on-soft`, from: clip(`var(--dl-${g}-base)`), min: 4.5, bgs: [`--${g}-soft`, ...SURFACES] },
  { token: `--${g}-line`, from: clip(g === 'secondary' ? 'var(--dl-secondary-dial)' : `var(--${g})`), min: 3, bgs: [`--${g}-soft`, ...SURFACES] },
]);
const OVERSHOOT = 0.1 + 0.25;

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
    for (const c of ['brand', 'secondary', 'success', 'warning', 'danger', 'info', 'grey']) d[`--${c}`] = KIND[r() < 0.6 ? main : oneOf(kinds)]();
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
const PROBES = [...new Set([...pairs().flatMap(p => p.slice(0, 2)), ...TIGHT.flatMap(t => [t.token, t.from])])];
const page = (url) => {
  const theme = url.searchParams.get('theme');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>contrast</title>
${emulated ? `<style>${emulated}</style>` : '<link rel="stylesheet" href="/dials.css">'}<link rel="stylesheet" href="/dials-base.css">
${theme ? `<link rel="stylesheet" href="/themes/${theme}.css">` : ''}<style id="dials"></style></head>
<body><div id="page" style="color: rgb(1, 2, 3)"></div><div class="is-dark"><div id="band" style="color: rgb(1, 2, 3)"></div></div></body></html>`;
};

async function measure(p, dialsCss) {
  return p.evaluate(({ probes, list, dialsCss, opaque, schemes, tight, overshoot, normal }) => {
    document.getElementById('dials').textContent = dialsCss || '';
    const out = [];
    const read = (box) => {
      const c = {};
      for (const v of probes) {
        let el = box.querySelector(`[data-v="${v}"]`);
        if (!el) { el = document.createElement('i'); el.dataset.v = v; el.style.color = v.startsWith('--') ? `var(${v})` : v; box.appendChild(el); }
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
      if (!normal) continue;
      for (const t of tight) {
        const a = c[t.token], from = c[t.from];
        if (!a || !from || t.bgs.some(b => !c[b])) continue;   // an invalid token is reported above
        const moved = a.slice(0, 3).some((x, i) => Math.abs(x - from[i]) > 1);
        const worst = Math.min(...t.bgs.map(b => __ratio(a, c[b])));
        const bg = t.bgs.find(b => __ratio(a, c[b]) === worst);
        const why = moved && worst > t.min + overshoot ? `moved from ${__hex(from)} to ${__hex(a)} but overshoots: ${worst.toFixed(2)} on ${bg}, where ${(t.min + overshoot).toFixed(2)} is the most it needs` : undefined;
        out.push({ scheme, fg: t.token, bg, min: t.min, kind: 'overshoot', ratio: worst, why, moved, fgHex: __hex(a), bgHex: __hex(c[bg]) });
      }
    }
    return out;
  }, { probes: PROBES, list: pairs(), dialsCss, opaque: [...OPAQUE], schemes: SCHEMES, tight: TIGHT, overshoot: OVERSHOOT, normal: MODE === 'normal' });
}

const exceptions = JSON.parse(readFileSync(join(ROOT, 'checks/exceptions.json'), 'utf8')).exceptions || [];
const excepted = (browser, input, r) => exceptions.find(e => (e.mode ?? 'normal') === MODE &&
  [browser, '*'].includes(e.browser ?? '*') && (e.input === '*' || e.input === input || (e.input.endsWith('*') && input.startsWith(e.input.slice(0, -1))))
  && [r.scheme, '*'].includes(e.scheme ?? '*') && e.pair === `${r.fg} on ${r.bg}`);

const themes = readdirSync(join(ROOT, 'themes')).filter(f => f.endsWith('.css')).map(f => f.slice(0, -4)).sort();
const inputs = [{ name: 'dials.css', theme: null },
  ...themes.map(t => ({ name: `theme:${t}`, theme: t })),
  ...randomSets(RANDOM, SEED).map(s => ({ ...s, theme: null }))];
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
    const byKind = {};   // the tightest pass of each kind of pairing, and, for overshoot, the loosest
    const rnd = { checked: 0, failed: 0, sets: new Set() };
    const fails = [];
    let loaded = undefined;
    for (const inp of inputs) {
      if (loaded !== inp.theme) { await p.goto(`${server.url}/__contrast${inp.theme ? `?theme=${inp.theme}` : ''}`, { waitUntil: 'load' }); loaded = inp.theme; }
      const res = await measure(p, inp.dials ? css(inp.dials) : '');
      for (const r of res) {
        checked++;
        const random = inp.name.startsWith('random:');
        if (random) rnd.checked++;
        if (random && r.why !== undefined) { rnd.failed++; rnd.sets.add(inp.name); }
        if (r.why === undefined) {
          const k = byKind[r.kind];
          if (r.kind === 'overshoot' ? r.fgHex !== undefined && (!k || r.ratio - r.min > k.ratio - k.min) && r.moved : !k || r.ratio - r.min < k.ratio - k.min) byKind[r.kind] = { ...r, input: inp.name };
          if (r.kind !== 'overshoot' && r.ratio - r.min < worst.ratio - (worst.min || 0)) worst = { ...r, input: inp.name };
          continue;
        }
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
    // the field numbers, from two real sites in light on white paper: coloured text moves only as far
    // as 4.5:1 needs. Teal #007a70, already 5.2:1 on white, keeps its colour (the 0.1 caps made it
    // #00655c); orange #d04a04 (4.5:1) darkens just past the line and stays orange (it went deep red,
    // #a01600); and on a navy band, rgb(11 17 30), small teal text lands near 4.5:1, not 10.5:1.
    if (MODE === 'normal') {
      const f = await p.evaluate(() => {
        const read = (dials, box) => {
          document.getElementById('dials').textContent = `:root { ${dials} }`;
          document.documentElement.style.colorScheme = 'light';
          const c = (v) => { const el = document.createElement('i'); el.style.color = `var(${v})`; document.getElementById(box).appendChild(el); const r = __rgba(getComputedStyle(el).color); el.remove(); return r; };
          const t = c('--brand-on-soft'), bgs = ['--brand-soft', '--surface', '--surface-raised', '--surface-lowered'].map(c);
          return { hex: __hex(t), link: __hex(c('--link')), worst: Math.min(...bgs.map(b => __ratio(t, b))), onSurface: __ratio(t, bgs[1]), rgb: t };
        };
        const hue = ([r, g, b]) => { [r, g, b] = [r, g, b].map(x => x / 255); const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
        const teal = read('--brand: #007a70; --paper-light: #ffffff;', 'page');
        const orange = read('--brand: #d04a04; --paper-light: #ffffff;', 'page');
        const band = read('--brand: #007a70; --paper-light: #ffffff; --paper-dark: rgb(11 17 30);', 'band');
        return { teal, orange: { ...orange, hue: hue(orange.rgb), dialHue: hue([0xd0, 0x4a, 0x04]) }, band };
      });
      const check = (ok, msg) => { checked++; if (!ok) { failed++; fails.push(`  FAIL [${name}] ${msg}`); } };
      check(f.teal.hex === '#007a70' && f.teal.link === '#007a70', `field: --brand: #007a70 on white: --brand-on-soft is ${f.teal.hex} and --link ${f.teal.link}, expected #007a70 kept as set, as it already passes on white (got ${f.teal.worst.toFixed(2)}:1 at worst)`);
      check(f.orange.worst >= 4.5 && f.orange.worst <= 4.85 && Math.abs(f.orange.hue - f.orange.dialHue) < 4, `field: --brand: #d04a04 on white: --brand-on-soft is ${f.orange.hex}, ${f.orange.worst.toFixed(2)}:1 at worst, hue ${f.orange.hue.toFixed(1)} (dial ${f.orange.dialHue.toFixed(1)}); expected 4.5 to 4.85:1 and the same hue`);
      check(f.band.worst >= 4.5 && f.band.onSurface <= 5.3, `field: teal on a navy .is-dark band: --brand-on-soft is ${f.band.hex}, ${f.band.onSurface.toFixed(2)}:1 on the band, ${f.band.worst.toFixed(2)}:1 at worst; expected 4.5 to 5.3:1`);
      if (args.verbose || name === BROWSERS[0]) console.log(`  field [${name}]: teal ${f.teal.hex} (${f.teal.worst.toFixed(2)}:1 at worst), orange ${f.orange.hex} (${f.orange.worst.toFixed(2)}:1), teal on the navy band ${f.band.hex} (${f.band.onSurface.toFixed(2)}:1 on the band, ${f.band.worst.toFixed(2)}:1 at worst)`);
    }
    for (const e of errors) { failed++; fails.push(`  FAIL [${name}] page error: ${e}`); }
    fails.slice(0, 200).forEach(f => console.log(f));
    if (fails.length > 200) console.log(`  … and ${fails.length - 200} more`);
    const line = `${name} ${browser.version()}${MODE === 'fallback' ? ', fallback' : ''}: ${inputs.length} inputs (dials.css, ${themes.length} themes, ${RANDOM} random dial sets, seed ${SEED}) × ${SCHEMES.length} schemes, ` +
      `${checked} pairings checked, ${failed} failed, ${skipped} excepted. Tightest pass: ${worst.input} ${worst.scheme} ${worst.fg} on ${worst.bg} ${worst.ratio?.toFixed(2)} (min ${worst.min}).` +
      (RANDOM ? ` Random dial sets: ${rnd.checked - rnd.failed} of ${rnd.checked} pairings pass (${(100 * (rnd.checked - rnd.failed) / rnd.checked).toFixed(1)}%), ${RANDOM - rnd.sets.size} of ${RANDOM} sets pass in full.` : '');
    summary.push(line);
    summary.push('  ' + Object.entries(byKind).map(([k, r]) => k === 'overshoot'
      ? `most a moved colour clears its target by: ${r.fg} ${r.ratio.toFixed(2)} (min ${r.min}, ${r.input} ${r.scheme})`
      : `tightest ${k}: ${r.fg} on ${r.bg} ${r.ratio.toFixed(2)} (min ${r.min}, ${r.input} ${r.scheme})`).join('\n  '));
    if (failed) exitCode = 1;
    await browser.close();
  }
} finally { await server.close(); }
console.log('\n' + summary.join('\n'));
console.log(exitCode ? 'Contrast check FAILED' : 'Contrast check passed');
process.exit(exitCode);
