// Offline (R7, R8, Story 3), in Chromium with a persistent profile, against the tree served under /ShipSimDemo/:
// - after preparation completes, with the browser closed and reopened and the server stopped, the picker opens
//   and every demo loads with its 3D models and sounds and no failed requests;
// - an interrupted preparation reports failure (never Offline ready), then completes on Retry.
// Writes artifacts/pwa/offline-results.json (per demo) for the offline report. WebKit offline evidence comes from
// the real iPad (research Topic 7).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { expect } = require('./browser-harness.cjs');
const { persistentBrowser, siteServer, openStation, tapBack, waitForOfflineReady, screenshotPath, ARTIFACTS } = require('./pwa-journeys-lib.cjs');
const inventory = require('../demo-app/pwa/inventory.json');

const dir = process.env.DEMO_ROOT ? path.resolve(process.env.DEMO_ROOT) : undefined;
const ONLY = process.env.DEMOS ? process.env.DEMOS.split(',') : null;

const cases = {
  'after preparation completes, with the browser closed and reopened and the server stopped, the picker opens and every demo loads with its 3D models and sounds and no failed requests': async () => {
    const site = await siteServer({ dir });
    const session = await persistentBrowser();
    const results = [];
    try {
      let page = await session.context.newPage();
      await page.goto(`${site.base}/app/`);
      const started = Date.now();
      await waitForOfflineReady(page);
      const preparedSeconds = (Date.now() - started) / 1000;
      const storage = await page.getByTestId('storage').textContent();
      await page.screenshot({ path: screenshotPath('offline-ready-chromium-960x600') });

      await site.stop();
      await session.relaunch();
      page = await session.context.newPage();
      await page.goto(`${site.base}/app/`);
      await expect(page.locator('a.station')).toHaveCount(23);
      await expect(page.getByTestId('offline-title')).toHaveText('Offline ready');
      await page.screenshot({ path: screenshotPath('offline-cold-start-picker-chromium-960x600') });

      for (const demo of inventory.demos.filter(entry => !ONLY || ONLY.includes(entry.folder))) {
        const failures = [], errors = [], assets = [];
        const onFailed = request => failures.push(`${request.url()} (${request.failure()?.errorText})`);
        const onResponse = response => {
          if (response.status() >= 400) failures.push(`${response.url()} (HTTP ${response.status()})`);
          else if (/\/(models|Assets)\//.test(response.url())) assets.push(response.url().replace(/^.*\/ShipSimDemo\//, ''));
        };
        const onError = error => errors.push(error.message);
        page.on('requestfailed', onFailed);
        page.on('response', onResponse);
        page.on('pageerror', onError);
        let outcome = 'pass', note = '';
        try {
          await openStation(page, demo);
          await page.waitForTimeout(demo.heavyAssets.length ? 3000 : 800);
          if (demo.sharedScripts.includes('Shared/demo-sound.js')) {
            const sounds = await page.evaluate(async () => Promise.all(['hull-hit.wav', 'shield-hit.wav'].map(async name => {
              const whole = await fetch(`../Assets/audio/${name}`);
              const part = await fetch(`../Assets/audio/${name}`, { headers: { range: 'bytes=0-99' } });
              return { name, whole: whole.status, part: part.status, partBytes: (await part.arrayBuffer()).byteLength };
            })));
            for (const sound of sounds) {
              if (sound.whole !== 200 || sound.part !== 206 || sound.partBytes !== 100) failures.push(`sound ${sound.name}: ${JSON.stringify(sound)}`);
            }
            note = 'sounds served offline (whole and byte range)';
          }
          if (failures.length || errors.length) outcome = 'fail';
        } catch (error) {
          outcome = 'fail';
          errors.push(String(error.message).split('\n')[0]);
        } finally {
          page.off('requestfailed', onFailed);
          page.off('response', onResponse);
          page.off('pageerror', onError);
        }
        results.push({ folder: demo.folder, outcome, assets: [...new Set(assets)].length, modelFiles: [...new Set(assets.filter(url => url.startsWith('models/') || url.endsWith('.glb')))], failures, errors, note });
        if (outcome === 'pass') {
          await tapBack(page);
          await expect(page.locator('a.station')).toHaveCount(23);
        } else {
          await page.goto(`${site.base}/app/`);
        }
      }
      fs.mkdirSync(ARTIFACTS, { recursive: true });
      fs.writeFileSync(path.join(ARTIFACTS, 'offline-results.json'), JSON.stringify({ measured: new Date().toISOString(), how: 'Chromium (Playwright), persistent profile, prepared online, browser closed and reopened, local server stopped', preparedSeconds, storage, results }, null, 2));
      const failed = results.filter(result => result.outcome !== 'pass');
      assert.deepEqual(failed.map(result => `${result.folder}: ${[...result.failures, ...result.errors].join('; ')}`), [], 'demos that failed offline');
    } finally {
      await session.close();
      await site.close();
    }
  },
  'an interrupted preparation reports failure, never Offline ready, then completes on Retry': async () => {
    const site = await siteServer({ dir, slowModelsMs: 400 });
    const session = await persistentBrowser();
    try {
      const page = await session.context.newPage();
      await page.goto(`${site.base}/app/`);
      await expect(page.getByTestId('offline-title')).toHaveText('Preparing offline', { timeout: 60000 });
      await site.stop(); // the Wi-Fi drops part-way
      await expect(page.getByTestId('offline-title')).toHaveText('Preparation failed', { timeout: 60000 });
      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
      await page.screenshot({ path: screenshotPath('offline-failed-retry-chromium-960x600') });
      await site.start();
      await page.getByRole('button', { name: 'Retry' }).click();
      await waitForOfflineReady(page);
    } finally {
      await session.close();
      await site.close();
    }
  },
};

(async () => {
  let failed = 0;
  for (const [name, body] of Object.entries(cases)) {
    try {
      await body();
      console.log(`PASS [chromium] ${name}`);
    } catch (error) {
      failed++;
      console.log(`FAIL [chromium] ${name}\n     ${String(error.message).split('\n').slice(0, 12).join('\n     ')}`);
    }
  }
  console.log(failed ? `${failed} failed` : 'all passed');
  process.exit(failed ? 1 : 0);
})();
