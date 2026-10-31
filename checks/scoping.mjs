// Behaviour checks for the shipped files, in Chromium and Firefox:
// [data-dials] scopes re-derive colour and space, --grey reaches paper and ink, exact paper
// overrides win, base rules lose to any later rule (states included), and the fallback for older
// browsers (emulated: see emulateFallback in lib.mjs) follows a site's dials, scopes and bands,
// while the last resort is flat. Exits 1 on failure.
//
//   node checks/scoping.mjs [--browser=chromium|firefox]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serve, launch, pageHelpers, emulateFallback, ROOT } from './lib.mjs';

const arg = process.argv.find(a => a.startsWith('--browser='));
const BROWSERS = arg ? [arg.split('=')[1]] : ['chromium', 'firefox'];
const dials = readFileSync(join(ROOT, 'dials.css'), 'utf8');
const ref = JSON.parse(readFileSync(join(ROOT, 'docs/tokens.json'), 'utf8'));
const COLOURS = ref.tokens.filter(t => t.file === 'dials-colour.css' && !/^--(gradient-solid|gradient-soft|shadow-[sml]|mix-hover|mix-active)$/.test(t.name)).map(t => t.name);
const fallback = emulateFallback(dials), flat = emulateFallback(dials, 'flat');
for (const [level, r] of [['color-mix', fallback], ['flat', flat]]) console.log(`emulated ${level} fallback, patched: ` + Object.entries(r.patched).map(([k, n]) => `${k} ×${n}`).join(', '));
if (!fallback.patched['@supports color-mix'] && !fallback.patched['@supports v0.1.0']) { console.error('scoping.mjs: dials.css has no fallback block to test'); process.exit(1); }

const TEST = () => `<!doctype html><html lang="en" style="color-scheme: light"><head><meta charset="utf-8">
<link rel="stylesheet" href="/dials.css"><link rel="stylesheet" href="/dials-base.css">
<style>:where(button) { background: rgb(9, 9, 9); } #user-input:focus-visible { outline-color: rgb(9, 9, 9); }</style></head><body>
<div id="root-probe"></div>
<div data-dials id="scoped" style="--brand: purple; --space-density: .8"><div id="scoped-probe"></div></div>
<div data-dials id="grey" style="--grey: hsl(220 60% 50%)"><div id="grey-probe"></div></div>
<div data-dials id="exact" style="--paper-light: #ffffff"><div id="exact-probe"></div></div>
<button id="btn">Button</button><input id="user-input">
</body></html>`;
// a site's own file after dials.css: a purple brand and exact paper; a green [data-dials] scope; a dark band
const FALLBACK = (url) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${url.searchParams.get('level') === 'flat' ? flat.css : fallback.css}</style><link rel="stylesheet" href="/dials-base.css">
<style>:root { --brand: purple; --paper-light: #fafafa; }</style></head><body>
<div id="root-probe"></div><button id="btn">Button</button><button id="danger" class="is-danger">Delete</button>
<div data-dials id="scoped" style="--brand: hsl(140 60% 30%)"><div id="scoped-probe"></div><button id="scoped-btn">Button</button>
  <button id="scoped-danger" data-dials class="is-danger">Delete</button></div>
<div class="is-dark" id="band"><div id="band-probe"></div></div>
</body></html>`;
const READ_FALLBACK = (colours) => {
  const col = (id, v) => { const el = document.getElementById(id); el.style.color = 'rgb(1, 2, 3)'; el.style.color = `var(${v})`; const s = getComputedStyle(el).color; return s === 'rgb(1, 2, 3)' ? null : __rgba(s); };
  const hue = (c) => { if (!c) return null; const [r, g, b] = c.slice(0, 3).map(x => x / 255), mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); if (!d) return null;
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
  const out = { invalid: [] };
  for (const id of ['root-probe', 'scoped-probe', 'band-probe']) for (const v of colours) if (!col(id, v)) out.invalid.push(`${v} in #${id}`);
  for (const [k, id, v] of [['brandSolid', 'root-probe', '--brand-solid'], ['brandSoft', 'root-probe', '--brand-soft'], ['link', 'root-probe', '--link'],
    ['scopedSolid', 'scoped-probe', '--brand-solid'], ['scopedLink', 'scoped-probe', '--link']]) out[k] = hue(col(id, v));
  const paint = (id) => { const s = getComputedStyle(document.getElementById(id)); return { bg: __rgba(s.backgroundColor), fg: __rgba(s.color) }; };
  for (const id of ['btn', 'danger', 'scoped-btn', 'scoped-danger']) { const p = paint(id); out[id] = { hue: hue(p.bg), ratio: __ratio(p.fg, p.bg), bg: __hex(p.bg), alpha: p.bg[3] }; }
  out.surface = __hex(col('root-probe', '--surface')); out.scopedSurface = __hex(col('scoped-probe', '--surface'));
  out.bandSurface = __lum(col('band-probe', '--surface')); out.bandText = __ratio(col('band-probe', '--text'), col('band-probe', '--surface'));
  out.declared = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim();
  const g = document.getElementById('root-probe'); g.style.backgroundImage = 'var(--gradient-solid)'; out.gradient = getComputedStyle(g).backgroundImage;
  out.scheme = getComputedStyle(document.documentElement).colorScheme; out.bandScheme = getComputedStyle(document.getElementById('band')).colorScheme;
  return out;
};
const near = (h, want, tol = 30) => h !== null && Math.min(Math.abs(h - want), 360 - Math.abs(h - want)) <= tol;

const server = await serve({ '/__scoping': TEST, '/__fallback': FALLBACK });
const failures = [];
let passes = 0;
const expect = (browser, ok, what) => { if (ok) passes++; else failures.push(`[${browser}] ${what}`); };

try {
  for (const name of BROWSERS) {
    const browser = await launch(name), p = await browser.newPage();
    await p.addInitScript(pageHelpers);
    const errors = []; p.on('pageerror', e => errors.push(String(e)));
    await p.goto(`${server.url}/__scoping`, { waitUntil: 'load' });
    const r = await p.evaluate(() => {
      const col = (id, v) => { const el = document.getElementById(id); el.style.color = `var(${v})`; return __hex(__rgba(getComputedStyle(el).color)); };
      const len = (id, v) => { const el = document.getElementById(id); el.style.width = `var(${v})`; el.style.display = 'block'; return parseFloat(getComputedStyle(el).width); };
      return {
        brandRoot: col('root-probe', '--brand-solid'), brandScoped: col('scoped-probe', '--brand-solid'),
        linkRoot: col('root-probe', '--link'), linkScoped: col('scoped-probe', '--link'),
        spaceRoot: len('root-probe', '--space-m'), spaceScoped: len('scoped-probe', '--space-m'),
        paperRoot: col('root-probe', '--surface'), paperGrey: col('grey-probe', '--surface'),
        inkRoot: col('root-probe', '--text-strong'), inkGrey: col('grey-probe', '--text-strong'),
        paperExact: col('exact-probe', '--surface'),
      };
    });
    expect(name, r.brandScoped !== r.brandRoot && r.brandScoped === '#800080', `[data-dials] --brand: --brand-solid ${r.brandRoot} -> ${r.brandScoped} (want #800080)`);
    expect(name, r.linkScoped !== r.linkRoot, `[data-dials] --brand: --link ${r.linkRoot} -> ${r.linkScoped}`);
    expect(name, Math.abs(r.spaceScoped - r.spaceRoot * 0.8) < 0.5, `[data-dials] --space-density .8: --space-m ${r.spaceRoot}px -> ${r.spaceScoped}px`);
    expect(name, r.paperGrey !== r.paperRoot && r.inkGrey !== r.inkRoot, `--grey changes paper (${r.paperRoot} -> ${r.paperGrey}) and ink (${r.inkRoot} -> ${r.inkGrey})`);
    expect(name, r.paperExact === '#ffffff', `--paper-light: #ffffff gives --surface ${r.paperExact}`);
    // base rules have zero specificity, states included: a later :where() rule still wins on hover
    await p.hover('#btn');
    const hoverBg = await p.$eval('#btn', el => getComputedStyle(el).backgroundColor);
    expect(name, hoverBg === 'rgb(9, 9, 9)', `a later zero-specificity rule beats base's button:hover (got ${hoverBg})`);
    await p.focus('#user-input'); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab');
    const ring = await p.$eval('#user-input', el => getComputedStyle(el).outlineColor);
    expect(name, ring === 'rgb(9, 9, 9)', `a later rule beats base's input:focus-visible (got ${ring})`);

    // the fallback, emulated (no relative colour, no light-dark()): it follows the site's dials
    await p.mouse.move(0, 0);
    await p.goto(`${server.url}/__fallback`, { waitUntil: 'load' });
    const fb = await p.evaluate(READ_FALLBACK, COLOURS);
    expect(name, !fb.invalid.length, `fallback: every colour token is valid on the page, in a scope and in a band (invalid: ${fb.invalid.slice(0, 6).join(', ')}${fb.invalid.length > 6 ? ' …' : ''})`);
    expect(name, near(fb.brandSolid, 300), `fallback: --brand: purple gives a purple --brand-solid (hue ${fb.brandSolid?.toFixed(0)})`);
    expect(name, near(fb.brandSoft, 300), `fallback: --brand: purple gives a purple --brand-soft (hue ${fb.brandSoft?.toFixed(0)})`);
    expect(name, near(fb.link, 300), `fallback: --brand: purple gives a purple --link (hue ${fb.link?.toFixed(0)})`);
    expect(name, near(fb.btn.hue, 300) && fb.btn.alpha === 1 && fb.btn.ratio >= 4.5, `fallback: a base button is purple with 4.5:1 text (hue ${fb.btn.hue?.toFixed(0)}, ${fb.btn.bg}, ${fb.btn.ratio.toFixed(2)}:1)`);
    expect(name, near(fb.danger.hue, 15, 25) && fb.danger.ratio >= 4.5, `fallback: an .is-danger button is red with 4.5:1 text (hue ${fb.danger.hue?.toFixed(0)}, ${fb.danger.bg}, ${fb.danger.ratio.toFixed(2)}:1)`);
    expect(name, fb.surface === '#fafafa', `fallback: --paper-light: #fafafa gives --surface ${fb.surface}`);
    expect(name, near(fb.scopedSolid, 140) && near(fb.scopedLink, 140) && near(fb['scoped-btn'].hue, 140), `fallback: a green [data-dials] scope re-derives --brand-solid, --link and its button (hues ${fb.scopedSolid?.toFixed(0)}, ${fb.scopedLink?.toFixed(0)}, ${fb['scoped-btn'].hue?.toFixed(0)})`);
    expect(name, fb.scopedSurface === '#fafafa', `fallback: the scope keeps the site's exact paper (${fb.scopedSurface})`);
    expect(name, near(fb['scoped-danger'].hue, 15, 25), `fallback: .is-danger still wins on a [data-dials] element (hue ${fb['scoped-danger'].hue?.toFixed(0)})`);
    expect(name, fb.bandSurface < 0.05 && fb.bandText >= 4.5 && fb.bandScheme === 'dark', `fallback: an .is-dark band is dark (paper luminance ${fb.bandSurface.toFixed(3)}, text ${fb.bandText.toFixed(2)}:1, scheme ${fb.bandScheme})`);
    expect(name, /gradient/.test(fb.gradient), `fallback: --gradient-solid is a valid gradient (got ${fb.gradient})`);
    expect(name, fb.scheme === 'light', `fallback: the page is light (got ${fb.scheme})`);

    // the last resort, emulated (no color-mix() either): valid, flat and in charge, scopes included
    await p.goto(`${server.url}/__fallback?level=flat`, { waitUntil: 'load' });
    const fl = await p.evaluate(READ_FALLBACK, COLOURS);
    expect(name, !fl.invalid.length, `last resort: every colour token is valid (invalid: ${fl.invalid.slice(0, 6).join(', ')})`);
    expect(name, /^#[0-9a-f]{6}$/.test(fl.declared), `last resort: --surface is a flat hex (got ${fl.declared})`);
    expect(name, fl.surface === fl.scopedSurface, `last resort: a [data-dials] scope keeps the flat values (${fl.surface} vs ${fl.scopedSurface})`);
    expect(name, fl.danger.alpha === 1 && fl.danger.ratio >= 4.5 && fl.danger.bg !== fl.btn.bg, `last resort: an .is-danger button has its own fill and 4.5:1 text (${fl.danger.bg}, ${fl.danger.ratio.toFixed(2)}:1)`);
    expect(name, fl.scheme === 'light' && fl.bandScheme === 'light', `last resort: the page and bands are light (got ${fl.scheme}, ${fl.bandScheme})`);
    for (const e of errors) failures.push(`[${name}] page error: ${e}`);
    console.log(`${name} ${browser.version()}: done`);
    await browser.close();
  }
} finally { await server.close(); }
failures.forEach(f => console.log('  FAIL ' + f));
console.log(`${passes} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
