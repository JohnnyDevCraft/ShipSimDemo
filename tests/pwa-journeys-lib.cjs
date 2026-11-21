// Reusable steps for the installable-app journeys: open a station from the picker, go back, audit links, wait for
// offline preparation, launch a browser with a persistent profile (close and reopen = relaunch), and control the
// local server (stop it = no network). Tests keep their own assertions; these only perform the steps.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { expect, playwright, serve, mount } = require('./browser-harness.cjs');

const ARTIFACTS = path.join(__dirname, 'artifacts/pwa');

// From the picker, opens a demo by its inventory entry and waits for its identifying element.
async function openStation(page, demo) {
  await page.locator(`a.station[data-station="${demo.folder}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/${demo.folder}/index\\.html$`));
  await expectDemo(page, demo);
}

async function expectDemo(page, demo) {
  const marker = page.locator(demo.identify.selector).first();
  await expect(marker, demo.folder).toBeVisible({ timeout: 20000 });
  if (demo.identify.text) await expect(marker, demo.folder).toHaveText(demo.identify.text);
}

// Taps "Back to stations". Heavy 3D pages in headless Chromium (software WebGL) starve animation frames, so
// Playwright's "stable" wait may never settle; instead this proves the control is the topmost thing at its centre
// (a tap there reaches it) and then clicks without that wait.
async function tapBack(page) {
  const back = page.getByRole('link', { name: 'Back to stations' });
  await expect(back).toBeVisible();
  const reachable = await back.evaluate(link => {
    const box = link.getBoundingClientRect();
    const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return !!top && (top === link || link.contains(top));
  });
  if (!reachable) throw new Error('Back to stations is covered by another element');
  await back.click({ force: true });
}

async function backToStations(page) {
  await tapBack(page);
  await expect(page).toHaveURL(/\/app\/$/);
  await expect(page.locator('a.station')).toHaveCount(23);
}

// Links on the page that would open a new window, or lead to the public landing page instead of the picker.
function linkAudit(page) {
  return page.evaluate(() => {
    const site = new URL('../', location.href);
    const landing = new Set([site.href, `${site.href}index.html`]);
    const links = [...document.querySelectorAll('a[href]')];
    return {
      newWindow: links.filter(link => link.target === '_blank' && link.href.startsWith(site.href)).map(link => link.getAttribute('href')),
      publicLanding: links.filter(link => landing.has(link.href.split('#')[0])).map(link => link.getAttribute('href')),
    };
  });
}

async function waitForOfflineReady(page, timeout = 240000) {
  await expect(page.getByTestId('offline-title')).toHaveText('Offline ready', { timeout });
}

// A browser with stored data that survives closing it: relaunch() closes and opens it again on the same profile.
async function persistentBrowser({ engine = 'chromium', viewport = { width: 960, height: 600 }, app = null, ...options } = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mps-profile-'));
  const launch = () => playwright[engine].launchPersistentContext(profile, { viewport, ...(app ? { headless: false, args: [`--app=${app}`] } : {}), ...options });
  const session = { profile, context: await launch() };
  session.relaunch = async () => {
    await session.context.close();
    session.context = await launch();
    return session.context;
  };
  session.close = async () => {
    await session.context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  };
  return session;
}

// A local server for one tree under the GitHub Pages prefix, on a fixed port so the origin (and so the stored
// data) stays the same when it is stopped and started again.
async function siteServer({ dir, prefix = mount || '/ShipSimDemo', slowModelsMs = 0 } = {}) {
  const log = [];
  let server = await serve({ ...(dir ? { dir } : {}), prefix, log, slowModelsMs });
  const port = server.address().port;
  const site = {
    log,
    base: `http://127.0.0.1:${port}${prefix}`,
    stop: () => new Promise(resolve => { server.closeAllConnections?.(); server.close(() => resolve()); server = null; }),
    start: async () => { server = await serve({ ...(dir ? { dir } : {}), prefix, port, log, slowModelsMs }); },
    close: () => (server ? site.stop() : Promise.resolve()),
  };
  return site;
}

function screenshotPath(name) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  return path.join(ARTIFACTS, `${name}.png`);
}

module.exports = { openStation, expectDemo, tapBack, backToStations, linkAudit, waitForOfflineReady, persistentBrowser, siteServer, screenshotPath, ARTIFACTS };
