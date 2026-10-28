// Helm Control fits any window from an iPad (portrait or landscape) to a 4K monitor: every control is on
// screen and no panel covers another.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const sizes = [[768, 1024], [1024, 768], [1024, 690], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const panels = { propulsion: '.propulsion', heading: '.heading', target: '#target', range: '.range', dock: '.dock' };
const topBar = { brand: '.brand', scan: '.scan', clock: '.topright' };

const cases = {};
for (const [width, height] of sizes)
  cases[`everything fits at ${width}×${height}`] = async ({ open }) => {
    const page = await open('/Helm/');
    await page.setViewportSize({ width, height });
    for (const drive of ['#impulseTab', '#warpTab']) {
      await page.locator(drive).click();
      await page.waitForTimeout(150);
      const boxes = await page.evaluate(([panelSelectors, barSelectors]) => {
        const box = selector => { const b = document.querySelector(selector).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
        return { panels: Object.fromEntries(Object.entries(panelSelectors).map(([name, selector]) => [name, box(selector)])), bar: Object.fromEntries(Object.entries(barSelectors).map(([name, selector]) => [name, box(selector)])) };
      }, [panels, topBar]);
      const all = { ...boxes.panels, ...boxes.bar };
      for (const [name, b] of Object.entries(all)) assert.ok(b.l >= 0 && b.t >= 0 && b.r <= width + 0.5 && b.b <= height + 0.5, `${name} is inside the window`);
      const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
      const names = Object.keys(boxes.panels);
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(boxes.panels[names[i]], boxes.panels[names[j]]), `${names[i]} and ${names[j]} do not overlap`);
      const bar = Object.values(boxes.bar);
      for (let i = 0; i < bar.length; i++) for (let j = i + 1; j < bar.length; j++) assert.ok(bar[i].r <= bar[j].l + 0.5 || bar[j].r <= bar[i].l + 0.5, 'top bar items sit side by side');
    }
    for (const control of ['#engage', '#chargeBtn', '#warp', '#joystick', '#alignBtn', '#rangeSlider', '#menuBtn', '.dock [data-open="rangeDialog"]', '#reverse', '#light', '#hard', '#stop']) await expect(page.locator(control)).toBeInViewport({ ratio: 1 });
    // Text scales with the window.
    const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    assert.ok(rem >= 9 && rem <= 46, `root size ${rem}px`);
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await expect(page.locator('#resetDemo')).toBeVisible();
  };
run(cases);
