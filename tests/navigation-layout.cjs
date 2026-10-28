// Navigation Control fits any window from an iPad (portrait or landscape) to a 4K monitor: every control is
// on screen and no panel covers another.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const sizes = [[768, 1024], [1024, 768], [1024, 690], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const panels = { target: '#mapTarget', destination: '#ownDestination', range: '.range', dock: '.dock' };
const topBar = { brand: '.brand', scan: '.scan', clock: '.topright' };

const cases = {};
for (const [width, height] of sizes)
  cases[`everything fits at ${width}×${height}`] = async ({ open }) => {
    const page = await open('/Navigation/');
    await page.setViewportSize({ width, height });
    // Fill every panel: Plot For Jupiter, a course from it to Mars (so the read-out shows), and Mars targeted.
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('#calcSeconds [data-seconds="0"]').click();
    await page.locator('#menuDialog [data-close]').click();
    for (const key of ['Sol|Jupiter', 'Sol|Mars']) {
      await page.locator('.dock [data-open="knownDialog"]').click();
      await page.locator(`#knownList [data-key="${key}"]`).click();
      await page.locator(key === 'Sol|Jupiter' ? '#plotForBtn' : '#setOwn').click();
    }
    await expect(page.locator('#readout')).not.toBeEmpty();
    await page.waitForTimeout(200);
    const boxes = await page.evaluate(([panelSelectors, barSelectors]) => {
      const box = selector => { const b = document.querySelector(selector).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      return { panels: Object.fromEntries(Object.entries(panelSelectors).map(([name, selector]) => [name, box(selector)])), bar: Object.fromEntries(Object.entries(barSelectors).map(([name, selector]) => [name, box(selector)])) };
    }, [panels, topBar]);
    for (const [name, b] of Object.entries({ ...boxes.panels, ...boxes.bar })) assert.ok(b.l >= 0 && b.t >= 0 && b.r <= width + 0.5 && b.b <= height + 0.5, `${name} is inside the window`);
    const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const names = Object.keys(boxes.panels);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(boxes.panels[names[i]], boxes.panels[names[j]]), `${names[i]} and ${names[j]} do not overlap`);
    const bar = Object.values(boxes.bar);
    for (let i = 0; i < bar.length; i++) for (let j = i + 1; j < bar.length; j++) assert.ok(bar[i].r <= bar[j].l + 0.5 || bar[j].r <= bar[i].l + 0.5, 'top bar items sit side by side');
    for (const control of ['#setOwn', '#clearOwn', '#plotForClear', '#plottedClear', '#plotForBtn', '#rangeSlider', '#systemBtn', '#menuBtn', '#centerShip', '.dock [data-open="rangeDialog"]']) await expect(page.locator(control)).toBeInViewport({ ratio: 1 });
    // Nothing is hidden inside a panel either.
    const clipped = await page.evaluate(selectors => selectors.filter(selector => { const panel = document.querySelector(selector); return panel.scrollHeight > panel.clientHeight + 1; }), Object.values(panels));
    assert.deepEqual(clipped, [], 'no panel has content scrolled out of sight');
    // The in-app search keyboard fits inside both list dialogs.
    for (const [dialog, search] of [['systemDialog', '#systemSearch'], ['knownDialog', '#knownSearch']]) {
      await page.evaluate(id => ConsoleUI.openDialog(id), dialog);
      await page.locator(search).click();
      const fits = await page.evaluate(id => {
        const box = document.getElementById(id).getBoundingClientRect();
        return [...document.querySelectorAll(`#${id} .search-keys button`)].every(key => { const b = key.getBoundingClientRect(); return b.width > 0 && b.left >= box.left && b.right <= box.right && b.top >= box.top && b.bottom <= box.bottom && b.bottom <= innerHeight; });
      }, dialog);
      assert.ok(fits, `the ${dialog} keyboard fits`);
      await page.locator(`#${dialog} [data-close]`).click();
    }
    const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    assert.ok(rem >= 9 && rem <= 46, `root size ${rem}px`);
  };
run(cases);
