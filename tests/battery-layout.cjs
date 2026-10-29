// Battery Control fits any landscape window from an iPad to a 4K monitor: the panels, schematic, advisory and
// dock stay on screen and apart, the drawing sits between the panels, and the diagnostics fit.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const sizes = [[1024, 768], [1180, 820], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const parts = { battery: '.battery-panel', sync: '.monitor-panel:nth-of-type(1)', reactor: '.monitor-panel:nth-of-type(2)', schematic: '#schematic', advisory: '#advisory', dock: '.dock', topbar: '.topbar' };
const box = (page, selector) => page.locator(selector).evaluate(element => { const b = element.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });

const cases = {};
for (const [width, height] of sizes)
  cases[`everything fits at ${width}×${height}`] = async ({ open }) => {
    const page = await open('/Battery/');
    await page.setViewportSize({ width, height });
    // Docked with power sync on: the longest readings.
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('#demoDock').click();
    await page.evaluate(() => BatteryControl.step(101));
    await page.locator('#demoSync').click();
    await page.locator('#menuDialog [data-close]').last().click();
    await page.waitForTimeout(150);
    const boxes = {};
    for (const [name, selector] of Object.entries(parts)) boxes[name] = await box(page, selector);
    for (const [name, b] of Object.entries(boxes)) assert.ok(b.l >= -0.5 && b.t >= -0.5 && b.r <= width + 0.5 && b.b <= height + 0.5, `${name} is inside the window`);
    const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const names = Object.keys(boxes);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(boxes[names[i]], boxes[names[j]]), `${names[i]} and ${names[j]} do not overlap`);
    const drawn = await page.evaluate(() => { const reactor = document.querySelector('#reactorBox').getBoundingClientRect(), bus = document.querySelector('#busBox').getBoundingClientRect(), station = document.querySelector('#stationBox').getBoundingClientRect(); return { l: Math.min(reactor.left, station.left), r: bus.right, b: station.bottom }; });
    assert.ok(drawn.l >= boxes.battery.r && drawn.r <= boxes.sync.l, 'the drawing sits between the panels');
    assert.ok(drawn.b <= boxes.advisory.t, 'the drawing ends above the advisory');
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.panel')].filter(panel => panel.scrollHeight > panel.clientHeight + 1).map(panel => panel.getAttribute('aria-label')));
    assert.deepEqual(clipped, [], 'no panel has content scrolled out of sight');
    for (const control of ['#rechargeBtn', '#busBtn', '#timeValue', '#chargeStage', '#surplus', '#menuBtn']) await expect(page.locator(control)).toBeInViewport({ ratio: 0.99 });
    const gauge = await page.locator('.level-gauge').evaluate(element => element.getBoundingClientRect().height);
    assert.ok(gauge > height * 0.15, `the level gauge stays tall (${gauge}px)`);
    await page.locator('[data-open="diagnosticsDialog"]').click();
    const fits = await page.evaluate(() => { const d = document.getElementById('diagnosticsDialog'), b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && d.scrollHeight <= d.clientHeight + 1; });
    assert.ok(fits, 'diagnostics fit without scrolling');
  };
run(cases);
