// Torpedo Assembly Control fits any landscape window from an iPad to a 4K monitor: the panels, stage, advisory
// and dock stay on screen and apart, the gallery and every configuration page fit the stage, and the dialogs fit.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const sizes = [[1024, 768], [1180, 820], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const parts = { magazine: '.magazine', bay: '.bay', rack: '.rack', stage: '#stage', advisory: '#advisory', dock: '.dock', topbar: '.topbar' };
const box = (page, selector) => page.locator(selector).evaluate(element => { const b = element.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
const inside = (inner, outer) => inner.l >= outer.l - 0.5 && inner.t >= outer.t - 0.5 && inner.r <= outer.r + 0.5 && inner.b <= outer.b + 0.5;

// Every visible part of the shown configuration page lies inside the stage.
async function pageFits(page, label) {
  await page.waitForTimeout(650);
  const stage = await box(page, '#stage');
  const outside = await page.evaluate(({ l, t, r, b }) =>
    [...document.querySelectorAll('#configPage .config-head, #configPage .preview, #configPage .form:not([hidden]) :is(.cgroup, .cfield, .switch, .seg, .readout, .vslider, .mnote)')]
      .filter(element => element.offsetParent !== null)
      .map(element => [element, element.getBoundingClientRect()])
      .filter(([, box]) => box.left < l - 0.5 || box.top < t - 0.5 || box.right > r + 0.5 || box.bottom > b + 0.5)
      .map(([element]) => element.className || element.tagName), stage);
  assert.deepEqual(outside, [], `${label}: everything on the page is inside the stage`);
}

const cases = {};
for (const [width, height] of sizes)
  cases[`everything fits at ${width}×${height}`] = async ({ open }) => {
    const page = await open('/TorpedoAssembly/');
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    const boxes = {};
    for (const [name, selector] of Object.entries(parts)) boxes[name] = await box(page, selector);
    for (const [name, b] of Object.entries(boxes)) assert.ok(b.l >= -0.5 && b.t >= -0.5 && b.r <= width + 0.5 && b.b <= height + 0.5, `${name} is inside the window`);
    const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const names = Object.keys(boxes);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(boxes[names[i]], boxes[names[j]]), `${names[i]} and ${names[j]} do not overlap`);
    // Gallery: the hull, the head on it, both info cards and the turn buttons are inside the stage.
    for (const selector of ['#hullArt', '.head-slide[data-pos="0"]', '.head-info', '.config-info', '#configureHead', '#prevHead', '#nextHead'])
      assert.ok(inside(await box(page, selector), boxes.stage), `${selector} is inside the stage`);
    const hull = await box(page, '#hullArt');
    assert.ok(hull.b - hull.t > (boxes.stage.b - boxes.stage.t) * 0.4, 'the hull is the centre of the gallery');
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.panel, .info')].filter(panel => panel.scrollHeight > panel.clientHeight + 1).map(panel => panel.className));
    assert.deepEqual(clipped, [], 'no panel or card has content scrolled out of sight');
    for (const control of ['#assembleBtn', '#configureBtn', '.dock [data-type="Beacon"]', '#menuBtn', '#cycleTime']) await expect(page.locator(control)).toBeInViewport({ ratio: 1 });
    // The rack list clips to whole pixels in WebKit, which can shave a fraction of a pixel off a slot's side.
    await expect(page.locator('.rack-list > .slot:last-child')).toBeInViewport({ ratio: 0.99 });
    // Each configuration page, with every option open.
    await page.locator('#configureBtn').click();
    await pageFits(page, 'warhead');
    await page.locator('[data-seg="warhead.trigger"] [data-val="Proximity"]').click();
    await pageFits(page, 'warhead with proximity');
    await page.locator('.dock [data-type="Probe"]').click();
    await page.locator('[data-check="probe.warpEnabled"]').check({ force: true });
    await page.locator('[data-check="probe.selfDestructEnabled"]').check({ force: true });
    await pageFits(page, 'probe with warp and self-destruct');
    await page.locator('.dock [data-type="Beacon"]').click();
    await pageFits(page, 'warning beacon');
    await page.locator('[data-seg="beacon.kind"] [data-val="Comms"]').click();
    await pageFits(page, 'comms relay');
    // Dialogs
    await page.locator('#assembleBtn').click();
    await page.evaluate(() => TorpedoAssembly.advance(30000));
    await page.locator('.slot.ready').click();
    const detailsFit = await page.evaluate(() => { const d = document.getElementById('detailsDialog'), b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && d.scrollHeight <= d.clientHeight + 1; });
    assert.ok(detailsFit, 'the details overlay fits without scrolling');
    await page.locator('#detailsDialog [data-close]').click();
    // Assembling turned the stage back to the gallery.
    await expect(page.locator('#track')).toHaveAttribute('data-page', 'gallery');
    await page.locator('#configureBtn').click();
    await page.locator('[data-seg="beacon.kind"] [data-val="Warning"]').click();
    await page.locator('#messageField').click();
    const messageFits = await page.evaluate(() => { const d = document.getElementById('messageDialog'), b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && d.scrollHeight <= d.clientHeight + 1; });
    assert.ok(messageFits, 'the message keyboard fits without scrolling');
  };
run(cases);
