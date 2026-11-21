// The host's journeys through the installed app (R12, Story 2), in Chromium and WebKit at landscape tablet sizes:
//   DEMO_MOUNT=/ShipSimDemo VIEWPORTS=960x600,1280x800,1180x820,1024x768 node tests/pwa-journeys.cjs
// DEMO_ROOT=<ShipSimDemo working copy> runs them against the publish copy.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');
const { openStation, expectDemo, backToStations, screenshotPath } = require('./pwa-journeys-lib.cjs');
const inventory = require('../demo-app/pwa/inventory.json');

const byFolder = folder => inventory.demos.find(demo => demo.folder === folder);
const BLOCK_WORKER = { contextOptions: { serviceWorkers: 'block' } };

run({
  'from the picker the host reaches every demo and comes back to the picker': async ({ open, context, engine, viewport }) => {
    const page = await open('/app/');
    for (const demo of inventory.demos) {
      await openStation(page, demo);
      if (['Helm', 'Reactor', 'TacticalOfficer'].includes(demo.folder)) {
        await page.screenshot({ path: screenshotPath(`back-control-${demo.folder}-${engine}-${viewport.width}x${viewport.height}`) });
      }
      await backToStations(page);
    }
    assert.equal(context.pages().length, 1, 'one window throughout');
  },
  'a reload inside a demo stays on that demo, still inside the app': async ({ open }) => {
    const page = await open('/app/');
    for (const folder of ['Helm', 'Reactor', 'Science']) {
      await openStation(page, byFolder(folder));
      await page.reload();
      await expect(page).toHaveURL(new RegExp(`/${folder}/index\\.html$`));
      await expectDemo(page, byFolder(folder));
      await expect(page.getByRole('link', { name: 'Back to stations' })).toBeVisible();
      await backToStations(page);
    }
  },
  'an unknown address under /app/ opens the picker once the app has been opened': async ({ browser, base, viewport }) => {
    // Its own context with the worker allowed: the worker serves the picker for any navigation under /app/.
    const context = await browser.newContext({ viewport });
    try {
      const page = await context.newPage();
      await page.goto(`${base}/app/`);
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 60000 });
      await page.goto(`${base}/app/no/such/station`);
      await expect(page.locator('a.station')).toHaveCount(23);
      await expect(page).toHaveURL(/\/ShipSimDemo\/app\/$/);
    } finally {
      await context.close();
    }
  },
}, BLOCK_WORKER);
