// Torpedo Launch Control fits any landscape window from an iPad to a 4K monitor: the scope covers the window,
// the panels, aim tape, advisory and dock stay on screen and apart, the reticle sits in the middle of the clear
// space, and the target readout, zoom and history fit.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const sizes = [[1024, 768], [1180, 820], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const parts = { launcher: '.launcher', target: '#targetPanel', zoom: '.zoom-panel', tape: '#aimTape', advisory: '#advisory', dock: '.dock', topbar: '.topbar' };
const box = (page, selector) => page.locator(selector).evaluate(element => { const b = element.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });

const cases = {};
for (const [width, height] of sizes)
  cases[`everything fits at ${width}×${height}`] = async ({ open }) => {
    const page = await open('/TorpedoLaunch/?models=0');
    await page.setViewportSize({ width, height });
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('#moveShips').click();
    await page.locator('#menuDialog [data-close]').last().click();
    await page.evaluate(() => TorpedoLaunch.set({ contacts: [{ bearing: 2, range: 6000, yaw: 90 }] }));
    const point = await page.evaluate(() => TorpedoLaunch.tapPoint('ship:Training ship A'));
    await page.mouse.click(point.x, point.y);
    await expect(page.locator('#targetPanel')).toBeVisible();
    await page.waitForTimeout(150);
    const hud = await box(page, '#hud');
    assert.deepEqual([hud.l, hud.t, hud.r, hud.b], [0, 0, width, height], 'the scope covers the window');
    const boxes = {};
    for (const [name, selector] of Object.entries(parts)) boxes[name] = await box(page, selector);
    for (const [name, b] of Object.entries(boxes)) assert.ok(b.l >= -0.5 && b.t >= -0.5 && b.r <= width + 0.5 && b.b <= height + 0.5, `${name} is inside the window`);
    const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const names = Object.keys(boxes);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(boxes[names[i]], boxes[names[j]]), `${names[i]} and ${names[j]} do not overlap`);
    // The reticle is at the window's centre, which is the middle of the space between the side columns.
    const middle = (boxes.launcher.r + boxes.zoom.l) / 2;
    assert.ok(Math.abs(middle - width / 2) < width * 0.01, `the clear space is centred on the reticle (${middle} vs ${width / 2})`);
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.panel')].filter(panel => panel.scrollHeight > panel.clientHeight + 1).map(panel => panel.className));
    assert.deepEqual(clipped, [], 'no panel has content scrolled out of sight');
    for (const control of ['#armBtn', '#launchBtn', '#prepared .round:last-child button', '#hullValue', '#subsystemNote', '#historyBtn', '#clearTarget', '#menuBtn']) await expect(page.locator(control)).toBeInViewport({ ratio: 0.99 });
    const zoomHeight = await page.locator('#zoomSlider').evaluate(element => element.getBoundingClientRect().height);
    assert.ok(zoomHeight > height * 0.12, `the zoom slider stays usable (${zoomHeight}px)`);
    // History with a few shots fits.
    for (let i = 0; i < 3; i++) {
      await page.locator('#prepared .round button').first().click();
      await page.evaluate(() => TorpedoLaunch.advance(5000));
      await page.locator('#armBtn').click();
      await page.locator('#launchBtn').click();
    }
    await page.locator('#historyBtn').click();
    await expect(page.locator('#historyList .shot')).toHaveCount(3);
    const fits = await page.evaluate(() => { const d = document.getElementById('historyDialog'), b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && d.scrollHeight <= d.clientHeight + 1; });
    assert.ok(fits, 'the history fits without scrolling');
  };
run(cases);
