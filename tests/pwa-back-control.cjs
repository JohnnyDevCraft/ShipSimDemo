// "Back to stations" on every demo inside the installed app, and nothing new on the public site (R4, R5).
//   DEMO_MOUNT=/ShipSimDemo VIEWPORTS=960x600,1280x800 node tests/pwa-back-control.cjs
// The service worker is blocked here (it would preload 200 MB per case); tests/pwa-offline.cjs covers it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run, expect, playwright, root, viewports } = require('./browser-harness.cjs');
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

// Real app windows (card #13's standalone case, card #25's fullscreen cases) each run in a headful Chromium window
// of their own (a fresh profile), so window-state changes never touch the shared browser. `app` opens an --app
// window; otherwise a normal tab whose page takes the real window size, so a fullscreen window really is fullscreen.
async function chromiumWindow(url, { app = false, serviceWorkers = 'block' } = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mps-app-'));
  const context = await playwright.chromium.launchPersistentContext(profile, {
    headless: false, args: app ? [`--app=${url}`] : [], viewport: app ? { width: 960, height: 600 } : null, serviceWorkers,
  });
  const page = context.pages()[0] ?? await context.waitForEvent('page');
  if (app) await page.waitForURL(url);
  else await page.goto(url);
  const close = async () => {
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  };
  return { context, page, close };
}

// Puts the browser window into fullscreen (the CDP equivalent of F11) and waits until the page reports it.
async function enterWindowFullscreen(context, page) {
  const session = await context.newCDPSession(page);
  const { windowId } = await session.send('Browser.getWindowForTarget');
  await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } });
  await page.waitForFunction(() => matchMedia('(display-mode: fullscreen)').matches, null, { timeout: 15000 });
}

const flag = page => page.evaluate(() => sessionStorage.getItem('mps-app-mode'));
const displayModes = page => page.evaluate(() => ({
  fullscreen: matchMedia('(display-mode: fullscreen)').matches, standalone: matchMedia('(display-mode: standalone)').matches,
}));

// A real standalone window (Chromium --app) shows the control from display-mode alone, with no session flag
// (ANALYSIS-015). Runs once, in Chromium.
async function standaloneWindow(base) {
  const { page, close } = await chromiumWindow(`${base}/Reactor/index.html`, { app: true });
  try {
    assert.equal(await page.evaluate(() => matchMedia('(display-mode: standalone)').matches), true, 'the --app window is standalone');
    assert.equal(await flag(page), '1', 'the shell marks the session from display-mode');
    await expect(page.getByRole('link', { name: 'Back to stations' })).toBeVisible();
  } finally {
    await close();
  }
}

// The installed app on Android opens fullscreen. Stand-in: an --app window switched to fullscreen, with the app's
// worker controlling the demo, entered without the picker's flag (as when Android hands a link to the installed app).
async function fullscreenAppWindow(base) {
  const { context, page, close } = await chromiumWindow(`${base}/app/`, { app: true, serviceWorkers: 'allow' });
  try {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 60000 });
    await page.goto(`${base}/Reactor/index.html`);
    await enterWindowFullscreen(context, page);
    await page.evaluate(() => sessionStorage.removeItem('mps-app-mode'));
    assert.equal(await flag(page), null, 'no session flag before the reload');
    await page.reload();
    assert.deepEqual(await displayModes(page), { fullscreen: true, standalone: false }, 'fullscreen, not standalone: the fullscreen branch must do the work');
    assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true, 'the app worker controls the demo');
    const back = page.getByRole('link', { name: 'Back to stations' });
    await expect(back).toBeVisible();
    const box = await back.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44, `back control is ${box.width}x${box.height}`);
    assert.equal(await flag(page), '1', 'the shell marks the session again');
    const links = await linkAudit(page);
    assert.deepEqual(links.newWindow, [], 'links that would open a new window');
    assert.deepEqual(links.publicLanding, [], 'links that would leave the app for the public landing page');
    await tapBack(page);
    await expect(page).toHaveURL(/\/ShipSimDemo\/app\/$/);
    assert.equal(context.pages().length, 1, 'still one window');
  } finally {
    await close();
  }
}

// An ordinary tab whose browser window is fullscreen (F11). Chrome reports display-mode fullscreen here too, but no
// app worker controls the page and there is no flag, so it stays the public page.
async function f11Tab(base) {
  const { context, page, close } = await chromiumWindow(`${base}/Reactor/index.html`);
  try {
    await enterWindowFullscreen(context, page);
    await page.reload();
    assert.equal((await displayModes(page)).fullscreen, true, 'Chrome reports display-mode fullscreen in an F11 tab');
    await page.waitForTimeout(700);
    await expect(page.getByRole('link', { name: 'Back to stations' })).toHaveCount(0);
    assert.equal(await page.locator('a[href="../index.html"]').count() > 0, true, 'landing-page links are not rewritten');
    assert.equal(await flag(page), null, 'no session flag written');
  } finally {
    await close();
  }
}

// Makes the page start as if its window were fullscreen and controlled by the app's worker; `element` also makes an
// element fullscreen (the Fullscreen API). The shell decides once at script start, and requestFullscreen() needs a
// user gesture, so these signals are stubbed before any page script runs. Runs in Chromium and WebKit.
function stubFullscreen({ element }) {
  const realMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = query => /display-mode:\s*fullscreen/.test(query)
    ? { matches: true, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }
    : realMatchMedia(query);
  const controller = { scriptURL: `${location.origin}/sw.js`, state: 'activated' };
  if (navigator.serviceWorker) Object.defineProperty(navigator.serviceWorker, 'controller', { configurable: true, get: () => controller });
  else Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { controller } });
  if (element) Object.defineProperty(Document.prototype, 'fullscreenElement', { configurable: true, get: () => document.documentElement });
}

async function openStubbed(context, base, element) {
  await context.addInitScript(stubFullscreen, { element });
  const page = await context.newPage();
  await page.goto(`${base}/Reactor/index.html`);
  await page.waitForTimeout(700);
  return page;
}

cases['a fullscreen window controlled by the app\'s worker shows Back to stations without the flag (stubbed signals)'] = async ({ context, base }) => {
  const page = await openStubbed(context, base, false);
  await expect(page.getByRole('link', { name: 'Back to stations' })).toBeVisible();
};

cases['a Fullscreen API tab is not the app, even with the worker present (stubbed signals)'] = async ({ context, base }) => {
  const page = await openStubbed(context, base, true);
  await expect(page.getByRole('link', { name: 'Back to stations' })).toHaveCount(0);
  assert.equal(await page.locator('a[href="../index.html"]').count() > 0, true, 'landing-page links are not rewritten');
};

// Real app windows need headful Chromium; they run once (first viewport). STANDALONE=0 skips them.
if (process.env.STANDALONE !== '0') {
  const once = body => async ({ engine, base, viewport }) => {
    if (engine !== 'chromium' || viewport !== viewports[0]) return;
    await body(base);
  };
  cases['a standalone window (Chromium --app) shows Back to stations without the picker\'s flag'] = once(standaloneWindow);
  cases['a fullscreen app window (Chromium --app, fullscreen) shows Back to stations without the picker\'s flag'] = once(fullscreenAppWindow);
  cases['an F11 tab (browser window fullscreen) does not show Back to stations'] = once(f11Tab);
}

run(cases, { contextOptions: { serviceWorkers: 'block' } });
