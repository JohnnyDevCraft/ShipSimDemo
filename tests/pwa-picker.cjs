// The station picker on an 8-inch landscape tablet: every station is a touch target of at least 48 px, all of
// them are on screen at once, and nothing scrolls sideways. Run under the GitHub Pages path:
//   DEMO_MOUNT=/ShipSimDemo VIEWPORTS=960x600,1024x768 node tests/pwa-picker.cjs
// The service worker is blocked here (it would preload 200 MB per case); tests/pwa-offline.cjs covers it.
const assert = require('node:assert/strict');
const path = require('node:path');
const { run, expect } = require('./browser-harness.cjs');
const inventory = require('../demo-app/pwa/inventory.json');

run({
  'the picker shows every station as a touch target of at least 48 px and fits an 8-inch landscape screen': async ({ open, engine, viewport }) => {
    const page = await open('/app/');
    await expect(page.locator('a.station')).toHaveCount(23);
    await expect(page.locator('.division h2')).toHaveText(['Command', 'Engineering', 'Science', 'Tactical', 'Piloting']);
    for (const demo of inventory.demos) {
      const station = page.locator(`a.station[data-station="${demo.folder}"]`);
      await expect(station).toContainText(demo.name);
      const box = await station.boundingBox();
      assert.ok(box.width >= 48 && box.height >= 48, `${demo.folder} is ${box.width}x${box.height}`);
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, `${demo.folder} is on screen (${JSON.stringify(box)})`);
    }
    const sideways = await page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
    assert.ok(sideways <= 0, `page scrolls sideways by ${sideways}px`);
    await expect(page.getByTestId('offline-status')).toBeVisible();
    await page.screenshot({ path: path.join(__dirname, `artifacts/pwa/picker-${engine}-${viewport.width}x${viewport.height}.png`) });
  },
}, { contextOptions: { serviceWorkers: 'block' } });
