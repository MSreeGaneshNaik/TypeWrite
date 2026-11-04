// Run from web/ with the repo root served on port 8766 (python3 -m http.server 8766 from the repo root) and index.html built.
// Send a sheet as a letter, then open the downloaded file and tear it open: screenshots at each beat, and asserts.
const assert = require('node:assert');
const { chromium } = require('playwright');
require('fs').mkdirSync(__dirname + '/shots', { recursive: true });
const OUT = __dirname + '/shots/';
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
    const page = await ctx.newPage(); page.setDefaultTimeout(120000); const errs = [];
    page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto('http://127.0.0.1:8766/index.html');
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForFunction(() => window.__app && window.__app.state.ready);
    await page.mouse.click(640, 400);
    await page.keyboard.type('Dear Boss,\n\nThis sheet tore out of the machine, folded in three and went into an envelope. Slide the flap to open it.', { delay: 5 });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Share this sheet' }).click();
    const dl = page.waitForEvent('download', { timeout: 600000 });
    await page.getByRole('button', { name: /Send as a letter/ }).click();
    const beats = [];
    for (const [i, ms] of [[0, 250], [1, 700], [2, 1200], [3, 1650], [4, 2150], [5, 2650], [6, 3150]]) {
      await page.waitForTimeout(i ? ms - [0, 250, 700, 1200, 1650, 2150, 2650][i] : ms);
      beats.push(await page.evaluate(() => (document.querySelector('.tw-send') || {}).dataset ? document.querySelector('.tw-send').dataset.phase : 'none'));
      await page.screenshot({ path: OUT + `send-${i}.png` });
    }
    const file = await dl; const path = OUT + 'letter.html'; await file.saveAs(path);
    console.log('phases seen', beats.join(' '), '| file', file.suggestedFilename());
    assert.ok(file.suggestedFilename().endsWith('-letter.html'));

    // The reader opens the file.
    const reader = await ctx.newPage(); const rerrs = [];
    reader.on('pageerror', (e) => rerrs.push(String(e)));
    await reader.goto('file://' + path);
    await reader.waitForTimeout(2200);
    await reader.screenshot({ path: OUT + 'open-0.png' });
    const flap = await reader.locator('#flap').boundingBox();
    const y = flap.y + flap.height * 165 / 434, x0 = flap.x + flap.width * 0.28, x1 = flap.x + flap.width * 0.74;
    await reader.mouse.move(x0, y); await reader.mouse.down();
    for (let k = 1; k <= 12; k++) { await reader.mouse.move(x0 + (x1 - x0) * k / 24, y, { steps: 2 }); }
    await reader.screenshot({ path: OUT + 'open-1-half.png' });
    for (let k = 13; k <= 24; k++) { await reader.mouse.move(x0 + (x1 - x0) * k / 24, y, { steps: 2 }); }
    await reader.mouse.up();
    await reader.waitForTimeout(700); await reader.screenshot({ path: OUT + 'open-2.png' });
    await reader.waitForTimeout(900); await reader.screenshot({ path: OUT + 'open-3.png' });
    await reader.waitForTimeout(1800); await reader.screenshot({ path: OUT + 'open-4.png' });
    const done = await reader.evaluate(() => ({ read: document.querySelector('#letter').classList.contains('read'), folded: document.querySelector('#letter').classList.contains('folded'), words: document.querySelector('#words').textContent.slice(0, 40) }));
    console.log('reader', JSON.stringify(done), rerrs);
    assert.ok(done.read && !done.folded, 'the letter opened and unfolded');

    // The sender turns the envelope off: the file opens straight to the letter.
    await page.getByRole('button', { name: 'Share this sheet' }).click();
    await page.getByRole('switch', { name: 'Envelope opening' }).click();
    const dl2 = page.waitForEvent('download', { timeout: 600000 });
    await page.getByRole('button', { name: /Send as a letter/ }).click();
    const f2 = await dl2; await f2.saveAs(OUT + 'letter-flat.html');
    const flat = await ctx.newPage(); await flat.goto('file://' + OUT + 'letter-flat.html'); await flat.waitForTimeout(800);
    await flat.screenshot({ path: OUT + 'open-flat.png' });
    const f = await flat.evaluate(() => document.querySelector('#letter').classList.contains('read') && document.body.classList.contains('gone'));
    console.log('flat opens read:', f, '| app errors', errs);
    assert.ok(f);
  } finally { await browser.close(); }
})();
