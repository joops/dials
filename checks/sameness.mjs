// Sameness check: the built dials.css paints every colour token, and every hover and pressed state,
// as the last release's did. 0.4.1 rewrote the relative colours that read a hue back from a pale mix
// or a near-grey (which Chrome 157 reads as none, so soft tints painted pink) to change a and b in
// oklab instead; 0.4.2 did the same to --mix-hover and --mix-active, which read it from currentColor
// (grey text). That is the same colour by construction; this check proves it as painted. It loads the
// fixture's dials.css and dials-base.css (checks/fixtures/<against>/, verbatim: never edit them) and
// the built ones on two pages, with the same dials: none, each themes/*.css, exact papers
// (--paper-light, --paper-dark), and seeded extreme random dials, some with exact papers. In a light
// page, a dark page and an .is-dark band:
//   - every colour token in docs/tokens.json, for every group, paints as the fixture's;
//   - the hover and pressed mixes (color-mix(in oklch, var(--solid), var(--mix-hover)), as
//     dials-base.css's buttons use them), for every group, with the button's own text colour and with
//     grey and coloured text, paint as the fixture's;
//   - with no dials, each theme alone and each exact paper, a real <button> per group and text colour,
//     hovered and pressed with the mouse, paints its background as the fixture's.
// Against v0.4.1 (the default) the tolerance is 0/255 per channel; against v0.4.0 (no base fixture,
// so tokens only) it is 1/255.
//
//   node checks/sameness.mjs [--browser=chromium|firefox] [--against=v0.4.1|v0.4.0] [--random=40] [--seed=1] [--verbose]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { serve, launch, pageHelpers, randomSets, mulberry32, ROOT } from './lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const BROWSERS = args.browser ? [args.browser] : ['chromium', 'firefox'];
const RANDOM = +(args.random ?? 40), SEED = +(args.seed ?? 1);
const AGAINST = args.against ?? 'v0.4.1';
const FIXTURE = `/checks/fixtures/${AGAINST}`;
if (!existsSync(join(ROOT, FIXTURE, 'dials.css'))) { console.error(`sameness.mjs: no fixture ${FIXTURE}/dials.css`); process.exit(1); }
const STATES = existsSync(join(ROOT, FIXTURE, 'dials-base.css'));   // hover and pressed need dials-base.css
const TOLERANCE = +(args.tolerance ?? (AGAINST === 'v0.4.0' ? 1 : 0));   // per channel, 0-255
// the hover and pressed states: every group, each with the button's own text (on-solid: white or
// black, a grey) and forced grey and coloured text
const GROUPS = ['', 'is-brand', 'is-secondary', 'is-neutral', 'is-success', 'is-warning', 'is-danger', 'is-info', 'is-accent'];
const TEXTS = ['own', 'var(--text)', 'var(--text-quiet)', 'hsl(0 0% 50%)', 'hsl(0 0% 92%)', 'var(--brand-on-soft)', 'var(--danger-on-soft)', 'hsl(200 80% 40%)'];
const REAL_TEXTS = ['own', 'hsl(0 0% 50%)', 'var(--brand-on-soft)'];
const GREY_C = 0.03;          // OKLCH chroma under which a text colour counts as near-grey
const HUE_TOLERANCE = +(args['hue-tolerance'] ?? 0.5);   // degrees
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
const inputs = [{ name: 'dials.css', theme: null, real: true },
  ...themes.map(t => ({ name: `theme:${t}`, theme: t, real: true })),
  ...themes.map(t => ({ name: `theme:${t}+exact-paper`, theme: t, dials: EXACT[1] })),
  ...EXACT.map((d, i) => ({ name: `exact-paper:${i + 1}`, theme: null, dials: d, real: true })),
  ...sets.map(s => ({ ...s, theme: null, random: true }))];
const css = d => d ? ':root {\n' + Object.entries(d).map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}' : '';

const page = (url) => {
  const theme = url.searchParams.get('theme');
  const dir = url.searchParams.get('v') === 'old' ? FIXTURE : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>sameness</title>
<link rel="stylesheet" href="${dir}/dials.css">${STATES ? `<link rel="stylesheet" href="${dir}/dials-base.css">` : ''}${theme ? `<link rel="stylesheet" href="/themes/${theme}.css">` : ''}<style id="dials"></style></head>
<body><div id="page" style="color: rgb(1, 2, 3)"></div><div class="is-dark"><div id="band" style="color: rgb(1, 2, 3)"></div></div>
<div id="buttons"></div></body></html>`;
};

async function paint(p, dialsCss) {
  return p.evaluate(({ tokens, dialsCss, schemes, states, groups, texts }) => {
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
      if (!states) continue;
      // the mixes as dials-base.css's buttons use them, worked out on a plain element
      for (const g of groups) for (const tx of texts) for (const st of ['hover', 'active']) {
        const key = `${g || 'no-group'} ${tx} ${st}`;
        let i = el.querySelector(`[data-m="${key}"]`);
        if (!i) {
          i = document.createElement('b'); i.dataset.m = key; if (g) i.className = g;
          i.style.color = tx === 'own' ? 'var(--on-solid)' : tx;
          i.style.background = `color-mix(in oklch, var(--solid), var(--mix-${st}))`;
          el.appendChild(i);
        }
        const s = getComputedStyle(i).backgroundColor;
        out[`${scheme} mix ${key}`] = s === 'rgba(0, 0, 0, 0)' ? 'invalid' : __rgba(s).slice(0, 4);
        // the same colours in OKLCH, unrounded: the mix, its fill and its text (a mix of a colour with itself)
        if (!i.dataset.ok) {
          for (const [n, v] of [['solid', 'var(--solid)'], ['text', 'currentColor']]) {
            const j = document.createElement('u'); j.dataset.n = n; j.style.background = `color-mix(in oklch, ${v}, ${v})`; i.appendChild(j);
          }
          i.dataset.ok = 1;
        }
        const lch = (x) => { const m = /^oklch\(([-\d.e]+) ([-\d.e]+) ([-\d.e]+|none)/.exec(x); return m ? [+m[1], +m[2], m[3] === 'none' ? null : +m[3]] : x; };
        out[`${scheme} lch ${key}`] = { mix: lch(s), solid: lch(getComputedStyle(i.querySelector('[data-n=solid]')).backgroundColor), text: lch(getComputedStyle(i.querySelector('[data-n=text]')).backgroundColor) };
      }
    }
    return out;
  }, { tokens: TOKENS, dialsCss, schemes: SCHEMES, states: STATES, groups: GROUPS, texts: TEXTS });
}

// Real buttons, hovered and pressed with the mouse: the background each paints, by scheme, group and text.
async function press(p) {
  await p.evaluate(({ schemes, groups, texts }) => {
    const host = document.getElementById('buttons');
    if (host.childElementCount) return;
    for (const [scheme, root, box] of schemes) for (const g of groups) for (const tx of texts) {
      const wrap = box === 'band' ? Object.assign(document.createElement('div'), { className: 'is-dark' }) : document.createElement('div');
      const b = document.createElement('button');
      b.dataset.k = `${scheme} ${g || 'no-group'} ${tx}`; b.dataset.root = root; b.textContent = 'Book';
      if (g) b.className = g;
      if (tx !== 'own') b.style.color = tx;
      wrap.appendChild(b); host.appendChild(wrap);
    }
  }, { schemes: SCHEMES, groups: GROUPS, texts: REAL_TEXTS });
  const out = {};
  const read = (k) => p.evaluate(k => __rgba(getComputedStyle(document.querySelector(`#buttons button[data-k="${k}"]`)).backgroundColor).slice(0, 4), k);
  for (const root of ['light', 'dark']) {
    await p.evaluate(r => { document.documentElement.style.colorScheme = r; window.scrollTo(0, 0); }, root);
    const keys = await p.$$eval('#buttons button', (bs, r) => bs.filter(b => b.dataset.root === r).map(b => b.dataset.k), root);
    for (const k of keys) {
      const [x, y] = await p.evaluate(k => { const b = document.querySelector(`#buttons button[data-k="${k}"]`); b.scrollIntoView({ block: 'center' }); const q = b.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, k);
      await p.mouse.move(x, y);
      out[`${k} real-hover`] = await read(k);
      await p.mouse.down();
      out[`${k} real-active`] = await read(k);
      await p.mouse.up();
    }
  }
  await p.mouse.move(0, 0);
  return out;
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
    const states = { compared: 0, real: 0, worst: 0, at: '', grey: 0, corrected: 0, correctedWorst: 0, correctedMax: { d: 0 } };
    let lastTheme;
    for (const inp of inputs) {
      if (inp.theme !== lastTheme || lastTheme === undefined) {
        const q = inp.theme ? `&theme=${inp.theme}` : '';
        await oldP.goto(`${server.url}/__sameness?v=old${q}`); await newP.goto(`${server.url}/__sameness?v=new${q}`);
        lastTheme = inp.theme;
      }
      const [a, b] = [await paint(oldP, css(inp.dials)), await paint(newP, css(inp.dials))];
      if (STATES && inp.real) Object.assign(a, await press(oldP)), Object.assign(b, await press(newP));
      for (const k of Object.keys(a)) {
        if (a[k] === null && b[k] === null) continue;   // not a colour (a shadow, a mix half)
        if (/ lch /.test(k)) continue;                    // read with its mix, below
        // a real button paints what its mix works out, in each version
        const rm = / real-(hover|active)$/.exec(k);
        if (rm) {
          const [sch, ...rest] = k.replace(/ real-(hover|active)$/, '').split(' ');
          const mk = `${sch} mix ${rest.join(' ')} ${rm[1]}`;
          for (const [v, side] of [[AGAINST, a], ['now', b]]) {
            const dd = Math.max(...side[k].slice(0, 3).map((x, i) => Math.abs(x - side[mk][i])));
            if (dd > 0) { failed++; exitCode = 1; console.log(`  FAIL ${name} ${inp.name} ${k}: the real button (${v}) paints ${JSON.stringify(side[k])}, its mix ${JSON.stringify(side[mk])}`); }
          }
          states.compared++; states.real++;
          continue;
        }
        if (a[k] === 'invalid' || b[k] === 'invalid') {
          failed++; exitCode = 1;
          if (failed <= 20 || args.verbose) console.log(`  FAIL ${name} ${inp.name} ${k}: invalid (${AGAINST} ${a[k]}, now ${b[k]})`);
          continue;
        }
        compared++;
        const d = a[k] && b[k] ? Math.max(...a[k].slice(0, 3).map((x, i) => Math.abs(x - b[k][i])), Math.abs(a[k][3] - b[k][3]) * 255) : Infinity;
        if (/-soft$/.test(k)) { soft.compared++; soft.worst = Math.max(soft.worst, d); }
        if (/ (hover|active)$/.test(k)) {
          states.compared++;
          if (/ (own|hsl\(0 0% \d+%\)|var\(--text(-quiet)?\)) (hover|active)$/.test(k)) states.grey++;
          const lc = b[k.replace(' mix ', ' lch ')];
          if (d > states.worst && !(lc && Array.isArray(lc.text) && lc.text[1] < GREY_C)) states.worst = d;
        }
        if (d === 0) identical++;
        if (d > worst.d) worst = { d, at: `${inp.name}, ${k}` };
        // hover and pressed: where the text is near-grey, the fixture's mix may have read the grey's
        // hue back (0.4.1 did, so its mix was dragged round towards hue 0 in every browser); 0.4.2's
        // must then keep the fill's own hue. Anywhere else it must paint as the fixture's.
        const lk = k.replace(' mix ', ' lch ');
        if (d > TOLERANCE && b[lk] && AGAINST === 'v0.4.1') {
          const { mix, solid, text } = b[lk];
          const grey = Array.isArray(text) && text[1] < GREY_C;
          const hd = Array.isArray(mix) && Array.isArray(solid) ? Math.abs(((mix[2] ?? solid[2] ?? 0) - (solid[2] ?? 0) + 540) % 360 - 180) : Infinity;
          if (grey && (solid[1] < 0.01 || hd <= HUE_TOLERANCE)) {
            states.corrected++; states.correctedWorst = Math.max(states.correctedWorst, d);
            if (d > states.correctedMax.d) states.correctedMax = { d, at: `${inp.name}, ${k}: ${AGAINST} ${JSON.stringify(a[k])}, now ${JSON.stringify(b[k])}` };
            continue;
          }
          failed++; exitCode = 1;
          if (failed <= 20 || args.verbose) console.log(`  FAIL ${name} ${inp.name} ${k}: ${AGAINST} ${JSON.stringify(a[k])}, now ${JSON.stringify(b[k])} (text ${JSON.stringify(text)}, fill ${JSON.stringify(solid)}, mix ${JSON.stringify(mix)}${grey ? `: near-grey text, but the mix is ${hd.toFixed(2)}° off the fill's hue` : ''})`);
          continue;
        }
        if (d > TOLERANCE) {
          failed++; exitCode = 1;
          if (failed <= 20 || args.verbose) console.log(`  FAIL ${name} ${inp.name} ${k}: ${AGAINST} ${JSON.stringify(a[k])}, now ${JSON.stringify(b[k])}`);
        }
      }
    }
    console.log(`${name} ${browser.version()}: ${inputs.length} inputs (dials.css, ${themes.length} themes alone and with exact papers, ${EXACT.length} exact papers, ${RANDOM} random dial sets, seed ${SEED}) × ${SCHEMES.length} schemes: ` +
      `${compared} colours compared with ${AGAINST} (${soft.compared} soft tints; ${states.compared} hover and pressed, ${states.grey} of them with grey text, ${states.real} on real buttons), ${identical} identical, ${failed} over ${TOLERANCE}/255. ` +
      `Largest difference ${worst.d === Infinity ? 'invalid' : worst.d.toFixed(3) + '/255'}${worst.at ? ` (${worst.at})` : ''}; soft tints at most ${soft.worst.toFixed(3)}/255` +
      (STATES ? `; hover and pressed with coloured text at most ${states.worst.toFixed(3)}/255; ${states.corrected} with near-grey text no longer dragged towards hue 0 (now on the fill's hue, within ${HUE_TOLERANCE}°), by up to ${states.correctedWorst.toFixed(0)}/255${states.correctedMax.at ? ` (${states.correctedMax.at})` : ''}` : ' (no hover and pressed: the fixture has no dials-base.css)'));
    await browser.close();
  }
} finally { await server.close(); }
process.exit(exitCode);
