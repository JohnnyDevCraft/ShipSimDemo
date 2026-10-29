// EPW and EBW Control fit any landscape window from an iPad to a 4K monitor: the scope covers the window, the
// panels, aim tape, advisory and dock stay on screen and apart, the reticle sits in the middle of the clear space,
// the weapon panel's charge gauges stay usable, and the history fits.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const sizes = [[1024, 768], [1180, 820], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const pages = { EPW: '/PhaseCannon/?models=0', EBW: '/PhaserArray/?models=0' };
const parts = { weapon: '.weapon-panel', target: '#targetPanel', zoom: '.zoom-panel', tape: '#aimTape', advisory: '#advisory', dock: '.dock', topbar: '.topbar' };
const box = (page, selector) => page.locator(selector).evaluate(element => { const b = element.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });

const cases = {};
for (const [name, url] of Object.entries(pages))
  for (const [width, height] of sizes)
    cases[`${name}: everything fits at ${width}×${height}`] = async ({ open }) => {
      const page = await open(url);
      await page.setViewportSize({ width, height });
      await page.locator('#menuBtn').click();
      await page.locator('#openDemoControls').click();
      await page.locator('#moveShips').click();
      await page.locator('#menuDialog [data-close]').last().click();
      await page.evaluate(() => EnergyWeapon.set({ contacts: [{ bearing: 2, range: 6000, yaw: 90 }] }));
      const point = await page.evaluate(() => EnergyWeapon.tapPoint('ship:Training ship A'));
      await page.mouse.click(point.x, point.y);
      await expect(page.locator('#targetPanel')).toBeVisible();
      await page.waitForTimeout(150);
      const hud = await box(page, '#hud');
      assert.deepEqual([hud.l, hud.t, hud.r, hud.b], [0, 0, width, height], 'the scope covers the window');
      const boxes = {};
      for (const [part, selector] of Object.entries(parts)) boxes[part] = await box(page, selector);
      for (const [part, b] of Object.entries(boxes)) assert.ok(b.l >= -0.5 && b.t >= -0.5 && b.r <= width + 0.5 && b.b <= height + 0.5, `${part} is inside the window`);
      const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
      const names = Object.keys(boxes);
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(boxes[names[i]], boxes[names[j]]), `${names[i]} and ${names[j]} do not overlap`);
      const middle = (boxes.weapon.r + boxes.zoom.l) / 2;
      assert.ok(Math.abs(middle - width / 2) < width * 0.01, `the clear space is centred on the reticle (${middle} vs ${width / 2})`);
      const clipped = await page.evaluate(() => [...document.querySelectorAll('.panel')].filter(panel => panel.scrollHeight > panel.clientHeight + 1).map(panel => panel.className));
      assert.deepEqual(clipped, [], 'no panel has content scrolled out of sight');
      for (const control of ['#armBtn', '#fireBtn', '#shotsFired', '.cell:last-child span', '#hullValue', '#historyBtn', '#clearTarget', '#menuBtn']) await expect(page.locator(control)).toBeInViewport({ ratio: 0.99 });
      for (const [selector, share] of [['#powerSlider', 0.15], ['.cell-tube', 0.15], ['#zoomSlider', 0.12]]) {
        const tall = await page.locator(selector).first().evaluate(element => element.getBoundingClientRect().height);
        assert.ok(tall > height * share, `${selector} stays usable (${tall}px)`);
      }
      await page.evaluate(() => EnergyWeapon.advance(3000));
      await page.locator('#armBtn').click();
      for (let i = 0; i < 3; i++) {
        await page.locator('#fireBtn').click();
        await page.evaluate(() => EnergyWeapon.advance(3000));
      }
      await page.locator('#historyBtn').click();
      await expect(page.locator('#historyList .shot')).toHaveCount(3);
      const fits = await page.evaluate(() => { const d = document.getElementById('historyDialog'), b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && d.scrollHeight <= d.clientHeight + 1; });
      assert.ok(fits, 'the history fits without scrolling');
    };
run(cases);
