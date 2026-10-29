// Shield System Control fits any landscape window from an iPad to a 4K monitor: the panels, envelope, advisory and
// dock stay on screen and apart, the facing sliders stay tall, and the dialogs fit.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const sizes = [[1024, 768], [1180, 820], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const parts = { left: '.col.left .panel', right: '.col.right .panel', envelope: '#envelope', advisory: '#advisory', dock: '.dock', topbar: '.topbar' };

const cases = {};
for (const [width, height] of sizes)
  cases[`everything fits at ${width}×${height}`] = async ({ open }) => {
    const page = await open('/Shields/');
    await page.setViewportSize({ width, height });
    // A busy console: six nearby ships and six enemies.
    await page.evaluate(() => { ShieldControl.pause(true); for (let i = 0; i < 6; i++) { document.getElementById('addShip').click(); document.getElementById('addEnemy').click(); } ShieldControl.configure({ extension: 150 }); });
    await page.waitForTimeout(600);
    const boxes = await page.evaluate(selectors => Object.fromEntries(Object.entries(selectors).map(([name, selector]) => { const b = document.querySelector(selector).getBoundingClientRect(); return [name, { l: b.left, t: b.top, r: b.right, b: b.bottom }]; })), parts);
    for (const [name, b] of Object.entries(boxes)) assert.ok(b.l >= -0.5 && b.t >= -0.5 && b.r <= width + 0.5 && b.b <= height + 0.5, `${name} is inside the window`);
    const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const names = Object.keys(boxes);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(boxes[names[i]], boxes[names[j]]), `${names[i]} and ${names[j]} do not overlap`);
    for (const control of ['#extensionSlider', '.facing-slider >> nth=3', '#shieldToggle', '#menuBtn', '#integrityReading', '#facingRows tr >> nth=3', '#recoveryNote']) await expect(page.locator(control)).toBeInViewport({ ratio: 1 });
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.panel')].filter(panel => panel.scrollHeight > panel.clientHeight + 1).length);
    assert.equal(clipped, 0, 'no panel has content scrolled out of sight');
    const titles = await page.evaluate(() => [...document.querySelectorAll('.thead')].every(head => head.scrollWidth <= head.clientWidth + 1));
    assert.ok(titles, 'panel headings fit on one line');
    for (const slider of ['#extensionSlider', '.facing-slider >> nth=0']) {
      const tall = await page.locator(slider).evaluate(element => element.getBoundingClientRect().height);
      assert.ok(tall > height * 0.25, `${slider} stays tall (${tall}px)`);
    }
    // Facing labels and ship labels on the envelope do not cover each other.
    const clash = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('#labels text, #ships text, #enemies text')].map(t => t.getBoundingClientRect());
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) return true;
      }
      return false;
    });
    assert.ok(!clash, 'map labels do not overlap');
    for (const dialog of ['coverageDialog', 'diagnosticsDialog']) {
      await page.evaluate(id => ConsoleUI.openDialog(id), dialog);
      const fits = await page.evaluate(id => { const d = document.getElementById(id); const b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && d.scrollHeight <= d.clientHeight + 1; }, dialog);
      assert.ok(fits, `${dialog} fits without scrolling`);
      await page.locator(`#${dialog} [data-close]`).first().click();
    }
  };
run(cases);
