// The app's page (TypeWrite/Resources/TypeWrite.html) runs on its own from a file, with every asset inside it,
// the way the Mac and iPhone app loads it; the shell's calls (buzz, save) reach window.webkit when it is there.
const assert = require('node:assert');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await b.newPage({ viewport: { width: 390, height: 844 } }); page.setDefaultTimeout(300000); const errs = [], asked = [];
    page.on('pageerror', (e) => errs.push(String(e))); page.on('requestfailed', (r) => errs.push('failed ' + r.url().slice(0, 80)));
    await page.exposeFunction('__shell', (name, body) => asked.push([name, typeof body === 'object' && body && body.name ? body.name : body]));
    await page.addInitScript(() => { window.webkit = { messageHandlers: Object.fromEntries(['buzz', 'save', 'moved'].map((n) => [n, { postMessage: (m) => window.__shell(n, m) }])) }; });
    await page.goto('file://' + __dirname + '/../../TypeWrite/Resources/TypeWrite.html');
    await page.waitForFunction(() => window.__app && window.__app.state.ready);
    const fonts = await page.evaluate(() => Promise.all(['Courier Prime', 'Special Elite', 'Cutive Mono', 'Lekton'].map((f) => document.fonts.load('16px "' + f + '"').then((l) => l.length))));
    await page.evaluate(() => { const a = window.__app; a.typist.type('From the app.'); a.refresh(); a.feedback(['key']); a.choose('ink', 'black'); a.saveBlob(new Blob(['hi'], { type: 'text/plain' }), 'note.txt'); });
    const sounds = await page.evaluate(async () => { for (let i = 0; i < 60 && !(window.__audio && window.__audio.buffers.key1 && window.__audio.buffers['letter-tear']); i++) await new Promise((r) => setTimeout(r, 100)); return window.__audio ? Object.keys(window.__audio.buffers).length : 0; });
    await page.waitForTimeout(500);
    await page.screenshot({ path: __dirname + '/shots/app-phone.png' });
    console.log('fonts', fonts.join(','), '| sounds decoded', sounds, '| shell calls', JSON.stringify(asked), '| errors', errs);
    assert.ok(fonts.every((n) => n > 0), 'all four typefaces load from inside the page');
    assert.ok(sounds >= 10, 'the key sounds decode from inside the page');
    assert.ok(asked.some(([n]) => n === 'buzz') && asked.some(([n, v]) => n === 'save' && v === 'note.txt'), 'haptics and saving go to the app');
    assert.deepStrictEqual(errs, []);
  } finally { await b.close(); }
})();
