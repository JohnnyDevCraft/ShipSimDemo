// "Enter Fullscreen" in every console's menu: a normal browser tab goes fullscreen from one tap, with nothing
// installed, no service worker and no redirect to /app/ (card #25 correction, 2026-11-23).
//   DEMO_MOUNT=/ShipSimDemo VIEWPORTS=960x600 node tests/fullscreen-menu.cjs
//   ENGINES=chromium DEMOS=Helm,Battery node tests/fullscreen-menu.cjs
// The service worker is blocked in every case: the button must work without one.
// Headless Chromium grants the Fullscreen API to a trusted click; headless WebKit may refuse it, so the cases that
// need a granted request run in Chromium, and WebKit checks the menu and the honest feedback instead.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');
const inventory = require('../demo-app/pwa/inventory.json');

const ONLY = process.env.DEMOS ? process.env.DEMOS.split(',') : null;
const demos = inventory.demos.filter(demo => !ONLY || ONLY.includes(demo.folder));
const byFolder = folder => inventory.demos.find(demo => demo.folder === folder);
const TOGGLE = '#menuMain #fullscreenToggle';

// Records, inside the page, how each fullscreen request was made: whether it ran inside the click's own dispatch
// (no await, timer or promise before it) and with a live user activation.
function recordRequests() {
  window.__fullscreenCalls = [];
  let inClick = false;
  addEventListener('click', () => { inClick = true; }, true);
  addEventListener('click', () => { inClick = false; });
  const original = Element.prototype.requestFullscreen;
  if (!original) return;
  Element.prototype.requestFullscreen = function (...args) {
    window.__fullscreenCalls.push({ inClick, active: navigator.userActivation ? navigator.userActivation.isActive : null, root: this === document.documentElement, options: args[0] || null });
    return original.apply(this, args);
  };
}

function refuseRequests() {
  Element.prototype.requestFullscreen = function () {
    return Promise.reject(new TypeError('Permissions check failed'));
  };
}

function removeApi() {
  for (const name of ['requestFullscreen', 'webkitRequestFullscreen']) delete Element.prototype[name];
  for (const name of ['fullscreenEnabled', 'webkitFullscreenEnabled']) Object.defineProperty(Document.prototype, name, { configurable: true, get: () => false });
}

// The 3D consoles (View Screen, Tractor Beam, Torpedo Launch, the energy weapons) can keep headless Chromium's main
// thread so busy that an action takes well over the harness's 10 s; untouched pages behave the same.
async function openDemo(open, demo) {
  const page = await open(`/${demo.folder}/index.html`);
  page.setDefaultTimeout(30000);
  await expect(page.locator(demo.identify.selector).first(), demo.folder).toBeVisible();
  return page;
}

async function openMenu(page) {
  await page.locator('#menuBtn').click();
  await expect(page.locator('#menuDialog')).toHaveJSProperty('open', true);
}

const isFullscreen = page => page.evaluate(() => document.fullscreenElement === document.documentElement);

async function enterFromMenu(page) {
  await openMenu(page);
  await expect(page.locator(TOGGLE)).toContainText('Enter Fullscreen');
  await page.locator(TOGGLE).click();
  await expect.poll(() => isFullscreen(page)).toBe(true);
  await expect(page.locator('#menuDialog')).toHaveJSProperty('open', false);
}

const contextOptions = { serviceWorkers: 'block' };

run({
  'every demo console has a clearly labelled Enter Fullscreen button in its header menu': async ({ open }) => {
    for (const demo of demos) {
      const page = await openDemo(open, demo);
      await openMenu(page);
      const button = page.locator(TOGGLE);
      await expect(button, demo.folder).toBeVisible();
      await expect(button.locator('b'), demo.folder).toHaveText('Enter Fullscreen');
      await expect(page.locator('#menuMain').getByRole('button', { name: /Enter Fullscreen/ }), demo.folder).toHaveCount(1);
      const height = await button.evaluate(node => node.getBoundingClientRect().height);
      assert.ok(height >= 44, `${demo.folder}: the button is ${height}px tall`);
      await page.close();
    }
  },
  'from a normal tab one tap goes fullscreen at once, inside the tap, on the whole console': async ({ open, engine, context }) => {
    if (engine !== 'chromium') return;
    await context.addInitScript(recordRequests);
    const page = await openDemo(open, byFolder('Helm'));
    await enterFromMenu(page);
    const calls = await page.evaluate(() => window.__fullscreenCalls);
    assert.equal(calls.length, 1, 'one request');
    assert.equal(calls[0].inClick, true, 'requested inside the click, before any await or timer');
    assert.equal(calls[0].active, true, 'requested with the user activation still live');
    assert.equal(calls[0].root, true, 'the whole document goes fullscreen');
    assert.deepEqual(calls[0].options, { navigationUI: 'hide' });
    await expect(page).toHaveURL(/\/Helm\/index\.html$/);
    assert.equal(context.pages().length, 1, 'nothing opened elsewhere');
  },
  'the menu then offers Exit Fullscreen, which leaves; Enter Fullscreen works again after it': async ({ open, engine }) => {
    if (engine !== 'chromium') return;
    const page = await openDemo(open, byFolder('Battery'));
    await enterFromMenu(page);
    await openMenu(page);
    await expect(page.locator(`${TOGGLE} b`)).toHaveText('Exit Fullscreen');
    await page.locator(TOGGLE).click();
    await expect.poll(() => isFullscreen(page)).toBe(false);
    await openMenu(page);
    await expect(page.locator(`${TOGGLE} b`)).toHaveText('Enter Fullscreen');
    await page.locator(TOGGLE).click();
    await expect.poll(() => isFullscreen(page)).toBe(true);
    await openMenu(page);
    await expect(page.locator(`${TOGGLE} b`)).toHaveText('Exit Fullscreen');
  },
  'leaving fullscreen outside the menu (Android Back, Esc) puts the menu back to Enter Fullscreen': async ({ open, engine }) => {
    if (engine !== 'chromium') return;
    const page = await openDemo(open, byFolder('Reactor'));
    await enterFromMenu(page);
    await page.evaluate(() => document.exitFullscreen()); // what the browser does on Back or Esc
    await expect.poll(() => isFullscreen(page)).toBe(false);
    await openMenu(page);
    await expect(page.locator(`${TOGGLE} b`)).toHaveText('Enter Fullscreen');
  },
  'browser fullscreen does not make a normal tab behave like the installed app': async ({ open, engine }) => {
    if (engine !== 'chromium') return;
    const page = await openDemo(open, byFolder('Command'));
    const landing = await page.locator('#menuMain a[href="../index.html"]').count();
    await enterFromMenu(page);
    await page.waitForTimeout(700); // the app shell places its control within 600 ms when it is active
    await expect(page.getByRole('link', { name: 'Back to stations' })).toHaveCount(0);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('mps-app-mode')), null, 'no app-mode flag');
    assert.equal(await page.locator('#menuMain a[href="../index.html"]').count(), landing, 'All demos still links to the public landing page');
  },
  'a quick switch to another console stays in this tab and offers one tap back to fullscreen': async ({ open, engine, context }) => {
    if (engine !== 'chromium') return;
    const page = await openDemo(open, byFolder('Battery'));
    await enterFromMenu(page);
    await openMenu(page);
    await page.locator('#menuMain .qs-menu button[data-division="tactical"]').click();
    await page.locator('#quickSwitch a[data-console="Shields"]').click();
    await expect(page).toHaveTitle(/Shield System Control/);
    assert.equal(context.pages().length, 1, 'still one tab');
    const resume = page.getByRole('button', { name: 'Return to fullscreen' });
    await expect(resume).toBeVisible();
    await resume.click();
    await expect.poll(() => isFullscreen(page)).toBe(true);
    await expect(resume).toHaveCount(0);
    await openMenu(page);
    await expect(page.locator(`${TOGGLE} b`)).toHaveText('Exit Fullscreen');
  },
  'a console opened afresh does not offer Return to fullscreen': async ({ open }) => {
    const page = await openDemo(open, byFolder('Shields'));
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: 'Return to fullscreen' })).toHaveCount(0);
  },
  'when the browser refuses, the console says so plainly and stays usable': async ({ open, context }) => {
    await context.addInitScript(refuseRequests);
    const page = await openDemo(open, byFolder('Helm'));
    await openMenu(page);
    await page.locator(TOGGLE).click();
    const notice = page.locator('#fullscreenNotice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("didn't allow fullscreen");
    assert.equal(await isFullscreen(page), false);
    await openMenu(page);
    await expect(page.locator(`${TOGGLE} b`)).toHaveText('Enter Fullscreen');
  },
  'when the browser has no fullscreen for pages, the console says so plainly and stays usable': async ({ open, context }) => {
    await context.addInitScript(removeApi);
    const page = await openDemo(open, byFolder('Navigation'));
    await openMenu(page);
    await expect(page.locator(TOGGLE)).toContainText('Enter Fullscreen');
    await page.locator(TOGGLE).click();
    const notice = page.locator('#fullscreenNotice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("can't");
    await openMenu(page);
    await expect(page.locator('#menuDialog')).toHaveJSProperty('open', true);
  },
}, { contextOptions });
