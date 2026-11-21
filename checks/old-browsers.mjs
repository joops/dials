// Old-browser check: in a real older browser, every colour token is a valid colour (or the page
// takes the fallback, where it is one too). Playwright can only drive its own current builds, so this
// runs stock binaries you give it with their own headless --screenshot, on a page with one square per
// colour token in a light page, a dark page and an .is-dark band, each square over magenta: a square still
// magenta is a token the browser threw away at computed time (a transparent background). Which tokens
// are colours is taken from the current Chromium, where every one must paint. A browser that crashes
// the page (no screenshot, or no marker square) fails too.
//
// 0.4.3 exists because Firefox 128-132 and Chrome 125-130 passed the gate (relative colour and
// light-dark()) but can't use light-dark() as a relative colour's origin, so 36 colour tokens were
// invalid there and backgrounds went transparent.
//
//   node checks/old-browsers.mjs --firefox=/path/to/firefox-128/firefox [--chrome=/path/to/chrome] [--css=/dials.css] [--verbose]
//   (or DIALS_OLD_BROWSERS="firefox:/path:chrome:/path"); with no browser given it says so and fails.
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { serve, launch, ROOT } from './lib.mjs';

const argv = process.argv.slice(2);
const opt = (k) => argv.filter(a => a.startsWith(`--${k}=`)).map(a => a.slice(k.length + 3));
const browsers = [...opt('firefox').map(p => ['firefox', p]), ...opt('chrome').map(p => ['chrome', p])];
const env = (process.env.DIALS_OLD_BROWSERS || '').split(':');
for (let i = 0; i + 1 < env.length; i += 2) if (env[i] && env[i + 1]) browsers.push([env[i], env[i + 1]]);
const CSS = opt('css')[0] || '/dials.css';
const VERBOSE = argv.includes('--verbose');
if (!browsers.length) { console.error('old-browsers.mjs: no browser given (--firefox=<binary>, --chrome=<binary> or DIALS_OLD_BROWSERS)'); process.exit(1); }
for (const [, p] of browsers) if (!existsSync(p)) { console.error(`old-browsers.mjs: no such binary ${p}`); process.exit(1); }

const reference = JSON.parse(readFileSync(join(ROOT, 'docs/tokens.json'), 'utf8'));
const TOKENS = reference.tokens.filter(t => t.kind === 'token' && t.file === 'dials-colour.css').map(t => t.name);
// [id, color-scheme set on the column (none for the band: .is-dark sets its own), class]
const COLS = [['light', 'light', ''], ['dark', 'dark', ''], ['band', null, 'is-dark']];
const SQ = 12, PER_ROW = 10, BLOCK = (PER_ROW + 2) * SQ, W = 480, H = 300;   // a small grid: old Chrome caps its viewport
const page = () => `<!doctype html><html><head><link rel="stylesheet" href="${CSS}"><style>
html, body { margin: 0; padding: 0; background: #ff00fe !important; }
.col { position: absolute; top: 0; width: ${PER_ROW * SQ}px; display: flex; flex-wrap: wrap; background: #ff00fe !important; }
.s { width: ${SQ}px; height: ${SQ}px; }
.mark { background: #00ff00 !important; }
${COLS.map(([id, scheme], i) => `#${id} { left: ${i * BLOCK}px;${scheme ? ` color-scheme: ${scheme};` : ''} }`).join('\n')}
</style></head><body>${COLS.map(([id, , cls]) => `<div class="col ${cls}" id="${id}"><div class="s mark"></div>${TOKENS.map(t => `<div class="s" style="background: var(${t})"></div>`).join('')}<div class="s mark"></div></div>`).join('')}</body></html>`;

const run = (bin, args) => new Promise(res => execFile(bin, args, { timeout: 120000 }, (err, so, se) => res({ err, out: String(so) + String(se) })));
const server = await serve({ '/old-browsers.html': page });
const url = server.url + '/old-browsers.html';
const reader = await launch('chromium');
const rp = await reader.newPage();
// reads the centre of every square from a PNG: 'mark' ok?, then per column a list of [r,g,b]
async function readShot(png) {
  if (!existsSync(png)) return null;
  const b64 = readFileSync(png).toString('base64');
  return await rp.evaluate(async ({ b64, n, cols, SQ, PER_ROW, BLOCK }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    const at = (c, i) => [...ctx.getImageData(c * BLOCK + (i % PER_ROW) * SQ + SQ / 2, Math.floor(i / PER_ROW) * SQ + SQ / 2, 1, 1).data].slice(0, 3);
    return cols.map((_, c) => ({ mark: at(c, 0), end: at(c, n + 1), sq: Array.from({ length: n }, (_, i) => at(c, i + 1)) }));
  }, { b64, n: TOKENS.length, cols: COLS, SQ, PER_ROW, BLOCK });
}
const isMagenta = ([r, g, b]) => r > 250 && g < 5 && b > 249;
const isMark = ([r, g, b]) => r < 5 && g > 250 && b < 5;

// the current Chromium: which tokens are colours (paint at all), and they must paint in every column
const tmp = mkdtempSync(join(tmpdir(), 'dials-old-'));
await rp.setViewportSize({ width: W, height: H });
const cur = await reader.newPage({ viewport: { width: W, height: H } });
await cur.goto(url); await cur.screenshot({ path: join(tmp, 'current.png') });
const now = await readShot(join(tmp, 'current.png'));
const colour = TOKENS.filter((t, i) => now.every(col => !isMagenta(col.sq[i])));
const notColour = TOKENS.filter(t => !colour.includes(t));
console.log(`old-browsers.mjs: ${CSS}, ${colour.length} colour tokens (not colours, skipped: ${notColour.join(' ') || 'none'})`);
if (colour.length < 30) { console.error('old-browsers.mjs: too few colour tokens painted in the current Chromium'); await reader.close(); await server.close(); process.exit(1); }

let failed = 0;
for (const [kind, bin] of browsers) {
  const png = join(tmp, `${kind}-${failed}-${Math.random().toString(36).slice(2)}.png`);
  let r;
  if (kind === 'firefox') {
    const prof = mkdtempSync(join(tmp, 'prof-'));
    r = await run(bin, ['--headless', '-no-remote', '-profile', prof, `--window-size=${W},${H}`, '--screenshot', png, url]);
  } else {
    r = await run(bin, ['--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--window-size=${W},${H}`, `--screenshot=${png}`, url]);
  }
  const ver = (await run(bin, ['--version'])).out.trim().split('\n').pop();
  const shot = await readShot(png);
  if (shot && shot.every(c => isMark(c.mark)) && !shot.every(c => isMark(c.end))) { failed++; console.log(`  FAIL ${ver}: the screenshot was cut short (no end marker)`); continue; }
  if (!shot || !shot.every(c => isMark(c.mark))) { failed++; console.log(`  FAIL ${ver}: the page did not render (crashed or no screenshot)`); if (VERBOSE) console.log(r.out.slice(-800)); continue; }
  const bad = [];
  shot.forEach((col, c) => TOKENS.forEach((t, i) => { if (colour.includes(t) && isMagenta(col.sq[i])) bad.push(`${COLS[c][0]}:${t}`); }));
  if (bad.length) { failed++; console.log(`  FAIL ${ver}: ${bad.length} colour tokens invalid: ${(VERBOSE ? bad : bad.slice(0, 12)).join(' ')}${bad.length > 12 && !VERBOSE ? ' …' : ''}`); }
  else console.log(`  ok   ${ver}: every colour token is a colour, light, dark and .is-dark band`);
}
await reader.close(); await server.close();
console.log(failed ? `old-browsers.mjs: ${failed} of ${browsers.length} browsers FAILED` : `old-browsers.mjs: ${browsers.length} browsers passed`);
process.exit(failed ? 1 : 0);
