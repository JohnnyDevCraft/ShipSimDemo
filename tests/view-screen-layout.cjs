// View Screen fits any landscape window from an iPad to a 4K monitor: the top bar, the two side columns with
// both scanners, the advisory and the gauges stay on screen and apart, with a target selected; the scanners
// stay big enough to read; and the demo controls fit their dialog.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const sizes = [[1024, 768], [1180, 820], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const parts = { topbar: '.topbar', left: '.col.left', right: '.col.right', advisory: '#advisory', gauges: '#gauges' };
const box = (page, selector) => page.locator(selector).evaluate(element => { const b = element.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
const dialogFits = (page, id) => page.evaluate(dialogId => { const d = document.getElementById(dialogId), b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && d.scrollHeight <= d.clientHeight + 1; }, id);

const cases = {};
for (const [width, height] of sizes)
  cases[`everything fits at ${width}×${height}`] = async ({ open }) => {
    const page = await open('/ViewScreen/?models=0');
    await page.setViewportSize({ width, height });
    // The tallest left column: a target selected.
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    assert.ok(await dialogFits(page, 'menuDialog'), 'the demo controls fit');
    await page.locator('#demoTarget').selectOption('Sol|TNS Endeavor');
    await page.locator('#menuDialog [data-close]').last().click();
    await expect(page.locator('#targetPanel')).toBeVisible();
    await page.waitForTimeout(150);
    const boxes = {};
    for (const [name, selector] of Object.entries(parts)) boxes[name] = await box(page, selector);
    for (const [name, b] of Object.entries(boxes)) assert.ok(b.l >= -0.5 && b.t >= -0.5 && b.r <= width + 0.5 && b.b <= height + 0.5, `${name} is inside the window`);
    const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const names = Object.keys(boxes);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(boxes[names[i]], boxes[names[j]]), `${names[i]} and ${names[j]} do not overlap`);
    // No panel is clipped or pushed out of its column, and the scanners stay readable.
    const panels = await page.evaluate(() => [...document.querySelectorAll('.col .panel')].filter(p => !p.hidden).map(p => {
      const b = p.getBoundingClientRect(), col = p.parentElement.getBoundingClientRect();
      return { id: p.id, clipped: p.scrollHeight > p.clientHeight + 1, inside: b.top >= col.top - 0.5 && b.bottom <= col.bottom + 0.5 };
    }));
    for (const p of panels) {
      assert.ok(!p.clipped, `${p.id} is not clipped`);
      assert.ok(p.inside, `${p.id} stays in its column`);
    }
    // Every panel title clears its status chip.
    const heads = await page.evaluate(() => [...document.querySelectorAll('.col .thead')].filter(t => t.offsetParent).map(t => { const [a, b] = [...t.children].map(c => c.getBoundingClientRect()); return { name: t.firstElementChild.textContent, gap: b.left - a.right }; }));
    for (const head of heads) assert.ok(head.gap >= 4, `${head.name} clears its chip (${head.gap})`);
    const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    for (const id of ['#srs', '#lrs']) {
      const radar = await page.locator(id).boundingBox();
      assert.ok(Math.min(radar.width, radar.height) >= 11 * rem, `${id} is at least 11 rem across (${radar.width}×${radar.height})`);
    }
    // The gauges are whole inside their dock.
    const gauges = await page.evaluate(() => { const dock = document.getElementById('gauges').getBoundingClientRect(); return [...document.querySelectorAll('.gauge')].map(g => { const b = g.getBoundingClientRect(); return b.left >= dock.left - 0.5 && b.right <= dock.right + 0.5 && b.bottom <= dock.bottom + 0.5; }); });
    assert.deepEqual(gauges, [true, true, true, true]);
    for (const control of ['#state', '#targetName', '#destName', '#heading', '#menuBtn']) await expect(page.locator(control)).toBeInViewport({ ratio: 0.99 });
  };
run(cases);
