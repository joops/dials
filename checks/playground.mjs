// Smoke test for the playground, served over HTTP in Chromium and Firefox: it loads with no console
// errors, and every colour, type and space preset, every theme, Randomise, the scheme switch, the
// tabs, the format switch and both export modes work. Exits 1 on failure.
//
//   node checks/playground.mjs [--browser=chromium|firefox]
import { serve, launch } from './lib.mjs';

const arg = process.argv.find(a => a.startsWith('--browser='));
const BROWSERS = arg ? [arg.split('=')[1]] : ['chromium', 'firefox'];
const server = await serve();
const failures = [];
let passes = 0;
const expect = (b, ok, what) => { if (ok) passes++; else failures.push(`[${b}] ${what}`); };

try {
  for (const name of BROWSERS) {
    const browser = await launch(name), p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    // the star count asks GitHub's API, which rate-limits; answer it here so the check never depends on the network
    await p.route('https://api.github.com/**', r => r.fulfill({ json: { stargazers_count: 7 } }));
    const errors = [];
    p.on('pageerror', e => errors.push(String(e)));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)\.com/.test(r.url())) errors.push(`request failed: ${r.url()}`); });
    await p.goto(`${server.url}/site/`, { waitUntil: 'load' });
    await p.waitForSelector('html[data-ready]', { timeout: 15000 });
    await p.waitForFunction(() => !!customElements.get('hsl-string-color-picker'), null, { timeout: 15000 }).catch(() => errors.push('the colour picker element never loaded'));
    const D = await p.evaluate(() => window.DIALS);

    // presets apply their dials
    for (const kind of ['colour', 'type', 'space']) {
      const attr = { colour: 'data-preset', type: 'data-typepreset', space: 'data-spacepreset' }[kind];
      for (const slug of Object.keys(D[kind])) {
        if (kind !== 'colour') await p.click(`[role=tab][aria-controls=tab-${kind}]`); else await p.click('[role=tab][aria-controls=tab-colour]');
        await p.click(`[${attr}="${slug}"]`);
        const bad = await p.evaluate(({ dials }) => Object.entries(dials).filter(([k, v]) => {
          if (/^--(brand|secondary|success|warning|danger|info|grey)$/.test(k)) return !document.documentElement.style.getPropertyValue(k);   // rewritten in the chosen format
          return document.documentElement.style.getPropertyValue(k).trim() !== String(v);
        }).map(([k]) => k), { dials: D[kind][slug].dials });
        expect(name, !bad.length, `${kind} preset ${slug}: not applied: ${bad.join(', ')}`);
      }
    }
    // every theme, from the menu
    for (const key of Object.keys(D.themes)) {
      await p.selectOption('#combo', key);
      const t = D.themes[key];
      const ok = await p.evaluate(({ t, D }) => {
        const s = document.documentElement.style;
        const want = { ...D.colour[t.colour].dials, ...D.type[t.type].dials, ...D.space[t.space].dials };
        return Object.entries(want).every(([k, v]) => /^--(brand|secondary|success|warning|danger|info|grey)$/.test(k) ? !!s.getPropertyValue(k) : s.getPropertyValue(k).trim() === String(v))
          && document.querySelector(`[data-preset="${t.colour}"]`).getAttribute('aria-pressed') === 'true';
      }, { t, D });
      const fails = await p.$eval('#summary', el => el.textContent);
      expect(name, ok, `theme ${key} did not apply all its dials`);
      expect(name, /(^|\D)0 fail/.test(fails), `theme ${key}: the playground's contrast table shows failures (${fails})`);
    }
    // randomise, schemes, format, export, tables
    await p.click('#shuffle');
    expect(name, await p.$eval('#combo', el => el.value) === '_shuffle', 'Randomise did not set a random combination');
    for (const s of ['dark', 'light', 'system']) {
      await p.click(`button[data-scheme="${s}"]`);
      const attr = await p.evaluate(() => document.documentElement.getAttribute('data-scheme'));
      expect(name, s === 'system' ? attr === null : attr === s, `scheme ${s}`);
    }
    await p.click('[role=tab][aria-controls=tab-colour]');
    await p.click('#k__brand');
    await p.click('button[data-format="oklch"]');
    expect(name, /^oklch\(/.test(await p.$eval('#k__brand_txt', el => el.value)), 'the format switch writes OKLCH');
    await p.click('button[data-format="hsl"]');
    await p.keyboard.press('Escape');
    const exportTheme = await p.$eval('#css', el => el.textContent);
    expect(name, /--brand: hsl\(/.test(exportTheme) && /--radius-base:/.test(exportTheme), 'theme export lists the dials');
    await p.click('[data-export="full"]');
    const exportFull = await p.$eval('#css', el => el.textContent);
    expect(name, exportFull.includes('--brand-on-solid') && exportFull.includes(':where(body)'), 'full export carries colour, scale and base');
    const counts = await p.evaluate(() => ({ tokens: document.querySelectorAll('#tokens tbody tr').length, contrast: document.querySelectorAll('#contrast tbody tr').length,
      rules: document.getElementById('rules-md').textContent.length, ladder: document.querySelectorAll('#ladder .r').length,
      demoBtn: getComputedStyle(document.querySelector('.base-demo button')).backgroundColor, demoCode: getComputedStyle(document.querySelector('.base-demo code')).fontFamily }));
    expect(name, counts.tokens > 50 && counts.contrast > 40 && counts.rules > 500 && counts.ladder === 11, `tables: ${JSON.stringify(counts)}`);
    expect(name, counts.demoBtn !== 'rgba(0, 0, 0, 0)', `the base demo's button has a fill (${counts.demoBtn})`);
    // the type dials that start unset: a preset clears the ones it doesn't set, a slider sets one, × unsets it, and the exports carry set ones only
    await p.click('[role=tab][aria-controls=tab-type]');
    await p.click('[data-typepreset="editorial"]');
    await p.click('[data-typepreset="hi-fi"]');
    const left = await p.evaluate(() => ['--leading-body', '--leading-display', '--tracking-small', '--tracking-display', '--tracking-caps', '--weight-body', '--weight-heading', '--line-length'].filter(k => document.documentElement.style.getPropertyValue(k)));
    expect(name, !left.length, `Hi-Fi after Editorial leaves no type dials behind (left: ${left.join(', ')})`);
    const h3 = () => p.$eval('.base-demo h3', el => { const cs = getComputedStyle(el); return parseFloat(cs.lineHeight) / parseFloat(cs.fontSize); });
    const before = await h3();
    await p.$eval('#k__leading_display', el => { el.value = '1.4'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    const after = await h3(), dial = await p.evaluate(() => document.documentElement.style.getPropertyValue('--leading-display'));
    expect(name, dial === '1.4' && Math.abs(before - 1.15) < 0.002 && after > 1.25, `the display leading slider sets the dial and moves the base demo's h3 (dial ${dial}, ${before.toFixed(3)} -> ${after.toFixed(3)})`);
    await p.click('[data-export="theme"]');
    const themeOut = await p.$eval('#css', el => el.textContent);
    await p.click('[data-export="full"]');
    const fullOut = await p.$eval('#css', el => el.textContent);
    await p.click('[data-export="theme"]');
    expect(name, /\n  --leading-display: 1\.4;/.test(themeOut) && !/--leading-body/.test(themeOut) && !/:\s*;/.test(themeOut), 'the theme export lists the set type dial, and no unset one');
    expect(name, /\n  --leading-display: 1\.4;/.test(fullOut) && /\/\* --leading-body: 1\.6;/.test(fullOut), 'the full export declares the set type dial and leaves unset ones as comments');
    await p.click('#k__leading_display ~ .unset-btn');
    expect(name, !(await p.evaluate(() => document.documentElement.style.getPropertyValue('--leading-display'))) && Math.abs(await h3() - 1.15) < 0.002, 'the unset button removes the dial, and the h3 is back to 1.15');
    await p.keyboard.press('Escape');
    // the mono picker lists monospace families only
    await p.click('[role=tab][aria-controls=tab-type]');
    await p.click('#k__font_mono');
    const monoCats = await p.$$eval('#fonts-m li small', els => [...new Set(els.map(e => e.textContent))]);
    expect(name, monoCats.length === 1 && monoCats[0] === 'mono', `mono picker categories: ${monoCats}`);
    await p.keyboard.press('Escape');
    for (const e of errors) failures.push(`[${name}] ${e}`);
    console.log(`${name} ${browser.version()}: done`);
    await browser.close();
  }
} finally { await server.close(); }
failures.forEach(f => console.log('  FAIL ' + f));
console.log(`${passes} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
