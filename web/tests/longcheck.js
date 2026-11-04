// Run from web/ with the repo root served on port 8766 (python3 -m http.server 8766 from the repo root) and index.html built.
// Long sheets: the picture goes out as full-size pages, the letter keeps its sharpness; a title redraws only its band.
const assert = require('node:assert');
const fs = require('fs');
const { chromium } = require('playwright');
require('fs').mkdirSync(__dirname + '/shots', { recursive: true });
const OUT = __dirname + '/shots/';
const pngSize = (f) => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
    const page = await ctx.newPage(); page.setDefaultTimeout(600000); const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto('http://127.0.0.1:8766/index.html');
    await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('tw.letterOpens', 'false'); } catch (e) {} }); await page.reload();
    await page.waitForFunction(() => window.__app && window.__app.state.ready);
    // A title, typed letter by letter: after the first letter sets the margin, only the title band is redrawn.
    const full = await page.evaluate(() => { const a = window.__app; let n = 0; const r = a.GL.redrawAll; a.GL.redrawAll = () => { n++; r(); };
      a.setTitle('L'); a.GL.render(); const first = n; for (const t of ['Lo', 'Lon', 'Long', 'Long l', 'Long letter']) { a.setTitle(t); a.GL.render(); }
      a.GL.redrawAll = r; return [first, n - first]; });
    console.log('title redraws: first letter', full[0], '| next five', full[1]);
    assert.strictEqual(full[1], 0, 'later title letters patch the band only');
    // 12,000 letters: more than one picture can hold at twice size.
    await page.evaluate(() => { const a = window.__app, words = 'the quick brown fox jumps over the lazy dog and types on '; let t = ''; while (t.length < 12000) t += words; a.typist.type(t); a.refresh(); });
    const h = await page.evaluate(() => window.__app.sheetLayout().h);
    const files = [];
    page.on('download', async (d) => { const f = OUT + 'long-' + d.suggestedFilename(); files.push(d.saveAs(f).then(() => f)); });
    await page.evaluate(() => window.__app.exportPng());
    await page.waitForFunction(() => { const t = window.__app.state.toast; return t && /Saved the picture/.test(t.text); }, null, { timeout: 600000 });
    const saved = await Promise.all(files), sizes = saved.map(pngSize);
    console.log('sheet', Math.round(h), 'pt ->', saved.length, 'pages', JSON.stringify(sizes));
    assert.ok(saved.length >= 2 && sizes.every(([w, hh]) => w >= 358 * 1.9 && hh <= 14000), 'pages at twice size or more, each a picture phones can draw');
    // The letter: each third is its own sharp picture.
    const dl = page.waitForEvent('download', { timeout: 600000 });
    await page.evaluate(() => window.__app.shareLetter());
    const f = OUT + 'long-letter.html'; await (await dl).saveAs(f);
    const html = fs.readFileSync(f, 'utf8'), w = +html.match(/IMG_W = (\d+)/)[1];
    console.log('letter', (html.length / 1048576).toFixed(1), 'MB, picture width', w, 'px');
    assert.ok(w >= 358 * 2.1 && !/%%[A-Z0-9]+%%/.test(html), 'letter at full sharpness, every token filled');
    const reader = await ctx.newPage(); await reader.goto('file://' + f); await reader.waitForTimeout(1500);
    await reader.screenshot({ path: OUT + 'long-letter.png' });
    console.log('reader opens read:', await reader.evaluate(() => document.querySelector('#letter').classList.contains('read')), '| errors', errs);
    assert.deepStrictEqual(errs, []);
  } finally { await browser.close(); }
})();
