// Type checks for the shipped files, in Chromium and Firefox:
// 1. The type dials always apply, with their defaults: every element dials-base.css styles renders
//    exactly the same with every type dial set to its default as with none set (a theme's own type
//    dials kept), in every computed property and every box, at a phone and a desktop width. Alone, with each shipped theme, after a
//    site reset loaded before dials-base.css, and in the playground's scoped demo under the page's
//    own rules. Against v0.2.0's files (checks/fixtures/v0.2.0/), only the type the defaults now
//    apply differs: line height, letter spacing and the weight of strong. And dials.css alone sets no
//    type on any element, even with every type dial set.
// 2. --leading, --tracking and --tracking-caps-total, across seeded random dial sets and three
//    widths: exact at their end points (--size--2, --size-0 and --size-5, the h1 step), monotonic between them,
//    held at the end values beyond them, and on the formula in between. --weight-strong follows
//    --weight-body, and --size-7 and --size-8 continue the scale.
// 3. dials-base.css with dials set: each family of dials moves only its own properties, a
//    [data-dials] scope applies its dials inside it only, .is-typeset opts in, and a browser without
//    tan(), atan2() and log() (emulated) keeps headings at --leading-display, flat.
// Exits 1 on failure.
//
//   node checks/type.mjs [--browser=chromium|firefox] [--random=30] [--seed=1] [--verbose]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { serve, launch, ROOT } from './lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const BROWSERS = args.browser ? [args.browser] : ['chromium', 'firefox'];
const RANDOM = +(args.random ?? 30), SEED = +(args.seed ?? 1);
const WIDTHS = [360, 1280];             // the defaults check: a phone and a desktop
const FORMULA_WIDTHS = [360, 800, 1280]; // the formulas: both ends of the screen range and between
const TYPE_PROPS = ['font-size', 'line-height', 'font-weight', 'letter-spacing', 'font-family', 'font-style', 'max-inline-size',
  'font-kerning', 'font-variant-numeric', 'font-feature-settings', 'font-optical-sizing', 'text-wrap-mode', 'text-wrap-style', 'text-transform'];
// Every type dial at its default: the values docs/tokens.md gives. Setting them must change nothing.
const DEFAULT_DIALS = { '--leading-body': '1.6', '--leading-display': '1.15', '--tracking-small': '0', '--tracking-display': '0',
  '--tracking-caps': '0', '--weight-body': '400', '--weight-heading': '600', '--line-length': 'none', '--font-accent': 'var(--font-body)' };
// What the defaults now apply that v0.2.0 didn't: the leading curve, letter spacing (0px rather than normal), the weight of strong,
// and the sizes that follow from the line heights.
const V02_CHANGED = new Set(['line-height', 'letter-spacing', 'font-weight', 'height', 'block-size', 'width', 'inline-size', 'perspective-origin', 'transform-origin']);
const ALL_DIALS = { '--leading-body': '1.45', '--leading-display': '0.98', '--tracking-small': '0.04', '--tracking-display': '-0.05',
  '--tracking-caps': '0.1', '--weight-body': '300', '--weight-heading': '800', '--line-length': '40ch' };

// The supports test that guards the leading curve in dials.css and dials-base.css. Emulating a browser
// without tan(), atan2() and log() swaps it for one that's always false, in both.
const SUPPORTS = '@supports (width: calc(1px * tan(atan2(1px, 1px)) * log(2)))';
const [noTrig, noTrigBase] = ['dials.css', 'dials-base.css'].map(f => {
  const text = readFileSync(join(ROOT, f), 'utf8'), out = text.split(SUPPORTS).join('@supports (not-a-property: 0)');
  if (out === text) { console.error(`type.mjs: ${f} has no "${SUPPORTS}" block to emulate without`); process.exit(1); }
  return out;
});

// Every element dials-base.css styles, plus the same elements inside a parent that sets letter
// spacing, leading and weight.
const ELEMENTS = `
<h1>Heading one</h1><h2>Heading two with <strong>strong</strong> and <b>b</b></h2><h3>Heading three</h3><h4>Heading four</h4><h5>Heading five</h5><h6>Heading six</h6>
<p>A paragraph with <strong>strong</strong>, <b>b</b>, <em>em</em>, <small>small</small>, <a href="#x">a link</a>, <mark>mark</mark>, <code>code</code>, <kbd>kbd</kbd> and <samp>samp</samp>.</p>
<ul><li>One</li><li>Two</li></ul><ol><li>One</li><li>Two</li></ol>
<dl><dt>Term</dt><dd>Definition</dd></dl>
<blockquote><p>A quote.</p></blockquote>
<pre><code>pre code</code></pre><hr>
<figure><svg width="10" height="10"></svg><figcaption>A figure caption</figcaption></figure>
<details open><summary>Summary</summary><p>Details</p></details>
<table><caption>Caption</caption><thead><tr><th>Head</th><th>Cost</th></tr></thead><tbody><tr><td>Row</td><td>12.50</td></tr></tbody></table>
<form><fieldset><legend>Legend</legend><label for="f1">Label</label><input id="f1" value="Text"><select><option>Option</option></select><textarea>Area</textarea>
<input type="checkbox" checked><input type="radio"><input type="range"><progress value="1" max="2"></progress>
<button>Button</button><input type="submit" value="Submit"><input type="button" value="Input button"><input type="reset" value="Reset"><input aria-invalid="true" value="Bad"></fieldset></form>
<div style="letter-spacing: 0.1em; line-height: 2; font-weight: 300">
  <h3>Inherits</h3><p>Paragraph <strong>strong</strong> <small>small</small></p><figcaption>Caption</figcaption><pre>pre</pre>
  <table><caption>Caption</caption><tr><th>Head</th><td>1</td></tr></table><button>Button</button><label>Label</label><summary>Summary</summary><legend>Legend</legend>
</div>`;

// A site's reset loaded before dials-base.css, at zero specificity like base: base sets these
// properties in a cascade layer, so the reset still wins over it.
const RESET = `<style>* { letter-spacing: 0.01em; } :where(p, li, figcaption) { max-inline-size: 30em; } :where(strong, b) { font-weight: 800; } :where(pre, figcaption, caption) { line-height: 1.9; }</style>`;
// The playground's own page rules, which its scoped demo (.base-demo …, specificity 0,1,0) outranks.
const PAGE_RULES = `<style>p { margin: 0; max-width: 68ch; } h3 { letter-spacing: 0.02em; } small { letter-spacing: 0.03em; } strong { font-weight: 500; }</style>`;
const THEMES = readdirSync(join(ROOT, 'themes')).filter(f => f.endsWith('.css')).map(f => f.slice(0, -4)).sort();
const page = (head, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;
const sheet = (href) => `<link rel="stylesheet" href="${href}">`;
const dialStyle = (dials, sel = ':root') => `<style>${sel} { ${Object.entries(dials).map(([k, v]) => `${k}: ${v};`).join(' ')} }</style>`;

// probes for the formulas: every step, half steps, and sizes past both ends
const STEPS = [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8];
const PROBES = [
  ['below', 'calc(var(--size--2) * 0.8)'],
  ...STEPS.flatMap((n, i) => i ? [[`half${n}`, `calc((var(--size-${STEPS[i - 1]}) + var(--size-${n})) / 2)`], [`s${n}`, `var(--size-${n})`]] : [[`s${n}`, `var(--size-${n})`]]),
  ['above', 'calc(var(--size-8) * 1.3)'],
];
const FORMULA_BODY = `<style>.pr { line-height: var(--leading); letter-spacing: var(--tracking); } .pc { letter-spacing: var(--tracking-caps-total); } #w { font-weight: var(--weight-strong); }</style>
${PROBES.map(([id, size]) => `<div class="pr" id="${id}" style="font-size: ${size}">Ag</div><div class="pc" id="c-${id}" style="font-size: ${size}">AG</div>`).join('')}<div id="w">W</div>`;

const BASE_DIALS = `<p id="p">Body text with <strong id="st">strong</strong> and <small id="sm">small</small></p><h1 id="h1">Heading</h1><h3 id="h3">Heading <strong id="hst">strong</strong></h3><h6 id="h6">Small heading</h6>
<figcaption id="fc">Caption</figcaption><button id="btn">Button</button><label id="lb">Label</label>
<div data-dials id="scope" style="--leading-display: 1; --tracking-display: -0.06"><h1 id="sh1">Scoped heading</h1><p id="sp">Scoped body</p></div>
<div class="is-typeset" id="ts"><p id="tsp">Pretty paragraph</p><table><tr><td id="tstd">12.50</td></tr></table></div>
<style>#tok-lead { line-height: var(--leading); } #tok-trk { letter-spacing: var(--tracking); }</style>
<h1 id="tok-lead">x</h1><h1 id="tok-trk">x</h1>`;

const pages = {
  // the defaults cases: ?v=set sets every type dial to its default after the other files, ?v=none sets none,
  // ?v=old is nothing set with v0.2.0's files
  '/__defaults': (url) => {
    const v = url.searchParams.get('v'), old = v === 'old', theme = url.searchParams.get('theme'), kind = url.searchParams.get('kind');
    // a theme's own type dials stay: only the ones it leaves out are set to their defaults
    const own = theme ? readFileSync(join(ROOT, `themes/${theme}.css`), 'utf8') : '';
    const F = (f) => old ? `/checks/fixtures/v0.2.0/${f}` : `/${f}`, dials = v === 'set' ? dialStyle(Object.fromEntries(Object.entries(DEFAULT_DIALS).filter(([k]) => !own.includes(`${k}:`)))) : '';
    if (kind === 'demo') return page(sheet('/dials.css') + PAGE_RULES + sheet(old ? F('dials-base-demo.css') : '/site/dials-base-demo.css') + dials, `<div class="base-demo">${ELEMENTS}</div>`);
    return page(sheet('/dials.css') + (kind === 'reset' ? RESET : '') + sheet(F('dials-base.css')) + (theme ? sheet(F(`themes/${theme}.css`)) : '') + dials, ELEMENTS);
  },
  '/__bare': () => page('', ELEMENTS),
  '/__dials-only': () => page(sheet('/dials.css') + dialStyle(ALL_DIALS), ELEMENTS),
  '/__formula': (url) => page(sheet('/dials.css') + dialStyle(JSON.parse(url.searchParams.get('d') || '{}')), FORMULA_BODY),
  '/__base': (url) => page(sheet('/dials.css') + sheet('/dials-base.css') + dialStyle(JSON.parse(url.searchParams.get('d') || '{}')), BASE_DIALS),
  '/__notrig': (url) => page(`<style>${noTrig}</style><style>${noTrigBase}</style>` + dialStyle(JSON.parse(url.searchParams.get('d') || '{}')), BASE_DIALS),
};

// Reads every computed property (custom properties aside) and the box of every element, keyed by
// position, so two pages with the same markup can be compared element by element.
const READ_FULL = () => {
  const els = [document.documentElement, document.body, ...document.body.querySelectorAll('*')].filter(el => el.tagName !== 'STYLE' && el.tagName !== 'LINK');
  return els.map((el, i) => {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect(), props = {};
    for (let j = 0; j < cs.length; j++) if (!cs[j].startsWith('--')) props[cs[j]] = cs.getPropertyValue(cs[j]);
    return { el: `${i}:${el.tagName.toLowerCase()}${el.type && el.tagName === 'INPUT' ? `[${el.type}]` : ''}${el.parentElement?.hasAttribute('style') ? ' (in a styled parent)' : ''}`,
      box: [r.x + scrollX, r.y + scrollY, r.width, r.height], props };
  });
};
// Reads the type of every element in the page, keyed by its position, so two pages with the same
// markup can be compared element by element.
const READ_ALL = (props) => {
  const els = [document.documentElement, document.body, ...document.body.querySelectorAll('*')];
  return els.filter(el => el.tagName !== 'STYLE' && el.tagName !== 'LINK').map((el, i) => {
    const cs = getComputedStyle(el), o = { el: `${i}:${el.tagName.toLowerCase()}${el.type && el.tagName === 'INPUT' ? `[${el.type}]` : ''}${el.parentElement?.hasAttribute('style') ? ' (in a styled parent)' : ''}` };
    for (const p of props) o[p] = cs.getPropertyValue(p);
    return o;
  });
};
const num = (v) => v === 'normal' ? 0 : parseFloat(v);

// ---- seeded random dial sets ----
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function randomSets(n, seed) {
  const r = mulberry32(seed), between = (a, b, d = 3) => +(a + (b - a) * r()).toFixed(d), sets = [{}, { '--weight-body': 800 }];   // no dials (Dials' own values), and a body weight that --weight-strong caps at 900
  for (let i = 0; i < n; i++) {
    const d = { '--size-min': between(12, 22, 1), '--size-max': between(14, 26, 1), '--ratio-min': between(1.05, 1.5), '--ratio-max': between(1.05, 1.618) };
    // each type dial is left out now and then, so its default is tested too
    const maybe = (k, v) => { if (r() < 0.8) d[k] = v; };
    maybe('--leading-body', between(1.2, 2));
    maybe('--leading-display', between(0.85, 1.5));
    maybe('--tracking-small', between(-0.03, 0.1, 4));
    maybe('--tracking-display', between(-0.1, 0.05, 4));
    maybe('--tracking-caps', between(0, 0.15, 4));
    maybe('--weight-body', Math.round(between(100, 800, 0)));
    sets.push(d);
  }
  return sets;
}

const server = await serve(pages);
const failures = [];
let passes = 0;
const expect = (b, ok, what) => { if (ok) passes++; else failures.push(`[${b}] ${what}`); };
const summary = {};

try {
  for (const name of BROWSERS) {
    const browser = await launch(name), p = await browser.newPage();
    const errors = []; p.on('pageerror', e => errors.push(String(e)));
    const read = async (path, width) => { await p.setViewportSize({ width, height: 800 }); await p.goto(`${server.url}${path}`, { waitUntil: 'load' }); return p.evaluate(READ_ALL, TYPE_PROPS); };

    // ---- 1. every type dial at its default renders as nothing set; against v0.2.0 only the type the defaults apply moved ----
    const CASES = [['no theme', ''], ...THEMES.map(t => [`theme ${t}`, `&theme=${t}`]), ['a site reset before dials-base.css', '&kind=reset'], ["the playground's scoped demo", '&kind=demo']];
    const full = async (q, width) => { await p.setViewportSize({ width, height: 800 }); await p.goto(`${server.url}/__defaults?${q}`, { waitUntil: 'load' }); return p.evaluate(READ_FULL); };
    for (const width of WIDTHS) {
      const tally = [], since = {};
      for (const [label, q] of CASES) {
        const none = await full('v=none' + q, width), set = await full('v=set' + q, width);
        expect(name, none.length === set.length && none.length > 60, `${width}px, ${label}: the two pages have the same elements (${none.length} vs ${set.length})`);
        let props = 0, boxes = 0;
        const msgs = [], report = (msg) => msgs.push(msg);
        for (let i = 0; i < Math.min(none.length, set.length); i++) {
          const o = none[i], n = set[i];
          for (const k of new Set([...Object.keys(o.props), ...Object.keys(n.props)])) if (o.props[k] !== n.props[k]) { props++; report(`${n.el} ${k} is ${n.props[k]} with the defaults set, ${o.props[k]} with none set`); }
          if (o.box.some((v, j) => Math.abs(v - n.box[j]) > 0.01)) { boxes++; report(`${n.el} box is ${n.box.map(v => +v.toFixed(3)).join(', ')} with the defaults set, ${o.box.map(v => +v.toFixed(3)).join(', ')} with none set (x, y, width, height)`); }
        }
        // html and body grow with whatever changed inside them: list the elements that changed first
        msgs.sort((a, b) => /^[01]:(html|body)/.test(a) - /^[01]:(html|body)/.test(b));
        for (const m of msgs.slice(0, 12)) failures.push(`[${name}] ${width}px, ${label}: ${m}`);
        if (msgs.length > 12) failures.push(`[${name}] ${width}px, ${label}: … ${msgs.length - 12} more differences`);
        expect(name, !props && !boxes, `${width}px, ${label}: every type dial set to its default renders as none set (${props} properties and ${boxes} boxes differ)`);
        tally.push(props + boxes ? `${label}: ${props} properties, ${boxes} boxes differ` : null);
        if (label === 'no theme') { const h1 = none.find(e => /:h1$/.test(e.el)), h3 = none.find(e => /:h3$/.test(e.el)); summary[`${name} ${width}px no theme`] = `${none.length} elements, ${Object.keys(none[1].props).length} computed properties each, plus boxes (body ${none[1].props['font-size']}/${none[1].props['line-height']}, h1 ${h1.props['font-size']}/${h1.props['line-height']}, h3 ${h3.props['font-size']}/${h3.props['line-height']}, weight ${h1.props['font-weight']})`; }
        // against v0.2.0 (no dials set in either): only the type the defaults now apply differs. Themes that set type dials
        // now are left out: they're meant to look different
        if (label.startsWith('theme') && (!existsSync(join(ROOT, `checks/fixtures/v0.2.0/themes/${label.slice(6)}.css`))
          || Object.keys(DEFAULT_DIALS).some(k => readFileSync(join(ROOT, `themes/${label.slice(6)}.css`), 'utf8').includes(`${k}:`)))) continue;
        const old = await full('v=old' + q, width);
        for (let i = 0; i < Math.min(old.length, none.length); i++) for (const k of new Set([...Object.keys(old[i].props), ...Object.keys(none[i].props)])) {
          if (old[i].props[k] === none[i].props[k]) continue;
          const strong = /:(strong|b)$/.test(none[i].el);
          if (V02_CHANGED.has(k) && (k !== 'font-weight' || strong)) { since[k] = (since[k] || 0) + 1; continue; }
          failures.push(`[${name}] ${width}px, ${label}: ${none[i].el} ${k} is ${none[i].props[k]}, v0.2.0 gives ${old[i].props[k]}, and the defaults shouldn't move it`);
        }
      }
      summary[`${name} ${width}px`] = `${CASES.length} cases (no theme, ${THEMES.length} themes, a reset, the playground demo): ` + (tally.filter(Boolean).join('; ') || 'the defaults set render as none set') +
        `; since v0.2.0: ${Object.entries(since).map(([k, n]) => `${k} ×${n}`).join(', ')}`;
      // dials.css alone, with every type dial set, sets no type on any element
      const bare = await read('/__bare', width), only = await read('/__dials-only', width);
      let set = 0;
      for (let i = 0; i < bare.length; i++) for (const prop of TYPE_PROPS) {
        if (bare[i][prop] !== only[i]?.[prop]) { set++; failures.push(`[${name}] ${width}px: dials.css alone sets ${prop} on ${bare[i].el} (${only[i]?.[prop]}; no CSS gives ${bare[i][prop]})`); }
      }
      expect(name, set === 0, `${width}px: dials.css alone, with every type dial set, changes no element's type`);
    }

    // ---- 2. the formulas, across random dial sets ----
    const sets = randomSets(RANDOM, SEED);
    let worst = { lead: 0, trk: 0 };
    for (const [si, d] of sets.entries()) for (const width of FORMULA_WIDTHS) {
      await p.setViewportSize({ width, height: 800 });
      await p.goto(`${server.url}/__formula?d=${encodeURIComponent(JSON.stringify(d))}`, { waitUntil: 'load' });
      const m = await p.evaluate((ids) => {
        const o = {};
        for (const id of ids) { const a = getComputedStyle(document.getElementById(id)), c = getComputedStyle(document.getElementById('c-' + id)); o[id] = { size: parseFloat(a.fontSize), lh: a.lineHeight, ls: a.letterSpacing, caps: c.letterSpacing }; }
        o.weight = +getComputedStyle(document.getElementById('w')).fontWeight;
        return o;
      }, PROBES.map(x => x[0]));
      const tag = `set ${si}${si ? '' : ' (no dials)'} ${JSON.stringify(d)} at ${width}px`;
      const lb = +(d['--leading-body'] ?? 1.6), ld = +(d['--leading-display'] ?? 1.15);
      const ts = +(d['--tracking-small'] ?? 0), td = +(d['--tracking-display'] ?? 0), tc = +(d['--tracking-caps'] ?? 0);
      const B = m.s0.size, S = m['s-2'].size, D = m.s5.size;   // the display end is the h1 step
      // the reference formula, from the sizes the browser actually gave
      const leadRatio = (s) => { const k = D / B, mm = (ld * k - lb) / Math.max(k - 1, 1e-6), g = B * (lb - mm); return Math.min(Math.max(lb, ld), Math.max(Math.min(lb, ld), mm + g / s)); };
      const trackEm = (s) => { const c = (x) => Math.min(1, Math.max(0, x)); return td * c(Math.log(s / B) / Math.max(Math.log(D / B), 1e-6)) + ts * c(Math.log(B / s) / Math.max(Math.log(B / S), 1e-6)); };
      const ids = PROBES.map(x => x[0]);
      const ratio = (id) => num(m[id].lh) / m[id].size, em = (id) => num(m[id].ls) / m[id].size;
      // Firefox keeps lengths in 1/60px, and rounds an element's font size (up to 1/64px) while calc() works
      // with the exact --size-0. The reference uses the rounded size, so on a steep leading line (a big gap g)
      // it can differ from the true value by g / B times that rounding: the tolerance includes that bound.
      const k = D / B, mm = (ld * k - lb) / Math.max(k - 1, 1e-6);
      const tolPx = name === 'firefox' ? 0.03 + Math.abs(lb - mm) / 64 : 0.02;
      const at = (id, want, got, what) => { const err = Math.abs(got - want); expect(name, err <= tolPx, `${tag}: ${what} at ${id} (${m[id].size}px) is ${got.toFixed(4)}px, want ${want.toFixed(4)}px (tolerance ${tolPx.toFixed(4)}px)`); return err; };
      // end points, exactly
      at('s0', lb * B, num(m.s0.lh), 'line height');
      at('s5', ld * D, num(m.s5.lh), 'line height');
      at('s0', 0, num(m.s0.ls), 'letter spacing');
      at('s-2', ts * S, num(m['s-2'].ls), 'letter spacing');
      at('s5', td * D, num(m.s5.ls), 'letter spacing');
      // held at the end values beyond the ends: the display steps above h1 keep the display values
      for (const id of ['s6', 's7', 's8']) { at(id, ld * m[id].size, num(m[id].lh), 'line height (above the h1 step)'); at(id, td * m[id].size, num(m[id].ls), 'letter spacing (above the h1 step)'); }
      at('below', ts * m.below.size, num(m.below.ls), 'letter spacing (past the small end)');
      at('above', td * m.above.size, num(m.above.ls), 'letter spacing (past the display end)');
      at('above', ld * m.above.size, num(m.above.lh), 'line height (past the display end)');
      at('below', lb * m.below.size, num(m.below.lh), 'line height (below body size)');
      // on the formula everywhere, caps included
      for (const id of ids) {
        worst.lead = Math.max(worst.lead, at(id, leadRatio(m[id].size) * m[id].size, num(m[id].lh), 'line height'));
        worst.trk = Math.max(worst.trk, at(id, trackEm(m[id].size) * m[id].size, num(m[id].ls), 'letter spacing'));
        at(id, (trackEm(m[id].size) + tc) * m[id].size, num(m[id].caps), 'caps letter spacing');
      }
      // monotonic: the leading ratio moves one way from body to display; tracking moves one way on each side of body size
      const bySize = [...ids].sort((a, b) => m[a].size - m[b].size);
      let leadOk = true, trkOk = true;
      for (let i = 1; i < bySize.length; i++) {
        const a = bySize[i - 1], b = bySize[i];
        const eps = 2 * tolPx * 2 / m[a].size;   // a ratio or em can wobble by the rounding of two lengths, over the size
        const dr = ratio(b) - ratio(a);
        if (lb >= ld ? dr > eps : dr < -eps) leadOk = false;
        const ea = em(a), eb = em(b);
        if (m[b].size <= B + 0.01) { if (ts >= 0 ? eb - ea > eps : ea - eb > eps) trkOk = false; }   // from ts down to 0
        else if (m[a].size >= B - 0.01) { if (td >= 0 ? ea - eb > eps : eb - ea > eps) trkOk = false; }   // from 0 out to td
      }
      expect(name, leadOk, `${tag}: the leading ratio is monotonic in size (${bySize.map(id => ratio(id).toFixed(3)).join(' ')})`);
      expect(name, trkOk, `${tag}: tracking is monotonic on each side of body size (${bySize.map(id => em(id).toFixed(4)).join(' ')})`);
      // weight and the scale
      const wb = d['--weight-body'] ?? 400;
      expect(name, m.weight === Math.min(900, wb + 200), `${tag}: --weight-strong is ${m.weight}, want min(900, ${wb} + 200)`);
      expect(name, m.s6.size < m.s7.size && m.s7.size < m.s8.size, `${tag}: --size-6 < --size-7 < --size-8 (${m.s6.size}, ${m.s7.size}, ${m.s8.size})`);
    }
    summary[`${name} formulas`] = `${sets.length} dial sets × ${FORMULA_WIDTHS.length} widths × ${PROBES.length} sizes; furthest from the reference formula: line height ${worst.lead.toFixed(4)}px, letter spacing ${worst.trk.toFixed(4)}px`;

    // ---- 3. dials-base.css with dials set ----
    const base = async (path, d, width = 1280) => {
      await p.setViewportSize({ width, height: 800 });
      await p.goto(`${server.url}${path}?d=${encodeURIComponent(JSON.stringify(d))}`, { waitUntil: 'load' });
      return p.evaluate(() => {
        const o = {};
        for (const el of document.querySelectorAll('[id]')) { const cs = getComputedStyle(el); o[el.id] = { size: parseFloat(cs.fontSize), lh: cs.lineHeight, ls: cs.letterSpacing, w: +cs.fontWeight, max: cs.maxInlineSize, kern: cs.fontKerning, fvn: cs.fontVariantNumeric, wrap: cs.getPropertyValue('text-wrap-style') }; }
        return o;
      });
    };
    const near = (a, b, tol = 0.02) => Math.abs(num(a) - num(b)) <= tol;
    // leading only: headings and captions follow --leading; body stays a number, so it inherits as one; tracking stays off
    let r = await base('/__base', { '--leading-display': '1.05' });
    expect(name, near(r.h1.lh, r['tok-lead'].lh) && Math.abs(num(r.h1.lh) / r.h1.size - 1.15) > 0.005, `--leading-display alone: h1 line height ${r.h1.lh} follows --leading (${r['tok-lead'].lh}), not the default 1.15`);
    expect(name, Math.abs(num(r.h6.lh) / r.h6.size - 1.6) < 0.002 && Math.abs(num(r.p.lh) / r.p.size - 1.6) < 0.002, `--leading-display alone: body and an h6 below body size keep 1.6 (p ${r.p.lh} at ${r.p.size}px, h6 ${r.h6.lh} at ${r.h6.size}px)`);
    expect(name, num(r.h3.lh) / r.h3.size > 1.15 && num(r.h3.lh) / r.h3.size < 1.6, `--leading-display alone: h3 sits between the ends (${(num(r.h3.lh) / r.h3.size).toFixed(3)})`);
    expect(name, num(r.h1.ls) === 0 && num(r.sm.ls) === 0, `--leading-display alone: no letter spacing (h1 ${r.h1.ls}, small ${r.sm.ls})`);
    expect(name, r.st.w === 600 && r.h1.w === 600 && r.btn.w === 600, `--leading-display alone: weights at their defaults (strong ${r.st.w}, h1 ${r.h1.w}, button ${r.btn.w})`);
    // tracking only
    r = await base('/__base', { '--tracking-display': '-0.04', '--tracking-small': '0.03' });
    expect(name, num(r.h1.ls) < 0 && near(r.h1.ls, r['tok-trk'].ls, 0.01), `--tracking-*: h1 letter spacing ${r.h1.ls} follows --tracking (${r['tok-trk'].ls})`);
    expect(name, num(r.sm.ls) > 0 && num(r.fc.ls) > 0 && num(r.btn.ls) > 0, `--tracking-small: small, figcaption and button text loosen (${r.sm.ls}, ${r.fc.ls}, ${r.btn.ls})`);
    expect(name, Math.abs(num(r.h1.lh) / r.h1.size - 1.15) < 0.002, `--tracking-* alone: h1 keeps 1.15 (${r.h1.lh})`);
    // weight
    r = await base('/__base', { '--weight-body': '300', '--weight-heading': '750' });
    expect(name, r.p.w === 300 && r.st.w === 500 && r.btn.w === 500 && r.lb.w === 500 && r.h1.w === 750, `--weight-body 300, --weight-heading 750: body ${r.p.w}, strong ${r.st.w}, button ${r.btn.w}, label ${r.lb.w}, h1 ${r.h1.w}`);
    expect(name, r.hst.w > r.h3.w, `--weight-body: strong inside a heading stays bolder than the heading (${r.hst.w} vs ${r.h3.w})`);
    // line length
    r = await base('/__base', { '--line-length': '30ch' });
    expect(name, r.p.max !== 'none' && r.h1.max === 'none', `--line-length: paragraphs get a max inline size (${r.p.max}), headings don't (${r.h1.max})`);
    // with no dials set, the curve applies with its defaults: h1 1.15, an h3 between it and body's 1.6, no letter spacing, strong 600
    r = await base('/__base', {});
    expect(name, Math.abs(num(r.h1.lh) / r.h1.size - 1.15) < 0.002 && num(r.h3.lh) / r.h3.size > 1.16 && num(r.h3.lh) / r.h3.size < 1.59,
      `no dials set: h1 1.15 (${(num(r.h1.lh) / r.h1.size).toFixed(3)}), h3 on the curve between 1.15 and 1.6 (${(num(r.h3.lh) / r.h3.size).toFixed(3)})`);
    expect(name, num(r.h1.ls) === 0 && num(r.sm.ls) === 0 && r.st.w === 600 && r.p.max === 'none', `no dials set: no letter spacing (${r.h1.ls}, ${r.sm.ls}), strong ${r.st.w}, no line-length cap (${r.p.max})`);
    // a [data-dials] scope applies its dials inside it only
    expect(name, Math.abs(num(r.sh1.lh) / r.sh1.size - 1.15) > 0.005 && num(r.sh1.ls) < 0, `a [data-dials] scope with leading and tracking dials applies them inside it (h1 ${r.sh1.lh} at ${r.sh1.size}px, ${r.sh1.ls})`);
    expect(name, Math.abs(num(r.h1.lh) / r.h1.size - 1.15) < 0.002 && num(r.h1.ls) === 0, `outside the scope nothing changes (h1 ${r.h1.lh}, ${r.h1.ls})`);
    // .is-typeset opts in
    expect(name, r.tsp.kern === 'normal' && r.p.kern === 'auto', `.is-typeset turns kerning on inside it only (${r.tsp.kern} vs ${r.p.kern})`);
    expect(name, r.tstd.fvn === 'tabular-nums', `.is-typeset gives tables tabular figures (${r.tstd.fvn})`);
    if (await p.evaluate(() => CSS.supports('text-wrap-style', 'pretty'))) expect(name, r.tsp.wrap === 'pretty' && r.p.wrap !== 'pretty', `.is-typeset wraps paragraphs pretty inside it only (${r.tsp.wrap} vs ${r.p.wrap})`);
    // without tan(), atan2() and log() (emulated): headings at --leading-display flat, no tracking, nothing invalid
    r = await base('/__notrig', { '--leading-display': '1.05', '--leading-body': '1.5', '--tracking-display': '-0.04' });
    expect(name, Math.abs(num(r.h1.lh) / r.h1.size - 1.05) < 0.002 && Math.abs(num(r.h3.lh) / r.h3.size - 1.05) < 0.002, `no trig (emulated): headings keep --leading-display flat (h1 ${(num(r.h1.lh) / r.h1.size).toFixed(3)}, h3 ${(num(r.h3.lh) / r.h3.size).toFixed(3)})`);
    expect(name, Math.abs(num(r.p.lh) / r.p.size - 1.5) < 0.002 && num(r.h1.ls) === 0, `no trig (emulated): body takes --leading-body (${(num(r.p.lh) / r.p.size).toFixed(3)}), letter spacing stays normal (${r.h1.ls})`);

    for (const e of errors) failures.push(`[${name}] page error: ${e}`);
    console.log(`${name} ${browser.version()}: done`);
    await browser.close();
  }
} finally { await server.close(); }
for (const [k, v] of Object.entries(summary)) console.log(`  ${k}: ${v}`);
const shown = args.verbose ? failures : failures.slice(0, 40);
shown.forEach(f => console.log('  FAIL ' + f));
if (shown.length < failures.length) console.log(`  … and ${failures.length - shown.length} more (--verbose for all)`);
console.log(`${passes} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
