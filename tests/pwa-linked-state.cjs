// Linked state in one window (R11, Story 4), in Chromium and WebKit with a persistent profile: a destination set in
// Navigation, the Tactical camera and zoom, and critical damage are still there on the consoles that use them
// after switching stations in the one window, and after closing and reopening the app.
// The worker is blocked (persistence here is the demos' own localStorage; tests/pwa-offline.cjs covers the worker).
const assert = require('node:assert/strict');
const { expect } = require('./browser-harness.cjs');
const { persistentBrowser, siteServer, openStation, backToStations } = require('./pwa-journeys-lib.cjs');
const inventory = require('../demo-app/pwa/inventory.json');

const demo = folder => inventory.demos.find(entry => entry.folder === folder);

async function openCritical(page) {
  await page.locator('#menuBtn').click();
  await page.locator('#menuMain #openCritical').click();
  await expect(page.locator('#criticalDialog')).toHaveJSProperty('open', true);
}

// What each console shows of the linked state.
async function expectLinkedState(page) {
  await openStation(page, demo('Helm'));
  await expect(page.locator('#targetName'), 'Helm flies to the destination Navigation set').toHaveText('Mars');
  await backToStations(page);
  await openStation(page, demo('ViewScreen'));
  await expect.poll(() => page.evaluate(() => ViewScreenSettings.read()), { message: 'View Screen uses the Tactical camera and zoom' }).toMatchObject({ camera: 180, zoom: 3.5 });
  await backToStations(page);
  await openStation(page, demo('Battery'));
  await expect.poll(() => page.evaluate(() => DemoCombat.critical('battery')), { message: 'Battery shows the critical damage' }).toEqual(['cannot-recharge']);
  await backToStations(page);
}

(async () => {
  let failed = 0;
  const name = 'a destination set in Navigation, the Tactical camera and zoom, and critical damage are still there on the consoles that use them after switching in one window, and after closing and reopening the app';
  for (const engine of (process.env.ENGINES || 'chromium,webkit').split(',')) {
    const site = await siteServer();
    const session = await persistentBrowser({ engine, serviceWorkers: 'block' });
    try {
      let page = session.context.pages()[0] ?? await session.context.newPage();
      await page.goto(`${site.base}/app/`);

      // Navigation plots Mars for our ship through its navigation computer (instantly, for the test).
      await openStation(page, demo('Navigation'));
      const plotted = await page.evaluate(() => {
        const computer = NavComputer.connect({ ownRegistry: NavWorld.ownShip.registry });
        computer.setCalculationSeconds(0);
        return computer.plot(NavWorld.ownShip.registry, NavWorld.destinationForObject(NavWorld.worldObjects().find(object => object.name === 'Mars')));
      });
      assert.deepEqual(plotted, { ok: true });
      await backToStations(page);

      // The tactical officer points the view-screen camera aft and zooms in.
      await openStation(page, demo('TacticalOfficer'));
      await page.evaluate(() => ViewScreenSettings.write({ camera: 180, zoom: 3.5 }));
      await backToStations(page);

      // Critical damage is given from Reactor Control's menu.
      await openStation(page, demo('Reactor'));
      await openCritical(page);
      await page.locator('#criticalDialog [data-component="battery"] button[data-effect="cannot-recharge"]').click();
      await expect(page.locator('#criticalDialog [data-component="battery"] button[data-effect="cannot-recharge"]')).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Escape');
      await backToStations(page);

      await expectLinkedState(page);

      await session.relaunch();
      page = session.context.pages()[0] ?? await session.context.newPage();
      await page.goto(`${site.base}/app/`);
      await expectLinkedState(page);
      assert.equal(session.context.pages().length, 1, 'one window');
      console.log(`PASS [${engine}] ${name}`);
    } catch (error) {
      failed++;
      console.log(`FAIL [${engine}] ${name}\n     ${String(error.message).split('\n').slice(0, 10).join('\n     ')}`);
    } finally {
      await session.close();
      await site.close();
    }
  }
  console.log(failed ? `${failed} failed` : 'all passed');
  process.exit(failed ? 1 : 0);
})();
