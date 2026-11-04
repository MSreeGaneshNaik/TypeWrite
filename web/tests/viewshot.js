// Run from web/ with the repo root served on port 8766 (python3 -m http.server 8766 from the repo root) and index.html built.
// The view by day and by night, after the clouds moved to their own drifting layer.
const { chromium } = require('playwright');
require('fs').mkdirSync(__dirname + '/shots', { recursive: true });
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); page.setDefaultTimeout(200000); const errs = [];
    page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error' || /shader|WebGL/i.test(m.text())) errs.push(m.text()); });
    await page.goto('http://127.0.0.1:8766/index.html');
    await page.waitForFunction(() => window.__app && window.__app.state.ready); await page.waitForTimeout(1500);
    await page.screenshot({ path: __dirname + '/shots/view-day.png' });
    await page.evaluate(() => window.__app.setLamp(true)); await page.waitForTimeout(4000);
    await page.screenshot({ path: __dirname + '/shots/view-night.png' });
    console.log('errors', errs);
  } finally { await b.close(); }
})();
