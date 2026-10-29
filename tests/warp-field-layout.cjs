// Warp Field Control fits any landscape window from an iPad to a 4K monitor: the panels, field, advisory and dock stay on
// screen and apart, the sliders stay tall, the map's labels do not cover each other, and the dialogs fit.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const sizes = [[1024, 768], [1180, 820], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const parts = { left: '.col.left .panel', right: '.col.right .panel', field: '#field', advisory: '#advisory', dock: '.dock', topbar: '.topbar' };

const cases = {};
for (const [width, height] of sizes)
  cases[`everything fits at ${width}×${height}`] = async ({ open }) => {
    const page = await open('/WarpField/');
    await page.setViewportSize({ width, height });
    // A busy map: six more ships at set places and headings, the field fitted round what it can reach.
    await page.evaluate(() => {
      const extra = [[20, 330, 140, 40], [110, 420, 90, 200], [160, 260, 60, 300], [250, 520, 220, 10], [300, 180, 50, 120], [350, 610, 120, 75]];
      WarpFieldControl.ships([...WarpFieldControl.state().ships, ...extra.map(([bearing, distance, length, heading], i) => ({ name: 'Escort ' + (i + 1), bearing, distance, length, heading }))]);
      document.getElementById('fitBtn').click();
    });
    await page.waitForTimeout(900);
    const boxes = await page.evaluate(selectors => Object.fromEntries(Object.entries(selectors).map(([name, selector]) => { const b = document.querySelector(selector).getBoundingClientRect(); return [name, { l: b.left, t: b.top, r: b.right, b: b.bottom }]; })), parts);
    for (const [name, b] of Object.entries(boxes)) assert.ok(b.l >= -0.5 && b.t >= -0.5 && b.r <= width + 0.5 && b.b <= height + 0.5, `${name} is inside the window`);
    const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const names = Object.keys(boxes);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(boxes[names[i]], boxes[names[j]]), `${names[i]} and ${names[j]} do not overlap`);
    for (const control of ['#extensionSlider', '#limitBar', '#helmMark em', '#coreBar', '#fitBtn', '#menuBtn', '#supplyReading', '#loadReading']) await expect(page.locator(control)).toBeInViewport({ ratio: 1 });
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.panel')].filter(panel => panel.scrollHeight > panel.clientHeight + 1).length);
    assert.equal(clipped, 0, 'no panel has content scrolled out of sight');
    const titles = await page.evaluate(() => [...document.querySelectorAll('.thead')].every(head => head.scrollWidth <= head.clientWidth + 1));
    assert.ok(titles, 'panel headings fit on one line');
    for (const slider of ['#extensionSlider', '#limitBar']) {
      const tall = await page.locator(slider).evaluate(element => element.getBoundingClientRect().height);
      assert.ok(tall > height * 0.25, `${slider} stays tall (${Math.round(tall)}px)`);
    }
    const clash = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('#labels text, #ships text')].map(t => t.getBoundingClientRect());
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) return [a, b].map(x => Math.round(x.top));
      }
      return false;
    });
    assert.ok(!clash, 'map labels do not overlap ' + JSON.stringify(clash));
    for (const dialog of ['shipsDialog', 'diagnosticsDialog']) {
      await page.evaluate(id => ConsoleUI.openDialog(id), dialog);
      const fits = await page.evaluate(id => { const d = document.getElementById(id); const b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && d.scrollHeight <= d.clientHeight + 1; }, dialog);
      assert.ok(fits, `${dialog} fits without scrolling`);
      await page.locator(`#${dialog} [data-close]`).first().click();
    }
  };
run(cases);
