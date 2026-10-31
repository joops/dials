// Behaviour checks for the shipped files, in Chromium and Firefox:
// [data-dials] scopes re-derive colour and space, --grey reaches paper and ink, exact paper
// overrides win, base rules lose to any later rule (states included), and the fallback block
// is valid CSS that takes over when relative colour is missing (simulated). Exits 1 on failure.
//
//   node checks/scoping.mjs [--browser=chromium|firefox]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serve, launch, pageHelpers, ROOT } from './lib.mjs';

const arg = process.argv.find(a => a.startsWith('--browser='));
const BROWSERS = arg ? [arg.split('=')[1]] : ['chromium', 'firefox'];
const dials = readFileSync(join(ROOT, 'dials.css'), 'utf8');
const forced = dials.replace('@supports not (color: oklch(from red l c h))', '@supports (color: red)');
if (forced === dials) { console.error('scoping.mjs: dials.css has no fallback block to test'); process.exit(1); }

const TEST = () => `<!doctype html><html lang="en" style="color-scheme: light"><head><meta charset="utf-8">
<link rel="stylesheet" href="/dials.css"><link rel="stylesheet" href="/dials-base.css">
<style>:where(button) { background: rgb(9, 9, 9); } #user-input:focus-visible { outline-color: rgb(9, 9, 9); }</style></head><body>
<div id="root-probe"></div>
<div data-dials id="scoped" style="--brand: purple; --space-density: .8"><div id="scoped-probe"></div></div>
<div data-dials id="grey" style="--grey: hsl(220 60% 50%)"><div id="grey-probe"></div></div>
<div data-dials id="exact" style="--paper-light: #ffffff"><div id="exact-probe"></div></div>
<button id="btn">Button</button><input id="user-input">
</body></html>`;
const FALLBACK = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${forced}</style>
<link rel="stylesheet" href="/dials-base.css"></head><body><div id="root-probe"></div><div data-dials><div id="scoped-probe"></div></div>
<button id="btn" class="is-danger">Button</button></body></html>`;

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

    // the fallback block, forced on: valid, flat, and it wins over the derived chain, scopes included
    await p.goto(`${server.url}/__fallback`, { waitUntil: 'load' });
    const fb = await p.evaluate(() => {
      const col = (id, v) => { const el = document.getElementById(id); el.style.color = `var(${v})`; return getComputedStyle(el).color; };
      const btn = getComputedStyle(document.getElementById('btn'));
      return { surface: col('root-probe', '--surface'), scoped: col('scoped-probe', '--surface'), declared: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(),
        btnBg: btn.backgroundColor, btnFg: btn.color, scheme: getComputedStyle(document.documentElement).colorScheme };
    });
    expect(name, /^#[0-9a-f]{6}$/.test(fb.declared), `fallback: --surface is a flat hex (got ${fb.declared})`);
    expect(name, fb.surface === fb.scoped, `fallback: a [data-dials] scope keeps the flat values (${fb.surface} vs ${fb.scoped})`);
    expect(name, fb.btnBg !== 'rgba(0, 0, 0, 0)' && fb.btnBg !== fb.btnFg, `fallback: a base .is-danger button has a fill and text (${fb.btnBg} / ${fb.btnFg})`);
    expect(name, fb.scheme === 'light', `fallback: color-scheme is light (got ${fb.scheme})`);
    for (const e of errors) failures.push(`[${name}] page error: ${e}`);
    console.log(`${name} ${browser.version()}: done`);
    await browser.close();
  }
} finally { await server.close(); }
failures.forEach(f => console.log('  FAIL ' + f));
console.log(`${passes} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
