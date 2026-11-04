// Run from web/ with the repo root served on port 8766 (python3 -m http.server 8766 from the repo root) and index.html built.
// The engine's risky rules: per-paragraph alignment, the paste limit, letter escaping, deletes across tabs, a full storage.
const assert = require('node:assert');
const { chromium } = require('playwright');
require('fs').mkdirSync(__dirname + '/shots', { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.setDefaultTimeout(120000); const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto('http://127.0.0.1:8766/index.html');
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await page.reload();
    await page.waitForFunction(() => window.__app && window.__app.state.ready);
    const paras = () => page.evaluate(() => { const L = window.__app.typist.layout.lines, out = [L[0].align]; L.forEach((l, i) => { if (l.ret && L[i + 1]) out.push(L[i + 1].align); }); return out.join(' '); });
    await page.evaluate(() => { const a = window.__app; a.typist.type('Title\nBody one\nBody two'); a.afterEdit ? a.afterEdit() : null; a.sheet.text = a.typist.text; });
    // 1. Caret in the title, centre it: only the title moves.
    await page.evaluate(() => { const a = window.__app; a.typist.setCaret(2); a.choose('align', 'center'); });
    assert.strictEqual(await paras(), 'center left left');
    // 2. Caret at the end, right-align, keep typing: the last paragraph and the new one are right, the rest stay.
    await page.evaluate(() => { const a = window.__app; a.typist.setCaret(a.typist.chars.length); a.choose('align', 'right'); a.typist.type('\nNext'); });
    assert.strictEqual(await paras(), 'center left right right');
    const radio = await page.evaluate(() => window.__app.renderVals().aligns.map((x) => x.on).join(' '));
    assert.strictEqual(radio, 'false false true', 'the panel shows the alignment at the caret');
    // 3. Select from inside the title to inside "Body one": both centre... then left; "Body two" keeps right.
    await page.evaluate(() => { const a = window.__app; a.typist.relayout(); a.setSel(1, 9); a.choose('align', 'left'); });
    assert.strictEqual(await paras(), 'left left right right');
    // 4. It survives a reload.
    await page.evaluate(() => { const a = window.__app; a.refresh(); a.persist(true); });
    await page.reload(); await page.waitForFunction(() => window.__app && window.__app.state.ready);
    assert.strictEqual(await paras(), 'left left right right');
    // 5. Deleting a line break merges two paragraphs but leaves the ones after it alone.
    await page.evaluate(() => { const a = window.__app, t = a.typist; t.setCaret(t.chars.indexOf('\n') + 1); t.backspace(); a.refresh(); });
    assert.strictEqual(await paras(), 'left right right');
    // 6. A paste past the 40,000-letter limit jams instead of quietly dropping the rest.
    const jam = await page.evaluate(() => { const t = new window.__app.typist.constructor('', null); return t.type('x'.repeat(40010)).join(' ') + ' ' + t.chars.length; });
    assert.strictEqual(jam, 'key jammed 40000');
    // 7. The letter: a hostile title and text stay text, and the opening switch is only ever true or false.
    const html = await page.evaluate(() => { const a = window.__app, c = document.createElement('canvas'); c.width = 8; c.height = 8;
      a.sheet.title = '</title><script>alert(1)</script>'; a.typist.type('\n<img src=x onerror=alert(2)> & </article>'); a.refresh();
      try { localStorage.setItem('tw.letterOpens', '"0;alert(3)"'); } catch (e) {}
      return a.letterHtml([c, c, c], c, c); });
    assert.ok(!/<script>alert|<img src=x|alert\(3\)/.test(html), 'nothing the writer typed becomes markup or script');
    assert.ok(/var ANIMATE = (true|false),/.test(html));
    // 8. Another tab throws a sheet away: it stays gone here, even after this tab saves.
    const back = await page.evaluate(() => { const a = window.__app, other = { id: 'sOther', text: 'old', title: '', updated: 1 };
      a.sheets = [other]; localStorage.setItem('tw.sheets', JSON.stringify([]));
      window.dispatchEvent(new StorageEvent('storage', { key: 'tw.sheets' })); a.persist(true);
      return JSON.parse(localStorage.getItem('tw.sheets')).some((s) => s.id === 'sOther') || a.sheets.some((s) => s.id === 'sOther'); });
    assert.strictEqual(back, false);
    // 9. A full storage is said out loud, not swallowed.
    await page.evaluate(() => { const a = window.__app, set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k) { if (k === 'tw.sheets') throw new DOMException('full', 'QuotaExceededError'); return set.apply(this, arguments); };
      a.full = false; a.persist(true); Storage.prototype.setItem = set; });
    await page.waitForFunction(() => { const t = window.__app.state.toast; return t && /storage is full/i.test(t.text); }, null, { timeout: 5000 });
    console.log('engine ok | errors', errs);
    assert.deepStrictEqual(errs, []);
  } finally { await browser.close(); }
})();
