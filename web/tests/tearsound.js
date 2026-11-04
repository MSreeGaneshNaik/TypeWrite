// Run after letter-check.js, which leaves shots/letter.html: the tear's sound follows the drag.
// The tear's sound follows the drag: grains while the tear moves forward, none while the finger rests.
const assert = require('node:assert');
const { chromium } = require('playwright');
require('fs').mkdirSync(__dirname + '/shots', { recursive: true });
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 960, height: 640 } }); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { window.__grains = []; const st = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (w, at, len) { window.__grains.push([performance.now() | 0, +(at || 0).toFixed(3)]); return st.apply(this, arguments); }; });
  await page.goto('file://' + __dirname + '/shots/letter.html'); await page.waitForTimeout(600);
  const f = await page.locator('#flap').boundingBox(), y = f.y + f.height * 165 / 434, x0 = f.x + f.width * 0.29;
  await page.mouse.move(x0, y); await page.mouse.down(); await page.waitForTimeout(400);   // let the rip decode
  for (let k = 1; k <= 20; k++) { await page.mouse.move(x0 + f.width * 0.2 * k / 20, y); await page.waitForTimeout(25); }
  const moving = await page.evaluate(() => window.__grains.length);
  await page.waitForTimeout(500);
  const resting = await page.evaluate(() => window.__grains.length) - moving;
  for (let k = 1; k <= 12; k++) { await page.mouse.move(x0 + f.width * (0.2 + 0.3 * k / 12), y); await page.waitForTimeout(20); }
  await page.mouse.up(); await page.waitForTimeout(800);
  const g = await page.evaluate(() => window.__grains);
  const offs = g.map((x) => x[1]);
  console.log('grains while tearing', moving, '| while resting', resting, '| total', g.length, '| offsets rise', offs.slice(0, 6).join(','), '...', offs.slice(-3).join(','), '| errors', errs);
  assert.ok(moving >= 5, 'the tear is heard while it moves');
  assert.strictEqual(resting, 0, 'silent while the finger rests');
  assert.ok(offs.every((o, i) => !i || o >= offs[i - 1] - 1e-6), 'the recording is played forward with the tear');
  await b.close();
})();
