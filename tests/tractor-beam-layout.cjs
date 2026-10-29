// Tractor Beam Control fits any landscape window from an iPad to a 4K monitor: the panels, aim tape, advisory and
// dock stay on screen and apart, both joysticks stay a usable size, and the dialogs fit.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const sizes = [[1024, 768], [1180, 820], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const parts = { emitter: '.emitter-panel', position: '#leftCol .stick-panel', target: '#targetPanel', plot: '.plot-panel', heading: '.heading-panel', tape: '#aimTape', advisory: '#advisory', dock: '.dock', topbar: '.topbar' };

const cases = {};
for (const [width, height] of sizes)
  cases[`everything fits at ${width}×${height}`] = async ({ open }) => {
    const page = await open('/TractorBeam/?models=0');
    await page.setViewportSize({ width, height });
    // Holding a ship, with a long advisory.
    await page.evaluate(() => { TractorControl.pause(true); TractorControl.aimAt(12); document.getElementById('engageBtn').click(); });
    await page.waitForTimeout(200);
    const boxes = await page.evaluate(selectors => Object.fromEntries(Object.entries(selectors).map(([name, selector]) => { const b = document.querySelector(selector).getBoundingClientRect(); return [name, { l: b.left, t: b.top, r: b.right, b: b.bottom }]; })), parts);
    for (const [name, b] of Object.entries(boxes)) assert.ok(b.l >= -0.5 && b.t >= -0.5 && b.r <= width + 0.5 && b.b <= height + 0.5, `${name} is inside the window`);
    const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const names = Object.keys(boxes);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(boxes[names[i]], boxes[names[j]]), `${names[i]} and ${names[j]} do not overlap`);
    for (const control of ['#positionStick', '#headingStick', '#engageBtn', '#releaseBtn', '#menuBtn', '#turnReading', '#targetWarp', '#plot']) await expect(page.locator(control)).toBeInViewport({ ratio: 1 });
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.panel')].filter(panel => panel.scrollHeight > panel.clientHeight + 1).length);
    assert.equal(clipped, 0, 'no panel has content scrolled out of sight');
    const titles = await page.evaluate(() => [...document.querySelectorAll('.thead')].every(head => head.scrollWidth <= head.clientWidth + 1));
    assert.ok(titles, 'panel headings fit on one line');
    const stick = await page.locator('#positionStick').evaluate(el => el.getBoundingClientRect());
    assert.ok(stick.width >= height * 0.15 && Math.abs(stick.width - stick.height) < 1, `the Position stick is round and big enough (${Math.round(stick.width)}px)`);
    const heading = await page.locator('#headingStick').evaluate(el => el.getBoundingClientRect());
    assert.ok(heading.width >= height * 0.15, `the Heading stick is wide enough (${Math.round(heading.width)}px)`);
    const plot = await page.locator('#plot').evaluate(el => el.getBoundingClientRect());
    assert.ok(Math.min(plot.width, plot.height) >= height * 0.12, `the plot is big enough (${Math.round(Math.min(plot.width, plot.height))}px)`);
    for (const dialog of ['diagnosticsDialog']) {
      await page.evaluate(id => ConsoleUI.openDialog(id), dialog);
      const fits = await page.evaluate(id => { const d = document.getElementById(id); const b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && d.scrollHeight <= d.clientHeight + 1; }, dialog);
      assert.ok(fits, `${dialog} fits without scrolling`);
      await page.locator(`#${dialog} [data-close]`).first().click();
    }
  };
run(cases);
