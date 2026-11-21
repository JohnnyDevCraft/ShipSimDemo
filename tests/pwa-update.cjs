// Updates (R7, Story 1 edge case), in Chromium with a persistent profile: after a deployment that changes only one
// demo file, the picker offers Update, the host taps it, and every page then comes from the new version, with no
// mix and nothing downloaded twice. Runs on a temporary publish copy so the change never touches the source tree.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { expect } = require('./browser-harness.cjs');
const { persistentBrowser, siteServer, waitForOfflineReady, screenshotPath } = require('./pwa-journeys-lib.cjs');
const { publishCopy } = require('../scripts/publish-copy.cjs');
const { writeManifestAndStamp, workerVersion } = require('../scripts/build-pwa.cjs');

const MARKER = '\n/* deployment 2 */\n';

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mps-update-'));
  publishCopy(dir);
  const site = await siteServer({ dir });
  const session = await persistentBrowser();
  let failed = 0;
  const name = 'after a deployment that changes only one demo file, the picker offers Update, the host taps it, and every page then comes from the new version with no mix and nothing downloaded twice';
  try {
    let page = await session.context.newPage();
    await page.goto(`${site.base}/app/`);
    await waitForOfflineReady(page);
    const firstVersion = workerVersion(fs.readFileSync(path.join(dir, 'sw.js'), 'utf8'));

    // Deployment 2: one demo script changes; the build writes the new list and stamps sw.js.
    fs.appendFileSync(path.join(dir, 'Reactor/reactor.js'), MARKER);
    writeManifestAndStamp(dir);
    const secondVersion = workerVersion(fs.readFileSync(path.join(dir, 'sw.js'), 'utf8'));
    assert.notEqual(secondVersion, firstVersion, 'the deployment changed sw.js');

    site.log.length = 0;
    await page.goto(`${site.base}/app/`); // the picker checks for an update each time it opens
    await expect(page.getByTestId('update')).toBeVisible({ timeout: 60000 });
    await page.screenshot({ path: screenshotPath('picker-update-available-chromium-960x600') });
    const reloaded = page.waitForEvent('load');
    await page.getByTestId('update').click();
    await reloaded;
    await waitForOfflineReady(page);

    const downloads = site.log.filter(entry => !/\/(sw\.js|app\/precache-manifest\.json|app\/(index\.html)?)$/.test(entry) && !entry.endsWith('/app/'));
    assert.deepEqual(downloads.filter(entry => entry !== '/ShipSimDemo/app/'), ['/ShipSimDemo/Reactor/reactor.js'], `only the changed file was downloaded (saw ${site.log.join(', ')})`);

    // Every page now comes from the new version, from the cache, with the server gone.
    await site.stop();
    await session.relaunch();
    page = await session.context.newPage();
    await page.goto(`${site.base}/Reactor/index.html`);
    const served = await page.evaluate(async () => (await (await fetch('reactor.js?v=20261121')).text()).endsWith('/* deployment 2 */\n'));
    assert.equal(served, true, 'Reactor runs the new script');
    const active = await page.evaluate(async () => (await (await fetch('../sw.js').catch(() => null))?.text?.()) ?? null);
    assert.equal(active, null, 'sw.js is never served from the cache');
    await expect(page.locator('.title-pill')).toHaveText('REACTOR CONTROL');
    console.log(`PASS [chromium] ${name}`);
  } catch (error) {
    failed++;
    console.log(`FAIL [chromium] ${name}\n     ${String(error.message).split('\n').slice(0, 10).join('\n     ')}`);
  } finally {
    await session.close();
    await site.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(failed ? `${failed} failed` : 'all passed');
  process.exit(failed ? 1 : 0);
})();
