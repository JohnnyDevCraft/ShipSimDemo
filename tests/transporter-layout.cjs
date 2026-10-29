// Transporter Control fits any landscape window from an iPad to a 4K monitor: the panels, schematic, advisory and
// dock stay on screen and apart, and the dialogs fit.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const sizes = [[1024, 768], [1180, 820], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const parts = { left: '.col.left .panel', right: '.col.right .panel', schematic: '#schematic', advisory: '#advisory', dock: '.dock', topbar: '.topbar' };

const cases = {};
for (const [width, height] of sizes)
  cases[`everything fits at ${width}×${height}`] = async ({ open }) => {
    const page = await open('/Transporter/');
    await page.setViewportSize({ width, height });
    // A busy console: a scanned location with targets selected and locking.
    await page.locator('#scan').click();
    for (const name of ['Lt. Mara Venn', 'Ens. Keon Pell', 'Dr. Ilyra Moss']) await page.locator('.target-item', { hasText: name }).click();
    await page.evaluate(() => TransporterControl.step(4));
    await page.waitForTimeout(150);
    const boxes = await page.evaluate(selectors => Object.fromEntries(Object.entries(selectors).map(([name, selector]) => { const b = document.querySelector(selector).getBoundingClientRect(); return [name, { l: b.left, t: b.top, r: b.right, b: b.bottom }]; })), parts);
    for (const [name, b] of Object.entries(boxes)) assert.ok(b.l >= -0.5 && b.t >= -0.5 && b.r <= width + 0.5 && b.b <= height + 0.5, `${name} is inside the window`);
    const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const names = Object.keys(boxes);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(boxes[names[i]], boxes[names[j]]), `${names[i]} and ${names[j]} do not overlap`);
    // The drawn ends of the route sit between the side panels.
    const drawn = await page.evaluate(() => { const a = document.querySelector('#sourceNode').getBoundingClientRect(), b = document.querySelector('#destinationNode').getBoundingClientRect(); return { l: a.left, r: b.right }; });
    assert.ok(drawn.l >= boxes.left.r && drawn.r <= boxes.right.l, 'source and destination sit between the panels');
    for (const control of ['#dematSlider', '#matSlider', '#scan', '#clearTransport', '#menuBtn', '#speedReading', '.target-item >> nth=2']) await expect(page.locator(control)).toBeInViewport({ ratio: 1 });
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.panel')].filter(panel => panel.scrollHeight > panel.clientHeight + 1).length);
    assert.equal(clipped, 0, 'no panel has content scrolled out of sight');
    const titles = await page.evaluate(() => [...document.querySelectorAll('.thead')].every(head => head.scrollWidth <= head.clientWidth + 1));
    assert.ok(titles, 'panel headings fit on one line');
    const sliderHeight = await page.locator('#dematSlider').evaluate(element => element.getBoundingClientRect().height);
    assert.ok(sliderHeight > height * 0.3, `levers stay tall (${sliderHeight}px)`);
    // The buffer's text fits inside its black box, whatever state it shows.
    const inside = await page.evaluate(() => {
      const box = document.querySelector('#buffer .s-backing').getBBox(), state = document.getElementById('bufferState'), saved = state.textContent;
      const fits = ['AWAITING PATTERNS', 'ACQUIRING PATTERNS', 'PATTERNS HELD', 'DELIVERING PATTERNS'].every(text => { state.textContent = text; const b = state.getBBox(); return b.x >= box.x + 4 && b.x + b.width <= box.x + box.width - 4; });
      state.textContent = saved;
      return fits;
    });
    assert.ok(inside, 'buffer state text fits its box');
    // Names and states are on separate lines in the lists under the source and destination.
    const rows = await page.evaluate(() => [...document.querySelectorAll('#manifest .m-row')].filter(row => row.style.display !== 'none').map(row => { const [n, s] = row.querySelectorAll('text'); const a = n.getBBox(), b = s.getBBox(); return a.y + a.height <= b.y + 1; }));
    assert.ok(rows.length && rows.every(Boolean), 'list names sit above their states');
    for (const dialog of ['destinationDialog', 'diagnosticsDialog', 'rangeDialog']) {
      await page.evaluate(id => ConsoleUI.openDialog(id), dialog);
      const fits = await page.evaluate(id => { const d = document.getElementById(id); const b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && d.scrollHeight <= d.clientHeight + 1; }, dialog);
      assert.ok(fits, `${dialog} fits without scrolling`);
      await page.locator(`#${dialog} [data-close]`).first().click();
    }
  };
run(cases);
