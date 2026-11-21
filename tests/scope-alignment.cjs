// Regression: the 3D layer (planets/ships, a WebGL canvas) must stay aligned with the SVG horizon and scale with the scope
// at any window width. It used to be painted at native 600x300 in WebKit/Safari when it sat inside an SVG foreignObject.
// Run against a local preview: node tests/scope-alignment.cjs   (ENGINE=chromium|webkit limits it; CHROMIUM_PATH overrides the browser binary)
const assert = require('node:assert/strict');
const pw = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const url = process.env.DEMO_URL || 'http://localhost:18087/PhaserArray/index.html';
const engines = process.env.ENGINE ? [process.env.ENGINE] : ['chromium', 'webkit'];
const hideSvgKeepCanvas = '.forward-scope svg{visibility:hidden}.scope-zoom{visibility:hidden}.forward-scope svg foreignObject,.forward-scope svg foreignObject *{visibility:visible}';

async function earthDisc(context, png) {
  const page = await context.newPage();
  const disc = await page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
    const g = canvas.getContext('2d'); g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, canvas.width, canvas.height).data, margin = 5;
    let top = 1e9, bottom = -1;
    for (let y = margin; y < canvas.height - margin; y++) for (let x = margin; x < canvas.width - margin; x++) {
      const i = (y * canvas.width + x) * 4;
      if (data[i] + data[i + 1] + data[i + 2] > 60) { if (y < top) top = y; if (y > bottom) bottom = y; }
    }
    return { top, bottom, height: canvas.height };
  }, png.toString('base64'));
  await page.close();
  return { middle: (disc.top + disc.bottom) / 2 - disc.height / 2, height: disc.bottom - disc.top };
}

(async () => {
  for (const name of engines) {
    const browser = await pw[name].launch(name === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    try {
      const ratios = [];
      for (const width of [1300, 1900]) {
        const context = await browser.newContext({ viewport: { width, height: 1000 } }), page = await context.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(url, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
        const scope = page.locator('.forward-scope'); let box = await scope.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, -350); await page.waitForTimeout(500); }
        await page.addStyleTag({ content: hideSvgKeepCanvas }); await page.waitForTimeout(900);
        box = await scope.boundingBox();
        const disc = await earthDisc(context, await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: box.height } }));
        assert.ok(Math.abs(disc.middle) <= 3, `${name} @${width}px: Earth is ${disc.middle}px off the horizon`);
        assert.deepEqual(errors, [], `${name} page errors`);
        ratios.push(disc.height / box.width);
        console.log(`PASS ${name} @${width}px: Earth on the horizon (${disc.middle}px), disc ${disc.height}px in a ${Math.round(box.width)}px scope`);
        await context.close();
      }
      assert.ok(Math.abs(ratios[0] - ratios[1]) / ratios[0] < 0.05, `${name}: 3D layer does not scale with the scope (${ratios.map(r => r.toFixed(3))})`);
      console.log(`PASS ${name}: 3D layer scales with the scope`);
    } finally { await browser.close(); }
  }
})().catch(e => { console.error(e.message); process.exit(1); });
