// Fighter Control fits any landscape window from an iPad to a 4K monitor: the panels, heading tape, advisory and dock
// stay on screen and apart, the stick stays big enough to fly with, nothing in a panel is cut off, and the dialogs fit.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const sizes = [[1024, 768], [1180, 820], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const parts = { flight: '.flight-panel', target: '#targetPanel', shields: '.defence-panel', weapons: '.arms-panel', tape: '#aimTape', advisory: '#advisory', dock: '.dock', topbar: '.topbar' };

const cases = {};
for (const [width, height] of sizes)
  cases[`everything fits at ${width}×${height}`] = async ({ open }) => {
    const page = await open('/Fighter/?models=0');
    await page.setViewportSize({ width, height });
    // Busy: engines lit, weapons and shields on, a target selected, drifting with a long advisory.
    await page.evaluate(() => {
      FighterControl.pause(true);
      document.getElementById('engineBtn').click();
      FighterControl.advance(90100);
      document.getElementById('weaponsCmd').click();
      document.getElementById('shieldsCmd').click();
      document.getElementById('nextTarget').click();
      FighterControl.set({ vx: 1800, vz: 900, heading: -40 });
      FighterControl.advance(300);
    });
    await page.waitForTimeout(400);
    const boxes = await page.evaluate(selectors => Object.fromEntries(Object.entries(selectors).map(([name, selector]) => { const b = document.querySelector(selector).getBoundingClientRect(); return [name, { l: b.left, t: b.top, r: b.right, b: b.bottom }]; })), parts);
    for (const [name, b] of Object.entries(boxes)) assert.ok(b.l >= -0.5 && b.t >= -0.5 && b.r <= width + 0.5 && b.b <= height + 0.5, `${name} is inside the window`);
    const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const names = Object.keys(boxes);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(boxes[names[i]], boxes[names[j]]), `${names[i]} and ${names[j]} do not overlap`);
    for (const control of ['#enginesBtn', '#shieldsCmd', '#weaponsCmd', '#ownShields', '#flightStick', '#thrustBtn', '#stopBtn', '#fireBtn', '#torpedoBtn', '#shotPower', '#torpedoState', '#srs', '#srsZoom', '#menuBtn', '#state'])
      await expect(page.locator(control)).toBeInViewport({ ratio: 1 });
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.panel')].filter(panel => !panel.hidden && panel.scrollHeight > panel.clientHeight + 1).map(panel => panel.className));
    assert.deepEqual(clipped, [], 'no panel has content cut off');
    const lines = await page.evaluate(() => [...document.querySelectorAll('.thead, .meter > div:first-child, #torpedoBtn small, #fireBtn small, .srs-zoom, .qchips span, .stick-readout, .flight-stats b')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent));
    assert.deepEqual(lines, [], 'headings and readouts fit on one line');
    const size = await page.locator('#flightStick').evaluate(element => element.getBoundingClientRect().width);
    assert.ok(size >= 110, `the stick is big enough to fly with (${Math.round(size)}px)`);
    const scan = await page.locator('#srs').evaluate(element => Math.min(element.getBoundingClientRect().width, element.getBoundingClientRect().height));
    assert.ok(scan >= height * 0.2, `the short-range scan is big enough to read (${Math.round(scan)}px)`);
    const barClear = await page.evaluate(() => document.getElementById('chargeBarWrap').getBoundingClientRect().top >= document.getElementById('chargeValue').getBoundingClientRect().bottom);
    assert.ok(barClear, 'the cannon\'s charge bar sits below its text');
    const advisoryLines = await page.locator('#advisory').evaluate(element => Math.round(element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight)));
    assert.ok(advisoryLines <= 2, 'the advisory takes at most two lines');
    for (const dialog of ['enginesDialog', 'diagnosticsDialog']) {
      await page.evaluate(id => ConsoleUI.openDialog(id), dialog);
      const fits = await page.evaluate(id => { const d = document.getElementById(id); const b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && d.scrollHeight <= d.clientHeight + 1; }, dialog);
      assert.ok(fits, `${dialog} fits without scrolling`);
      await page.locator(`#${dialog} [data-close]`).first().click();
    }
    // The key bindings fit too, their list scrolling inside the menu if it must.
    await page.locator('#menuBtn').click();
    await page.locator('#openControls').click();
    const menuFits = await page.evaluate(() => { const d = document.getElementById('menuDialog'), b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && d.scrollHeight <= d.clientHeight + 1; });
    assert.ok(menuFits, 'the key bindings fit without the menu scrolling');
    const rowsFit = await page.evaluate(() => [...document.querySelectorAll('.binding')].every(row => row.scrollWidth <= row.clientWidth + 1));
    assert.ok(rowsFit, 'each binding fits on its line');
  };
run(cases);
