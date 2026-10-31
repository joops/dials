// Shared helpers for the Dials checks: a static server for the project, and browser launching.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

export const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8' };

// Serves the project root over HTTP on a free port. `pages` maps a path to HTML generated on the fly.
export async function serve(pages = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (pages[url.pathname]) { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(pages[url.pathname](url)); return; }
    const file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    try {
      const f = (await stat(file)).isDirectory() ? join(file, 'index.html') : file;
      const body = await readFile(f);
      res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) };
}

// Launches a Playwright browser. If Playwright's own Firefox build is missing, falls back to
// DIALS_FIREFOX or any Firefox build in the Playwright cache.
export async function launch(name) {
  const pw = await import('playwright');
  const type = pw[name];
  try { return await type.launch(); } catch (e) {
    if (name !== 'firefox') throw e;
    const cache = join(homedir(), '.cache', 'ms-playwright');
    const found = process.env.DIALS_FIREFOX || (existsSync(cache) && readdirSync(cache).filter(d => /^firefox-\d+$/.test(d)).sort().reverse()
      .map(d => join(cache, d, 'firefox', 'firefox')).find(existsSync));
    if (!found) throw e;
    return await type.launch({ executablePath: found });
  }
}

// In-page helpers (passed to page.addInitScript): resolve any CSS colour to sRGB via a canvas.
export function pageHelpers() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  // returns [r, g, b, a] in 0..255, the colour as the browser paints it (alpha measured over black and white)
  window.__rgba = (css) => {
    const px = (bg) => { ctx.globalCompositeOperation = 'copy'; ctx.fillStyle = bg; ctx.fillRect(0, 0, 1, 1); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
    const w = px('#fff'), k = px('#000');
    const a = 1 - (w[0] - k[0]) / 255;
    return [k[0], k[1], k[2], Math.round(a * 1000) / 1000, w];
  };
  window.__lum = (rgb) => { const f = x => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
  window.__ratio = (a, b) => { const x = __lum(a), y = __lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  window.__hex = (rgb) => '#' + rgb.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');
}

// Emulates an older browser on dials.css's text, for the checks' fallback modes. Turns the fallback
// blocks' @supports on, then breaks what such a browser lacks everywhere else, so a declaration that
// relies on it is invalid exactly as it would be there. 'color-mix' also breaks color-mix(), for the
// last resort. Returns the patched text and how many of each it patched, so a caller can see it applied.
export const FALLBACK_SUPPORTS = {
  'color-mix': '@supports not ((color: oklch(from red l c h)) and (color: light-dark(red, red)))',
  flat: '@supports not (color: color-mix(in srgb, red, blue))',
  'v0.1.0': '@supports not (color: oklch(from red l c h))',
};
export function emulateFallback(css, level = 'color-mix') {
  const patched = {};
  const sub = (label, re, to) => { let n = 0; css = css.replace(re, (...m) => { n++; return typeof to === 'function' ? to(...m) : to; }); patched[label] = n; };
  for (const [k, cond] of Object.entries(FALLBACK_SUPPORTS)) {
    if (k === 'flat' && level !== 'flat') continue;
    sub(`@supports ${k}`, new RegExp(cond.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '@supports (color: red)');
  }
  sub('relative colour', /\b(rgb|hsl|hwb|lab|lch|oklab|oklch|color)\(\s*from\s/g, (_, f) => `${f}(unsupported `);
  sub('light-dark()', /\blight-dark\(/g, 'unsupported-light-dark(');
  sub('gradient interpolation', /gradient\(\s*in\s+\w+/g, 'gradient(unsupported');
  if (level === 'flat') sub('color-mix()', /\bcolor-mix\(/g, 'unsupported-color-mix(');
  return { css, patched };
}
