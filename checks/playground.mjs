// Smoke test for the playground, served over HTTP in Chromium and Firefox: it loads with no console
// errors, and every colour, type and space preset, every theme, Randomise, the scheme switch, the
// tabs, the format switch and both export modes work, and every optional type dial moves the preview panes. Exits 1 on failure.
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
    // a theme with optional type dials sets them, and one without them (Hi-Fi) clears them again
    await p.selectOption('#combo', 'editorial');
    const edLeading = await p.evaluate(() => document.documentElement.style.getPropertyValue('--leading-body'));
    await p.selectOption('#combo', 'hi-fi');
    const hfLeft = await p.evaluate(T => T.filter(k => document.documentElement.style.getPropertyValue(k)), D.typeOptional);
    expect(name, edLeading === String(D.type.editorial.dials['--leading-body']) && !hfLeft.length, `the Editorial theme sets its body leading (${edLeading}) and Hi-Fi after it puts every optional type dial back to its default (left: ${hfLeft.join(', ')})`);
    // randomise, schemes, format, export, tables
    await p.click('#shuffle');
    expect(name, await p.$eval('#combo', el => el.value) === '_shuffle', 'Randomise did not set a random combination');
    // Randomise sets the type dials too, within ranges that read well (line length may stay at its default)
    const RANGES = { '--leading-body': [1.35, 1.8], '--leading-display': [1, 1.3], '--tracking-small': [0, 0.04], '--tracking-display': [-0.04, 0.01],
      '--tracking-caps': [0, 0.12], '--weight-body': [300, 500], '--weight-heading': [500, 800], '--line-length': [55, 80] };
    const outOfRange = [], lineLengths = new Set();
    for (let i = 0; i < 12; i++) {
      if (i) await p.click('#shuffle');
      const got = await p.evaluate(K => Object.fromEntries(K.map(k => [k, document.documentElement.style.getPropertyValue(k).trim()])), Object.keys(RANGES));
      for (const [k, [lo, hi]] of Object.entries(RANGES)) {
        const v = got[k];
        if (k === '--line-length') { lineLengths.add(v ? 'set' : 'default'); if (!v) continue; if (!/^\d+ch$/.test(v)) { outOfRange.push(`${k}: ${v}`); continue; } }
        if (!v || !(parseFloat(v) >= lo - 1e-9 && parseFloat(v) <= hi + 1e-9)) outOfRange.push(`${k}: ${v || 'default'}`);
      }
    }
    expect(name, !outOfRange.length, `Randomise sets every type dial within its range (outside: ${[...new Set(outOfRange)].join(', ')})`);
    expect(name, lineLengths.has('set'), 'Randomise sets a line length some of the time');
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
    // the optional type dials sit behind a disclosure, closed by default and opened from the keyboard
    await p.click('[role=tab][aria-controls=tab-type]');
    await p.click('[data-typepreset="editorial"]');
    await p.click('[data-typepreset="hi-fi"]');
    const left = await p.evaluate(() => ['--leading-body', '--leading-display', '--tracking-small', '--tracking-display', '--tracking-caps', '--weight-body', '--weight-heading', '--line-length'].filter(k => document.documentElement.style.getPropertyValue(k)));
    expect(name, !left.length, `Hi-Fi after Editorial leaves no type dials behind (left: ${left.join(', ')})`);
    const disc = await p.$eval('#type-optional', el => ({ tag: el.tagName, open: el.open, summary: el.querySelector('summary').textContent, holds: !!el.querySelector('#k__leading_body') }));
    expect(name, disc.tag === 'DETAILS' && !disc.open && /\(optional\)/.test(disc.summary) && disc.holds, `the type dials are in a closed <details> titled "(optional)" (${JSON.stringify(disc)})`);
    await p.focus('#type-optional > summary');
    await p.keyboard.press('Enter');
    expect(name, await p.$eval('#type-optional', el => el.open), 'Enter on the summary opens the type dials');
    // each slider shows its default, never "unset"
    const outs = await p.$$eval('#type-ctl2 output', els => els.map(e => e.textContent));
    expect(name, outs.length === 8 && outs.every(t => / \(default\)$/.test(t)) && outs[0] === '1.6 (default)' && outs[7] === 'none (default)', `the sliders show their defaults (${outs.join(', ')})`);
    // a dial set to its default changes nothing anywhere on the page: the preview panes, the article and the base demo
    const typeSnap = () => p.evaluate(() => [...document.querySelectorAll('#pair *, .article, .article *, .base-demo, .base-demo *')].map(el => { const cs = getComputedStyle(el); return [cs.lineHeight, cs.letterSpacing, cs.fontWeight, cs.maxInlineSize].join('|'); }).join('\n'));
    const plain = await typeSnap();
    const DEFAULTS = { '--leading-body': '1.6', '--leading-display': '1.15', '--tracking-small': '0', '--tracking-display': '0', '--tracking-caps': '0', '--weight-body': '400', '--weight-heading': '600' };
    for (const [k, v] of Object.entries(DEFAULTS)) await p.fill('#k' + k.replace(/-/g, '_'), v);
    const atDefaults = await typeSnap(), setCount = await p.evaluate(K => K.filter(k => document.documentElement.style.getPropertyValue(k)).length, Object.keys(DEFAULTS));
    expect(name, setCount === 7 && atDefaults === plain, `every type dial set to its default leaves the page's type as it was (${setCount} set; ${atDefaults.split('\n').filter((l, i) => l !== plain.split('\n')[i]).length} elements differ)`);
    for (const k of Object.keys(DEFAULTS)) await p.click(`#k${k.replace(/-/g, '_')} ~ .unset-btn`);
    // a slider sets its dial, × puts it back, and the exports carry set dials only
    const h3 = () => p.$eval('.base-demo h3', el => { const cs = getComputedStyle(el); return parseFloat(cs.lineHeight) / parseFloat(cs.fontSize); });
    const before = await h3();
    await p.fill('#k__leading_display', '1.4');
    const after = await h3(), dial = await p.evaluate(() => document.documentElement.style.getPropertyValue('--leading-display'));
    expect(name, before > 1.16 && before < 1.59, `with the defaults the base demo's h3 sits on the leading curve, between 1.15 and 1.6 (${before.toFixed(3)})`);
    expect(name, dial === '1.4' && after > before + 0.02, `the display leading slider sets the dial and moves the base demo's h3 (dial ${dial}, ${before.toFixed(3)} -> ${after.toFixed(3)})`);
    await p.click('[data-export="theme"]');
    const themeOut = await p.$eval('#css', el => el.textContent);
    await p.click('[data-export="full"]');
    const fullOut = await p.$eval('#css', el => el.textContent);
    await p.click('[data-export="theme"]');
    expect(name, /\n  --leading-display: 1\.4;/.test(themeOut) && !/--leading-body/.test(themeOut) && !/:\s*;/.test(themeOut), 'the theme export lists the set type dial, and no dial left at its default');
    expect(name, /\n  --leading-display: 1\.4;/.test(fullOut) && /\/\* --leading-body: 1\.6;/.test(fullOut), 'the full export declares the set type dial and leaves the others as comments with their defaults');
    await p.click('#k__leading_display ~ .unset-btn');
    expect(name, !(await p.evaluate(() => document.documentElement.style.getPropertyValue('--leading-display'))) && Math.abs(await h3() - before) < 0.002, `× puts the dial back to its default, and the h3 back to ${before.toFixed(3)}`);
    // every type dial changes the live preview under the controls: the light and dark panes
    const PROBES = [['--leading-body', '2', '.card p', 'lineHeight'], ['--leading-display', '1.5', '.card h4', 'lineHeight'],
      ['--tracking-small', '0.1', '.badge', 'letterSpacing'], ['--tracking-display', '-0.08', '.card h4', 'letterSpacing'],
      ['--tracking-caps', '0.2', '.cap', 'letterSpacing'], ['--weight-body', '300', '.card p', 'fontWeight'],
      ['--weight-heading', '800', '.card h4', 'fontWeight'], ['--line-length', '30', '.card p', 'maxInlineSize']];
    for (const [dial, value, sel, prop] of PROBES) {
      const read = () => p.$$eval('#pair .pane ' + sel, (els, prop) => els.map(el => getComputedStyle(el)[prop]).join(' / '), prop);
      const before = await read();
      await p.fill('#k' + dial.replace(/-/g, '_'), value);
      const after = await read();
      expect(name, after !== before, `${dial} = ${value} changes ${sel}'s ${prop} in the preview panes (${before} -> ${after})`);
      await p.click(`#k${dial.replace(/-/g, '_')} ~ .unset-btn`);
      expect(name, await read() === before, `× on ${dial} puts ${sel}'s ${prop} back (${before})`);
    }
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
