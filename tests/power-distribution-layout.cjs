// Power Distribution fits any landscape window from an iPad to a 4K monitor: the hull bus panel, the fourteen
// subsystem cards, the advisory and the bottom bar stay on screen and apart, and the overlays fit.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const sizes = [[1024, 768], [1180, 820], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const parts = { thermal: '#thermalPanel', subsystems: '.subsystems-wrap', advisory: '#advisory', dock: '.dock', topbar: '.topbar' };
const box = (page, selector) => page.locator(selector).evaluate(element => { const b = element.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
const dialogFits = (page, id) => page.evaluate(dialogId => { const d = document.getElementById(dialogId), b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && d.scrollHeight <= d.clientHeight + 1; }, id);

const cases = {};
for (const [width, height] of sizes)
  cases[`everything fits at ${width}×${height}`] = async ({ open }) => {
    const page = await open('/PowerDistribution/');
    await page.setViewportSize({ width, height });
    await page.locator('#weaponsBtn').click();
    await page.waitForTimeout(200);
    const boxes = {};
    for (const [name, selector] of Object.entries(parts)) boxes[name] = await box(page, selector);
    for (const [name, b] of Object.entries(boxes)) assert.ok(b.l >= -0.5 && b.t >= -0.5 && b.r <= width + 0.5 && b.b <= height + 0.5, `${name} is inside the window`);
    const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const names = Object.keys(boxes);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(boxes[names[i]], boxes[names[j]]), `${names[i]} and ${names[j]} do not overlap`);
    // Every card is whole and inside the subsystem area, with its name and both dials readable.
    const cards = await page.evaluate(({ l, t, r, b }) => [...document.querySelectorAll('.subsystem')].map(card => {
      const box = card.getBoundingClientRect(), dials = [...card.querySelectorAll('.dial')].map(d => d.getBoundingClientRect());
      return { inside: box.left >= l - 0.5 && box.top >= t - 0.5 && box.right <= r + 0.5 && box.bottom <= b + 0.5, clipped: card.scrollHeight > card.clientHeight + 1, dials: dials.every(d => d.width >= 30 && d.bottom <= box.bottom + 0.5) };
    }), boxes.subsystems);
    assert.equal(cards.length, 14);
    cards.forEach((c, i) => {
      assert.ok(c.inside, `card ${i} is inside the subsystem area`);
      assert.ok(!c.clipped, `card ${i} is not clipped`);
      assert.ok(c.dials, `card ${i} shows both dials`);
    });
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.panel')].filter(panel => panel.scrollHeight > panel.clientHeight + 1).length);
    assert.equal(clipped, 0, 'the hull bus panel is not clipped');
    for (const control of ['#busTemperature', '#thermalStatus', '#busLoad', '#gaugesBtn', '#allOffBtn', '#menuBtn']) await expect(page.locator(control)).toBeInViewport({ ratio: 0.99 });
    await page.locator('.subsystem').nth(1).click();
    assert.ok(await dialogFits(page, 'subsystemDialog'), 'the subsystem overlay fits');
    await page.locator('#subsystemDialog [data-close]').click();
    await page.locator('#gaugesBtn').click();
    assert.ok(await dialogFits(page, 'gaugesDialog'), 'the gauges overlay fits');
  };
run(cases);
