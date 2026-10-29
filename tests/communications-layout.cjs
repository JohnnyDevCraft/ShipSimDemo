// Communications Control fits any landscape window from an iPad to a 4K monitor: the map covers the window, the
// panels, advisory and dock stay on screen and apart, and every overlay fits.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const sizes = [[1024, 768], [1180, 820], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const parts = { detections: '.detections', signal: '#signalPanel', range: '.range-panel', advisory: '#advisory', dock: '.dock', topbar: '.topbar' };
const box = (page, selector) => page.locator(selector).evaluate(element => { const b = element.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
const dialogFits = (page, id) => page.evaluate(dialogId => { const d = document.getElementById(dialogId), b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth && d.scrollHeight <= d.clientHeight + 1; }, id);

const cases = {};
for (const [width, height] of sizes)
  cases[`everything fits at ${width}×${height}`] = async ({ open }) => {
    const page = await open('/Communications/');
    await page.setViewportSize({ width, height });
    // The most crowded selection: an encrypted point-to-point transmission.
    await page.locator('#transmissions .tx', { hasText: 'Space Command' }).click();
    await page.waitForTimeout(200);
    const map = await box(page, '#map');
    assert.deepEqual([map.l, map.t, map.r, map.b], [0, 0, width, height], 'the map covers the window');
    const boxes = {};
    for (const [name, selector] of Object.entries(parts)) boxes[name] = await box(page, selector);
    for (const [name, b] of Object.entries(boxes)) assert.ok(b.l >= -0.5 && b.t >= -0.5 && b.r <= width + 0.5 && b.b <= height + 0.5, `${name} is inside the window`);
    const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const names = Object.keys(boxes);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(boxes[names[i]], boxes[names[j]]), `${names[i]} and ${names[j]} do not overlap`);
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.panel')].filter(panel => panel.scrollHeight > panel.clientHeight + 1).map(panel => panel.className));
    assert.deepEqual(clipped, [], 'no panel has content scrolled out of sight');
    for (const control of ['#contactBtn', '#sigContent', '#rangeNote', '#frequenciesBtn', '#ourShipBtn', '#menuBtn']) await expect(page.locator(control)).toBeInViewport({ ratio: 0.99 });
    const slider = await page.locator('#rangeSlider').evaluate(element => element.getBoundingClientRect().height);
    assert.ok(slider > height * 0.12, `the range slider stays usable (${slider}px)`);
    // Overlays
    await page.locator('#frequenciesBtn').click();
    assert.ok(await dialogFits(page, 'frequencyDialog'), 'standard frequencies fit');
    await page.locator('#frequencySearch').click();
    await expect(page.locator('#frequencyDialog .search-keys')).toBeVisible();
    await expect(page.locator('#frequencyDialog .search-keys [data-key="DONE"]')).toBeInViewport({ ratio: 1 });
    await page.locator('#frequencyDialog .search-keys [data-key="DONE"]').click();
    await page.locator('#frequencyDialog [data-close]').click();
    await page.locator('#contactBtn').click();
    await page.locator('#saveComm').click();
    assert.ok(await dialogFits(page, 'commsDialog'), 'communications fit');
    await page.locator('#messageInput').click();
    await expect(page.locator('#commChat .search-keys [data-key="DONE"]')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#sendMessage')).toBeInViewport({ ratio: 1 });
    await page.locator('#commChat .search-keys [data-key="DONE"]').click();
    await page.locator('#commsDialog [data-close]').click();
    for (const [button, dialog] of [['#contactSettingsBtn', 'contactDialog'], ['#viewScreenBtn', 'viewScreenDialog']]) {
      await page.locator(button).click();
      assert.ok(await dialogFits(page, dialog), `${dialog} fits`);
      await page.locator(`#${dialog} [data-close]`).click();
    }
  };
run(cases);
