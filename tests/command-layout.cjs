// Command Control fits phones held upright, from a small Android (360×640) to the largest iPhone (430×932), on a
// mobile browser with touch: nothing scrolls sideways, the top bar, the status strip and the tab bar stay on screen
// and apart, the View tab's stick, views and scanners fit without scrolling, the touch targets are at least 44 px,
// one-line readouts stay on one line, and the menu fits. Held sideways, on a tablet and on a desktop it still fits.
const assert = require('node:assert/strict');
const path = require('node:path');
const { run } = require('./browser-harness.cjs');
const playwright = require(process.env.PLAYWRIGHT_MODULE || path.resolve(__dirname, '../../ng-app/node_modules/@playwright/test'));

const phones = [[360, 640], [360, 780], [375, 667], [390, 844], [393, 852], [412, 915], [430, 932]];
const others = [[844, 390, 'phone sideways'], [820, 1180, 'tablet'], [1440, 900, 'desktop']];
const box = (page, selector) => page.locator(selector).evaluate(e => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, h: b.height, w: b.width }; });
const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;

async function check({ context, engine, base }, width, height, { mobile = true, portrait = true } = {}) {
  const ctx = await context.browser().newContext({ viewport: { width, height }, ...(mobile ? { isMobile: engine !== 'firefox', hasTouch: true, deviceScaleFactor: 3 } : {}) }), errors = [];
  try {
    const page = await ctx.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/Command/');
    for (const tab of ['status', 'view', 'labels']) {
      await page.evaluate(t => CommandControl.showTab(t), tab);
      await page.waitForTimeout(80);
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(sideways <= 0.5, `${tab}: nothing scrolls sideways (${sideways})`);
      const parts = { top: await box(page, '.ctop'), strip: await box(page, '#statusStrip'), tab: await box(page, `#${tab}Tab`), bar: await box(page, '.tabbar') };
      for (const [name, b] of Object.entries(parts)) assert.ok(b.l >= -0.5 && b.t >= -0.5 && b.r <= width + 0.5 && b.b <= height + 0.5, `${tab}: ${name} is inside the window`);
      const names = Object.keys(parts);
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(parts[names[i]], parts[names[j]]), `${tab}: ${names[i]} and ${names[j]} do not overlap`);
      // Nothing spills out of a panel sideways.
      const spill = await page.evaluate(t => [...document.querySelectorAll(`#${t}Tab .panel`)].flatMap(panel => {
        const p = panel.getBoundingClientRect();
        return [...panel.querySelectorAll('*')].filter(e => e.getClientRects().length).filter(e => { const b = e.getBoundingClientRect(); return b.right > p.right + 0.5 || b.left < p.left - 0.5; }).map(e => `${e.tagName}.${e.className} ${e.textContent.slice(0, 20)}`);
      }), tab);
      assert.deepEqual(spill, [], `${tab}: everything stays inside its panel`);
      // Touch targets
      const small = await page.evaluate(t => [...document.querySelectorAll(`#${t}Tab button, .tabbar button, #menuBtn`)].filter(b => b.offsetParent).map(b => ({ name: b.textContent.trim() || b.getAttribute('aria-label'), h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width })).filter(b => b.h < 43.5 || b.w < 43.5), tab);
      assert.deepEqual(small, [], `${tab}: touch targets are at least 44 px`);
    }
    // The strip's readouts and the chips stay on one line.
    const wrapped = await page.evaluate(() => [...document.querySelectorAll('.status-strip b, .status-strip small, .thead h2, .chip, .dot-card b, .dwhere, .tabbar button')].filter(e => e.offsetParent && e.getClientRects().length && e.getBoundingClientRect().height > parseFloat(getComputedStyle(e).lineHeight || 0) * 1.6 + 30).map(e => e.textContent));
    assert.deepEqual(wrapped, [], 'one-line readouts stay on one line');
    // The View tab: everything fits without scrolling when the phone is upright, and the stick is a good size.
    await page.evaluate(() => CommandControl.showTab('view'));
    await page.waitForTimeout(80);
    if (portrait) {
      const view = await page.locator('#viewTab').evaluate(t => ({ scroll: t.scrollHeight, client: t.clientHeight }));
      assert.ok(view.scroll <= view.client + 1, `the view tab fits without scrolling (${view.scroll} > ${view.client})`);
    }
    const stick = await box(page, '#cameraStick');
    assert.ok(stick.w >= 140, `the stick is at least 140 px (${stick.w})`);
    // Labels fit without scrolling too.
    await page.evaluate(() => CommandControl.showTab('labels'));
    if (portrait) {
      const labels = await page.locator('#labelsTab').evaluate(t => t.scrollHeight <= t.clientHeight + 1);
      assert.ok(labels, 'the labels tab fits without scrolling');
    }
    // The menu fits.
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    const menu = await page.evaluate(() => { const d = document.getElementById('menuDialog'), b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth && d.scrollHeight <= d.clientHeight + 1; });
    assert.ok(menu, 'the menu fits');
    assert.deepEqual(errors, []);
  } finally {
    await ctx.close();
  }
}

const cases = {};
for (const [width, height] of phones) cases[`a phone at ${width}×${height}`] = args => check(args, width, height);
for (const [width, height, name] of others) cases[`a ${name} at ${width}×${height}`] = args => check(args, width, height, { mobile: name !== 'desktop', portrait: name !== 'phone sideways' });
run(cases);
