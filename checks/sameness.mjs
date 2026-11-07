// Sameness check: the built dials.css paints every colour token as v0.4.0's did.
// 0.4.1 rewrote the relative colours that read a hue back from a pale mix or a near-grey (which
// Chrome 157 reads as none, so soft tints painted pink) to change a and b in oklab instead. That is
// the same colour by construction; this check proves it as painted. It loads v0.4.0's dials.css
// (checks/fixtures/v0.4.0/dials.css, verbatim: never edit it) and the built one on two pages, with
// the same dials: none, each themes/*.css, exact papers (--paper-light, --paper-dark), and seeded
// extreme random dials, some with exact papers. In a light page, a dark page and an .is-dark band, every
// colour token in docs/tokens.json, for every group, must paint within 1/255 per channel of v0.4.0's.
//
//   node checks/sameness.mjs [--browser=chromium|firefox] [--random=40] [--seed=1] [--verbose]
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve, launch, pageHelpers, randomSets, mulberry32, ROOT } from './lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const BROWSERS = args.browser ? [args.browser] : ['chromium', 'firefox'];
const RANDOM = +(args.random ?? 40), SEED = +(args.seed ?? 1);
const TOLERANCE = 1;   // per channel, 0-255
const SCHEMES = [['light', 'light', 'page'], ['dark', 'dark', 'page'], ['band', 'light', 'band']];

const reference = JSON.parse(readFileSync(join(ROOT, 'docs/tokens.json'), 'utf8'));
const TOKENS = reference.tokens.filter(t => t.kind === 'token' && t.file === 'dials-colour.css').map(t => t.name);
if (!TOKENS.includes('--brand-soft')) { console.error('sameness.mjs: no colour tokens found in docs/tokens.json'); process.exit(1); }

// exact papers: a site setting the page colour itself (Hampstead's dark navy among them), so the
// paper's lightness isn't --paper-lightness or --paper-dark-lightness
const EXACT = [
  { '--paper-dark': 'hsl(207 62% 10%)' },
  { '--paper-light': 'hsl(40 50% 96%)', '--paper-dark': 'hsl(207 62% 10%)' },
  { '--paper-light': 'hsl(200 30% 90%)', '--paper-dark': 'hsl(30 20% 22%)', '--brand': 'hsl(174 100% 24%)' },
  { '--paper-light': 'white', '--paper-dark': 'black', '--tint-strength': '20%', '--tint-vividness': 3 },
];
const r = mulberry32(SEED + 1000);
const randomPaper = (light) => `oklch(${(light ? 0.88 + r() * 0.12 : r() * 0.3).toFixed(3)} ${(r() * 0.06).toFixed(3)} ${Math.round(r() * 360)})`;
const sets = randomSets(RANDOM, SEED).map((s, i) => i % 4 === 3
  ? { name: s.name + '+exact-paper', dials: { ...s.dials, '--paper-light': randomPaper(true), '--paper-dark': randomPaper(false) } } : s);
const themes = readdirSync(join(ROOT, 'themes')).filter(f => f.endsWith('.css')).map(f => f.slice(0, -4)).sort();
const inputs = [{ name: 'dials.css', theme: null },
  ...themes.map(t => ({ name: `theme:${t}`, theme: t })),
  ...themes.map(t => ({ name: `theme:${t}+exact-paper`, theme: t, dials: EXACT[1] })),
  ...EXACT.map((d, i) => ({ name: `exact-paper:${i + 1}`, theme: null, dials: d })),
  ...sets.map(s => ({ ...s, theme: null }))];
const css = d => d ? ':root {\n' + Object.entries(d).map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}' : '';

const page = (url) => {
  const theme = url.searchParams.get('theme');
  const sheet = url.searchParams.get('v') === 'old' ? '/checks/fixtures/v0.4.0/dials.css' : '/dials.css';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>sameness</title>
<link rel="stylesheet" href="${sheet}">${theme ? `<link rel="stylesheet" href="/themes/${theme}.css">` : ''}<style id="dials"></style></head>
<body><div id="page" style="color: rgb(1, 2, 3)"></div><div class="is-dark"><div id="band" style="color: rgb(1, 2, 3)"></div></div></body></html>`;
};

async function paint(p, dialsCss) {
  return p.evaluate(({ tokens, dialsCss, schemes }) => {
    document.getElementById('dials').textContent = dialsCss;
    const out = {};
    for (const [scheme, root, box] of schemes) {
      document.documentElement.style.colorScheme = root;
      const el = document.getElementById(box);
      for (const t of tokens) {
        let i = el.querySelector(`[data-v="${t}"]`);
        if (!i) { i = document.createElement('i'); i.dataset.v = t; i.style.color = `var(${t})`; el.appendChild(i); }
        const s = getComputedStyle(i).color;
        out[`${scheme} ${t}`] = s === 'rgb(1, 2, 3)' ? null : __rgba(s).slice(0, 4);
      }
    }
    return out;
  }, { tokens: TOKENS, dialsCss, schemes: SCHEMES });
}

const server = await serve({ '/__sameness': page });
let exitCode = 0;
try {
  for (const name of BROWSERS) {
    const browser = await launch(name);
    const [oldP, newP] = [await browser.newPage(), await browser.newPage()];
    for (const p of [oldP, newP]) await p.addInitScript(pageHelpers);
    let compared = 0, failed = 0, identical = 0, worst = { d: 0 };
    const soft = { compared: 0, worst: 0 };
    let lastTheme;
    for (const inp of inputs) {
      if (inp.theme !== lastTheme || lastTheme === undefined) {
        const q = inp.theme ? `&theme=${inp.theme}` : '';
        await oldP.goto(`${server.url}/__sameness?v=old${q}`); await newP.goto(`${server.url}/__sameness?v=new${q}`);
        lastTheme = inp.theme;
      }
      const [a, b] = [await paint(oldP, css(inp.dials)), await paint(newP, css(inp.dials))];
      for (const k of Object.keys(a)) {
        if (a[k] === null && b[k] === null) continue;   // not a colour (a shadow, a mix half)
        compared++;
        const d = a[k] && b[k] ? Math.max(...a[k].slice(0, 3).map((x, i) => Math.abs(x - b[k][i])), Math.abs(a[k][3] - b[k][3]) * 255) : Infinity;
        if (/-soft$/.test(k)) { soft.compared++; soft.worst = Math.max(soft.worst, d); }
        if (d === 0) identical++;
        if (d > worst.d) worst = { d, at: `${inp.name}, ${k}` };
        if (d > TOLERANCE) {
          failed++; exitCode = 1;
          if (failed <= 20 || args.verbose) console.log(`  FAIL ${name} ${inp.name} ${k}: v0.4.0 ${JSON.stringify(a[k])}, now ${JSON.stringify(b[k])}`);
        }
      }
    }
    console.log(`${name} ${browser.version()}: ${inputs.length} inputs (dials.css, ${themes.length} themes alone and with exact papers, ${EXACT.length} exact papers, ${RANDOM} random dial sets, seed ${SEED}) × ${SCHEMES.length} schemes: ` +
      `${compared} colours compared with v0.4.0 (${soft.compared} soft tints), ${identical} identical, ${failed} over ${TOLERANCE}/255. ` +
      `Largest difference ${worst.d === Infinity ? 'invalid' : worst.d.toFixed(3) + '/255'}${worst.at ? ` (${worst.at})` : ''}; soft tints at most ${soft.worst.toFixed(3)}/255`);
    await browser.close();
  }
} finally { await server.close(); }
process.exit(exitCode);
