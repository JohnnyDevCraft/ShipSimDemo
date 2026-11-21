// "Back to stations" on every demo inside the installed app, and nothing new on the public site (R4, R5).
//   DEMO_MOUNT=/ShipSimDemo VIEWPORTS=960x600,1280x800 node tests/pwa-back-control.cjs
// The service worker is blocked here (it would preload 200 MB per case); tests/pwa-offline.cjs covers it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run, expect, playwright, root } = require('./browser-harness.cjs');
const { openStation, linkAudit, tapBack } = require('./pwa-journeys-lib.cjs');
const inventory = require('../demo-app/pwa/inventory.json');

const ONLY = process.env.DEMOS ? process.env.DEMOS.split(',') : null;
const demos = inventory.demos.filter(demo => !ONLY || ONLY.includes(demo.folder));

const cases = {
  'in the app every demo shows Back to stations, it returns to the picker, and no link leaves the window or the app': async ({ open, context }) => {
    const page = await open('/app/');
    for (const demo of demos) {
      await openStation(page, demo);
      const back = page.getByRole('link', { name: 'Back to stations' });
      await expect(back, demo.folder).toBeVisible();
      const box = await back.boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44, `${demo.folder}: back control is ${box.width}x${box.height}`);
      const links = await linkAudit(page);
      assert.deepEqual(links.newWindow, [], `${demo.folder}: links that would open a new window`);
      assert.deepEqual(links.publicLanding, [], `${demo.folder}: links that would leave the app for the public landing page`);
      await tapBack(page);
      await expect(page, demo.folder).toHaveURL(/\/ShipSimDemo\/app\/$/);
      await expect(page.locator('a.station')).toHaveCount(23);
      assert.equal(context.pages().length, 1, 'still one window');
    }
  },
  'in the app the quick switch keeps Back to stations on the console it opens': async ({ open }) => {
    const page = await open('/app/');
    await openStation(page, inventory.demos.find(demo => demo.folder === 'Battery'));
    await page.locator('#menuBtn').click();
    await page.locator('#menuMain .qs-menu button[data-division="tactical"]').click();
    await page.locator('#quickSwitch a[data-console="Shields"]').click();
    await expect(page).toHaveTitle(/Shield System Control/);
    await expect(page.getByRole('link', { name: 'Back to stations' })).toBeVisible();
  },
  'on the public site no demo shows Back to stations and its links are unchanged': async ({ open }) => {
    for (const demo of demos) {
      const page = await open(`/${demo.folder}/index.html`);
      await expect(page.locator(demo.identify.selector).first(), demo.folder).toBeVisible();
      await page.waitForTimeout(300);
      await expect(page.getByRole('link', { name: 'Back to stations' }), demo.folder).toHaveCount(0);
      const html = fs.readFileSync(path.join(root, demo.folder, 'index.html'), 'utf8');
      const blankInFile = (html.match(/target="_blank"/g) || []).length;
      const landingInFile = (html.match(/href="\.\.\/index\.html"/g) || []).length;
      assert.equal(await page.locator('a[target="_blank"]').count(), blankInFile, `${demo.folder}: new-tab links unchanged`);
      assert.equal(await page.locator('a[href="../index.html"]').count(), landingInFile, `${demo.folder}: landing-page links unchanged`);
      await page.close();
    }
  },
};

// A real standalone window (Chromium --app) shows the control from display-mode alone, with no session flag
// (ANALYSIS-015). Runs once, in Chromium.
async function standaloneWindow(base) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mps-app-'));
  const url = `${base}/Reactor/index.html`;
  const context = await playwright.chromium.launchPersistentContext(profile, { headless: false, args: [`--app=${url}`], viewport: { width: 960, height: 600 }, serviceWorkers: 'block' });
  try {
    const page = context.pages()[0] ?? await context.waitForEvent('page');
    await page.waitForURL(url);
    assert.equal(await page.evaluate(() => matchMedia('(display-mode: standalone)').matches), true, 'the --app window is standalone');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('mps-app-mode')), '1', 'the shell marks the session from display-mode');
    await expect(page.getByRole('link', { name: 'Back to stations' })).toBeVisible();
  } finally {
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

if (process.env.STANDALONE !== '0') {
  cases['a standalone window (Chromium --app) shows Back to stations without the picker\'s flag'] = async ({ engine, base }) => {
    if (engine !== 'chromium') return;
    await standaloneWindow(base);
  };
}

run(cases, { contextOptions: { serviceWorkers: 'block' } });
