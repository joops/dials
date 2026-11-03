// Smoke test for the playground, served over HTTP in Chromium and Firefox: it loads with no console
// errors, and every colour, type and space preset, every theme, Randomise, the scheme switch, the
// tabs, the format switch and both export modes work, and the leading dial moves the page. Exits 1 on failure.
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
        // a theme applies its type preset in full, its optional type dials included, and puts the optional ones the preset leaves out back to their defaults
        const type = D.type[t.type].dials;
        const want = { ...D.colour[t.colour].dials, ...type, ...D.space[t.space].dials };
        return D.typeOptional.every(k => k in type || !s.getPropertyValue(k)) && Object.entries(want).every(([k, v]) => /^--(brand|secondary|success|warning|danger|info|grey)$/.test(k) ? !!s.getPropertyValue(k) : s.getPropertyValue(k).trim() === String(v))
          && document.querySelector(`[data-preset="${t.colour}"]`).getAttribute('aria-pressed') === 'true';
      }, { t, D });
      const fails = await p.$eval('#summary', el => el.textContent);
      expect(name, ok, `theme ${key} did not apply all its dials`);
      expect(name, /(^|\D)0 fail/.test(fails), `theme ${key}: the playground's contrast table shows failures (${fails})`);
    }
    // a theme whose type preset sets the leading applies it, and Default, which sets none, puts it back to its default
    await p.selectOption('#combo', 'editorial');
    const edLeading = await p.evaluate(() => document.documentElement.style.getPropertyValue('--leading-body'));
    await p.selectOption('#combo', 'default');
    const defLeft = await p.evaluate(() => document.documentElement.style.getPropertyValue('--leading-body'));
    expect(name, edLeading === String(D.type.editorial.dials['--leading-body']) && !defLeft, `the Editorial theme sets its leading (${edLeading}) and Default after it puts it back to its default (left: ${defLeft || 'none'})`);
    await p.selectOption('#combo', 'dials');
    expect(name, await p.evaluate(() => document.documentElement.style.getPropertyValue('--leading-body')) === '1.6', 'the Dials theme sets leading 1.6');
    // randomise, schemes, format, export, tables
    await p.click('#shuffle');
    expect(name, await p.$eval('#combo', el => el.value) === '_shuffle', 'Randomise did not set a random combination');
    // Randomise sets the leading too, within a range that reads well
    const outOfRange = [];
    for (let i = 0; i < 12; i++) {
      if (i) await p.click('#shuffle');
      const v = await p.evaluate(() => document.documentElement.style.getPropertyValue('--leading-body').trim());
      if (!v || !(parseFloat(v) >= 1.35 - 1e-9 && parseFloat(v) <= 1.8 + 1e-9)) outOfRange.push(v || 'default');
    }
    expect(name, !outOfRange.length, `Randomise sets the leading between 1.35 and 1.8 (outside: ${[...new Set(outOfRange)].join(', ')})`);
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
    // the leading slider: it shows the value in use, its default until moved; it moves the preview panes, the article, the base demo
    // and the page's own text; a preset sets it again; the exports carry it only once set
    await p.click('[role=tab][aria-controls=tab-type]');
    await p.click('[data-typepreset="default"]');
    const shown = () => p.$eval('#k__leading_body ~ output', el => el.textContent);
    expect(name, await shown() === '1.5' && !(await p.evaluate(() => document.documentElement.style.getPropertyValue('--leading-body'))), `the Default type preset leaves the leading at its default, shown as ${await shown()}`);
    const ratio = (sel) => p.$eval(sel, el => { const cs = getComputedStyle(el); return parseFloat(cs.lineHeight) / parseFloat(cs.fontSize); });
    const SPOTS = ['#pair .pane .card p', '#pair .pane .card h4', '.article p:not(.lead)', '.base-demo p', '.base-demo h3', '.wrap > header h1'];
    const before = await Promise.all(SPOTS.map(ratio));
    await p.fill('#k__leading_body', '2');
    const after = await Promise.all(SPOTS.map(ratio));
    SPOTS.forEach((sel, i) => expect(name, after[i] > before[i] + 0.05, `leading 2 opens up ${sel} (${before[i].toFixed(3)} -> ${after[i].toFixed(3)})`));
    expect(name, Math.abs(after[0] - 2) < 0.01 && Math.abs(before[0] - 1.5) < 0.01 && after[1] < after[0], `body text takes the leading exactly and a larger heading less (${before[0].toFixed(3)} -> ${after[0].toFixed(3)}, h4 ${after[1].toFixed(3)})`);
    const gap = await p.$eval('.base-demo p', el => { const cs = getComputedStyle(el); return [parseFloat(cs.marginBlockEnd), parseFloat(cs.lineHeight)]; });
    expect(name, Math.abs(gap[0] - gap[1]) < 0.1, `the base demo's paragraphs are one body line apart (${gap[0]}px after a ${gap[1]}px line)`);
    await p.click('[data-export="theme"]');
    const themeOut = await p.$eval('#css', el => el.textContent);
    expect(name, /\n  --leading-body: 2;/.test(themeOut), 'the theme export lists the leading once set');
    await p.click('[data-typepreset="default"]');
    expect(name, Math.abs((await ratio(SPOTS[0])) - before[0]) < 0.002 && !/--leading-body/.test(await p.$eval('#css', el => el.textContent)), 'the Default preset puts the leading back, and the export drops it');
    // the page's own text follows the type scale: a bigger body size grows the notes and headings
    const sizes = () => p.evaluate(() => ['.ctl-note', 'section > h2', '.tabs [role=tab]'].map(s => parseFloat(getComputedStyle(document.querySelector(s)).fontSize)));
    const s0 = await sizes();
    await p.fill('#k__size_max', '24');
    const s1 = await sizes();
    expect(name, s1.every((v, i) => v > s0[i] + 1), `the page's own notes, headings and tabs follow the type scale (${s0.join(', ')} -> ${s1.join(', ')})`);
    await p.click('[data-typepreset="default"]');
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
