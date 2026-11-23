// Installability (R6, Story 1), in Chromium, against the tree served under /ShipSimDemo/ (DEMO_ROOT to test the
// ShipSimDemo copy):
// - the /app/ preview is installable: Chrome reports no installability errors and the worker controls the demos;
// - no demo page offers an install of its own (none links a manifest);
// - the public root is not installable and registers no worker.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { playwright, root } = require('./browser-harness.cjs');
const { siteServer } = require('./pwa-journeys-lib.cjs');
const inventory = require('../demo-app/pwa/inventory.json');

// Chrome's own view: installability errors, and the web app manifest it found. Recent Chrome reports no
// installability errors even for a page without a manifest (any page can be added as a browser shortcut), so the
// manifest Chrome parsed is what tells the installable app apart.
async function chromeView(page) {
  const session = await page.context().newCDPSession(page);
  const { installabilityErrors } = await session.send('Page.getInstallabilityErrors');
  const manifest = await session.send('Page.getAppManifest');
  return { errors: installabilityErrors.map(error => error.errorId), manifestUrl: manifest.url, manifestErrors: manifest.errors, display: manifest.manifest?.display };
}

// A page that is not the app: Chrome found no web app manifest, so it would open in neither app display mode.
function assertNotAnApp(view, label) {
  assert.equal(view.manifestUrl, '', `${label}: Chrome finds no web app manifest`);
  assert.ok(!['kStandalone', 'kFullscreen'].includes(view.display), `${label}: would not open as an app (display ${view.display})`);
}

const cases = {
  'the /app/ preview is installable and its worker controls the demo pages': async ({ browser, site }) => {
    const context = await browser.newContext({ viewport: { width: 960, height: 600 } });
    try {
      const page = await context.newPage();
      await page.goto(`${site.base}/app/`);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 60000 });
      const view = await chromeView(page);
      assert.deepEqual(view.errors, [], 'Chrome installability errors');
      assert.match(view.manifestUrl, /\/ShipSimDemo\/app\/manifest\.webmanifest$/, 'Chrome found the app manifest');
      assert.deepEqual(view.manifestErrors, [], 'manifest parse errors');
      assert.equal(view.display, 'kFullscreen', 'Chrome will open it fullscreen (card #25)');
      const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).scope);
      assert.equal(new URL(scope).pathname, '/ShipSimDemo/');
      await page.goto(`${site.base}/Helm/index.html`);
      assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true, 'the worker controls /ShipSimDemo/Helm/');
    } finally {
      await context.close();
    }
  },
  'no demo page offers its own install': async ({ browser, site }) => {
    for (const demo of inventory.demos) {
      const html = fs.readFileSync(path.join(root, demo.folder, 'index.html'), 'utf8');
      assert.doesNotMatch(html, /rel="manifest"/, `${demo.folder} links no manifest`);
    }
    const context = await browser.newContext({ serviceWorkers: 'block' });
    try {
      const page = await context.newPage();
      await page.goto(`${site.base}/Reactor/index.html`);
      assert.equal(await page.locator('link[rel="manifest"]').count(), 0);
      for (const folder of ['Helm', 'Command', 'TorpedoAssembly']) {
        await page.goto(`${site.base}/${folder}/index.html`);
        assertNotAnApp(await chromeView(page), folder);
      }
    } finally {
      await context.close();
    }
  },
  'the public root is not installable and registers no worker': async ({ browser, site }) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(`${site.base}/`);
      await page.waitForTimeout(1500);
      assert.equal(await page.locator('link[rel="manifest"]').count(), 0, 'no manifest link');
      assertNotAnApp(await chromeView(page), 'the root');
      assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0, 'no worker registered');
    } finally {
      await context.close();
    }
  },
};

(async () => {
  const site = await siteServer({ dir: process.env.DEMO_ROOT ? path.resolve(process.env.DEMO_ROOT) : undefined });
  const browser = await playwright.chromium.launch();
  let failed = 0;
  try {
    for (const [name, body] of Object.entries(cases)) {
      try {
        await body({ browser, site });
        console.log(`PASS [chromium] ${name}`);
      } catch (error) {
        failed++;
        console.log(`FAIL [chromium] ${name}\n     ${String(error.message).split('\n').slice(0, 6).join('\n     ')}`);
      }
    }
  } finally {
    await browser.close();
    await site.close();
  }
  console.log(failed ? `${failed} failed` : 'all passed');
  process.exit(failed ? 1 : 0);
})();
