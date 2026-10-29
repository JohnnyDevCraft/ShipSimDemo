// DOT Bay Control fits any landscape window from an iPad to a 4K monitor: the top bar, the bay and DOT panels, the
// components list, the schematic, the advisory and the bottom bar stay on screen and apart, nothing spills out of a
// panel, all twelve components show, and the dialogs fit.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const sizes = [[1024, 768], [1180, 820], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const parts = { topbar: '.topbar', left: '.col.left', right: '.col.right', schematic: '#schematic', advisory: '#advisory', dock: '.dock' };
const box = (page, selector) => page.locator(selector).evaluate(element => { const b = element.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
const dialogFits = (page, id) => page.evaluate(dialogId => { const d = document.getElementById(dialogId), b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && d.scrollHeight <= d.clientHeight + 1; }, id);

const cases = {};
for (const [width, height] of sizes)
  cases[`everything fits at ${width}×${height}`] = async ({ open }) => {
    const page = await open('/DotBay/');
    await page.setViewportSize({ width, height });
    // Busy: DOTs on two components.
    await page.evaluate(() => {
      document.getElementById('assignBtn').click();
      document.querySelector('[data-component="warp"]').click();
      document.getElementById('cradle1').dispatchEvent(new Event('click'));
      document.getElementById('assignBtn').click();
      document.querySelector('[data-component="warp"]').click();
      DotBay.step(12);
    });
    await page.waitForTimeout(150);
    const boxes = {};
    for (const [name, selector] of Object.entries(parts)) boxes[name] = await box(page, selector);
    for (const [name, b] of Object.entries(boxes)) assert.ok(b.l >= -0.5 && b.t >= -0.5 && b.r <= width + 0.5 && b.b <= height + 0.5, `${name} is inside the window`);
    const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const names = Object.keys(boxes);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(boxes[names[i]], boxes[names[j]]), `${names[i]} and ${names[j]} do not overlap`);
    const spill = await page.evaluate(() => [...document.querySelectorAll('.col .panel')].flatMap(panel => {
      const p = panel.getBoundingClientRect();
      return [...panel.querySelectorAll('*')].filter(e => e.getClientRects().length).filter(e => { const b = e.getBoundingClientRect(); return b.right > p.right + 0.5 || b.left < p.left - 0.5 || b.bottom > p.bottom + 0.5; }).map(e => `${panel.className} > ${e.tagName} ${e.textContent.slice(0, 30)}`);
    }));
    assert.deepEqual(spill, [], 'everything stays inside its panel');
    const list = await page.locator('#componentList').evaluate(l => ({ clipped: l.scrollHeight > l.clientHeight + 1, rows: l.children.length }));
    assert.ok(!list.clipped && list.rows === 12, 'all twelve components show');
    const heads = await page.evaluate(() => [...document.querySelectorAll('.col .thead, .ghead')].filter(t => t.offsetParent).map(t => { const [a, b] = [...t.children].map(c => c.getBoundingClientRect()); return { name: t.firstElementChild.textContent, gap: b.left - a.right }; }));
    for (const head of heads) assert.ok(head.gap >= 4, `${head.name} clears its value (${head.gap})`);
    for (const control of ['#cradle0', '#cradle3', '#powerValue', '#dotBattery', '#assignBtn', '#menuBtn']) await expect(page.locator(control)).toBeInViewport({ ratio: 0.99 });
    for (const [button, dialog] of [['#assignBtn', 'assignDialog'], ['#diagnosticsBtn', 'diagnosticsDialog']]) {
      await page.locator(button).click();
      assert.ok(await dialogFits(page, dialog), `${dialog} fits`);
      await page.locator(`#${dialog} [data-close]`).click();
    }
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    assert.ok(await dialogFits(page, 'menuDialog'), 'the demo controls fit');
  };
run(cases);
