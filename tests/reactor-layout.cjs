// Reactor Control fits any landscape window from an iPad to a 4K monitor: the panels, schematic, advisory and
// dock stay on screen and apart, and the dialogs fit.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const sizes = [[1024, 768], [1180, 820], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const parts = { left: '.col.left .panel', right: '.col.right .panel', schematic: '#schematic', advisory: '#advisory', dock: '.dock', topbar: '.topbar' };

const cases = {};
for (const [width, height] of sizes)
  cases[`everything fits at ${width}×${height}`] = async ({ open }) => {
    const page = await open('/Reactor/');
    await page.setViewportSize({ width, height });
    await page.evaluate(() => ReactorControl.setDamage(45));
    await page.waitForTimeout(250);
    const boxes = await page.evaluate(selectors => Object.fromEntries(Object.entries(selectors).map(([name, selector]) => { const b = document.querySelector(selector).getBoundingClientRect(); return [name, { l: b.left, t: b.top, r: b.right, b: b.bottom }]; })), parts);
    for (const [name, b] of Object.entries(boxes)) assert.ok(b.l >= -0.5 && b.t >= -0.5 && b.r <= width + 0.5 && b.b <= height + 0.5, `${name} is inside the window`);
    const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const names = Object.keys(boxes);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(boxes[names[i]], boxes[names[j]]), `${names[i]} and ${names[j]} do not overlap`);
    // The drawn schematic (not just its box) stays clear of the side panels.
    const drawn = await page.evaluate(() => { const b = document.querySelector('#schematic > g#gauges').getBoundingClientRect(), bus = document.querySelector('#bus').getBoundingClientRect(), tank = document.querySelector('#tank').getBoundingClientRect(); return { l: tank.left, r: bus.right, t: b.top }; });
    assert.ok(drawn.l >= boxes.left.r && drawn.r <= boxes.right.l, 'tank and bus sit between the panels');
    for (const control of ['#flowSlider', '#beamSlider', '#angleSlider', '#coolantSlider', '#start', '#eject', '#menuBtn', '#pumpPower', '#beamSource']) await expect(page.locator(control)).toBeInViewport({ ratio: 1 });
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.panel')].filter(panel => panel.scrollHeight > panel.clientHeight + 1).length);
    assert.equal(clipped, 0, 'no panel has content scrolled out of sight');
    const sliderHeight = await page.locator('#flowSlider').evaluate(element => element.getBoundingClientRect().height);
    assert.ok(sliderHeight > height * 0.3, `sliders stay tall (${sliderHeight}px)`);
    for (const dialog of ['maintenanceDialog', 'diagnosticsDialog']) {
      await page.evaluate(id => ConsoleUI.openDialog(id), dialog);
      const fits = await page.evaluate(id => { const d = document.getElementById(id); const b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && d.scrollHeight <= d.clientHeight + 1; }, dialog);
      assert.ok(fits, `${dialog} fits without scrolling`);
      await page.locator(`#${dialog} [data-close]`).first().click();
    }
  };
run(cases);
