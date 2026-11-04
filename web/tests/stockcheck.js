// Run from web/ with the repo root served on port 8766 (python3 -m http.server 8766 from the repo root) and index.html built.
// The envelope matches the sheet's stock: export a letter on onionskin and on canary second sheet, photograph each sealed.
const fs = require('fs');
const { chromium } = require('playwright');
require('fs').mkdirSync(__dirname + '/shots', { recursive: true });
const OUT = __dirname + '/shots/';
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
    const page = await ctx.newPage(); page.setDefaultTimeout(600000); const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto('http://127.0.0.1:8766/index.html');
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await page.reload();
    await page.waitForFunction(() => window.__app && window.__app.state.ready);
    await page.evaluate(() => { const a = window.__app; a.typist.type('Dear Boss,\n\nOn a thinner stock this time.'); a.refresh(); });
    for (const paper of ['onion', 'canary']) {
      await page.evaluate((p) => window.__app.choose('paper', p), paper);
      const dl = page.waitForEvent('download', { timeout: 600000 });
      await page.evaluate(() => window.__app.shareLetter());
      const f = OUT + 'stock-' + paper + '.html'; await (await dl).saveAs(f);
      const r = await ctx.newPage(); await r.goto('file://' + f); await r.waitForTimeout(2200);
      await r.screenshot({ path: OUT + 'stock-' + paper + '.png' }); await r.close();
    }
    console.log('errors', errs);
  } finally { await browser.close(); }
})();
