// Warp Field Control: the universal field rule, stretching the field, the warp it allows and the power it takes,
// ships inside, cut by or outside the field, Fit to Ships, going to warp with ships, supply and the drive presets.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const state = page => page.evaluate(() => WarpFieldControl.state());
const extend = (page, metres) => page.evaluate(value => WarpFieldControl.setExtension(value), metres);
const configure = (page, values) => page.evaluate(value => WarpFieldControl.configure(value), values);
const near = (a, b, tolerance = 0.01) => Math.abs(a - b) <= tolerance;

run({
  'it opens on the Mark I: an 80 m normal field, up to 500 m more, and today\'s straight-line warp power': async ({ open }) => {
    const page = await open('/WarpField/');
    const now = await state(page);
    assert.equal(now.normalRadius, 80, 'half the 120 m hull plus 20 m');
    assert.ok(near(now.maxExtension, 500), '3.57 m per PU × 140 PU');
    assert.ok(near(now.power, 140 * 2 / 6), 'warp 2 of 6 at the normal field takes a third of 140 PU');
    await expect(page.locator('#radiusValue')).toHaveText('80 m');
    await expect(page.locator('#coreValue')).toHaveText('33%');
    await expect(page.locator('#capValue')).toHaveText('6.0');
    await expect(page.locator('#capNote')).toHaveText('of 6 · no limit');
    await expect(page.locator('#helmReading')).toHaveText('warp 2.0');
    await expect(page.locator('#warpSlider')).toHaveCount(0);
    await expect(page.locator('.dock #engageBtn')).toHaveCount(0);
    await expect(page.locator('#state')).toHaveText('STANDBY');
    await expect(page.locator('.ship')).toHaveCount(2);
    await expect(page.locator('#advisory')).toHaveText(/^Freighter Meridian is outside the field and would be left behind\. Extend to \d+ m to take it\.$/);
  },

  'one rule for every drive: the most extra field scales with max power, and full stretch leaves warp 1': async ({ open }) => {
    const page = await open('/WarpField/');
    const results = await page.evaluate(() => {
      const { rule } = WarpFieldControl;
      const drives = [{ maxPower: 140, maxWarp: 6 }, { maxPower: 280, maxWarp: 6 }, { maxPower: 200, maxWarp: 7.5 }, { maxPower: 80, maxWarp: 8 }];
      return drives.map(d => {
        const most = (500 / 140) * d.maxPower;
        return { most, normal: rule.maxWarp(0, d), half: rule.maxWarp(most / 2, d), full: rule.maxWarp(most, d), powerFull: rule.power(1, most, d), powerNormal: rule.power(d.maxWarp, 0, d) };
      });
    });
    assert.ok(near(results[0].most, 500) && near(results[1].most, 1000), 'twice the power, twice the extra field');
    for (const [i, r] of results.entries()) {
      const max = [6, 6, 7.5, 8][i], power = [140, 280, 200, 80][i];
      assert.ok(near(r.normal, max), 'the normal field keeps the full max warp');
      assert.ok(near(r.half, max / (1 + (max - 1) / 4)), 'half stretch: max warp ÷ (1 + (max − 1) × ¼)');
      assert.ok(near(r.full, 1), 'full stretch leaves warp 1');
      assert.ok(near(r.powerFull, power) && near(r.powerNormal, power), 'all the power at max warp unstretched, and at warp 1 fully stretched');
    }
  },

  'stretching the field lowers the warp limit, holds the Helm\'s warp to it, and raises the power each warp takes': async ({ open }) => {
    const page = await open('/WarpField/');
    await page.evaluate(() => WarpFieldControl.setWarp(4));
    await extend(page, 250); // half stretch
    let now = await state(page);
    assert.equal(now.stretch, 0.5);
    assert.equal(now.load, 2.25);
    assert.ok(near(now.cap, 6 / 2.25), 'max warp 2.67');
    assert.ok(near(now.warp, now.cap), 'warp 4 came down to the new max');
    await expect(page.locator('#capValue')).toHaveText('2.7');
    await expect(page.locator('#capNote')).toHaveText('of 6 · field takes 3.3');
    await expect(page.locator('#loadReading')).toHaveText('×2.25');
    await expect(page.locator('#helmReading')).toHaveText('warp 2.7 · held to the limit');
    // The gauge: available up to 2.67 of 6, the rest hatched as taken by the field.
    const heights = await page.evaluate(() => ['availFill', 'lostFill'].map(id => parseFloat(document.getElementById(id).style.height)));
    assert.ok(near(heights[0], (6 / 2.25 / 6) * 100) && near(heights[1], 100 - (6 / 2.25 / 6) * 100));
    await page.evaluate(() => WarpFieldControl.setWarp(2));
    now = await state(page);
    assert.ok(near(now.power, 140 * (2 / 6) * 2.25), 'warp 2 takes 2.25 times its normal-field power');
    await expect(page.locator('#coreValue')).toHaveText('75%');
    // The slider works too.
    await page.locator('#extensionSlider').focus();
    await page.keyboard.press('Home');
    assert.equal((await state(page)).extension, 0);
    await page.keyboard.press('End');
    assert.equal((await state(page)).extension, 500);
    await expect(page.locator('#capValue')).toHaveText('1.0');
  },

  'a ship cut by the field\'s edge blocks the jump, and the console says how to clear it': async ({ open }) => {
    const page = await open('/WarpField/');
    await page.evaluate(() => WarpFieldControl.ships([{ name: 'Test hull', bearing: 90, distance: 200, length: 100, heading: 0 }]));
    // Its hull spans about 183.5 to 216.5 m from our centre (16.5 m either side of 200).
    await extend(page, 120); // a 200 m field cuts it
    let now = await state(page);
    assert.equal(now.ships[0].status, 'cut');
    await expect(page.locator('#state')).toHaveText('FIELD CUTS SHIP');
    await expect(page.locator('#advisory')).toHaveText(/^Test hull is cut by the field's edge\. Extend to \d+ m or pull in to \d+ m\.$/);
    await page.evaluate(() => WarpFieldControl.engage());
    assert.equal((await state(page)).atWarp, false);
    await page.locator('#shipsBtn').click();
    await expect(page.locator('.ship-row[data-ship="Test hull"] em')).toHaveText(/^CUT · EXTEND TO \d+ M$/);
    await page.locator('#shipsDialog [data-close]').click();
    await extend(page, now.ships[0].enclose);
    assert.equal((await state(page)).ships[0].status, 'in');
  },

  'Fit to Ships takes in both ships; at warp they stay inside, and ships left outside are left behind': async ({ open }) => {
    const page = await open('/WarpField/');
    await page.locator('#fitBtn').click();
    let now = await state(page);
    assert.ok(now.ships.every(ship => ship.status === 'in'));
    assert.equal(now.extension, Math.max(...now.ships.map(ship => ship.enclose)) + 5);
    await expect(page.locator('#notice')).toHaveText(/^Field fitted round 2 ships at \d+ m\.$/);
    // A third ship well outside.
    await page.evaluate(() => WarpFieldControl.ships([...WarpFieldControl.state().ships, { name: 'Far hauler', bearing: 0, distance: 560, length: 60, heading: 90 }]));
    now = await state(page);
    assert.equal(now.ships[2].status, 'out');
    // The Helm goes to warp (its stand-in is in the demo controls).
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('#engageBtn').click();
    await page.locator('#menuDialog [data-close]').last().click();
    now = await state(page);
    assert.equal(now.atWarp, true);
    assert.deepEqual(now.carried, ['Freighter Meridian', 'Shuttle Kestrel']);
    await expect(page.locator('#state')).toHaveText('WARP 2.0');
    await expect(page.locator('.ship[data-ship="Far hauler"]')).toHaveCount(0);
    // The field cannot shrink through the ships it carries.
    await extend(page, 0);
    assert.equal((await state(page)).extension, Math.max(...now.ships.slice(0, 2).map(ship => ship.enclose)));
    await expect(page.locator('#extensionSlider .vs-floor')).toBeVisible();
    await page.locator('#normalBtn').click({ force: true });
    await expect(page.locator('#notice')).toHaveText('The field is carrying ships; it cannot go back to normal at warp.');
    await page.evaluate(() => WarpFieldControl.engage());
    now = await state(page);
    assert.equal(now.atWarp, false);
    assert.deepEqual(now.ships.map(ship => ship.name), ['Freighter Meridian', 'Shuttle Kestrel']);
    await expect(page.locator('#notice')).toHaveText('Dropped out of warp. 2 ships came with us; 1 left behind.');
  },

  'the Helm\'s warp is set from the demo controls and held to the field\'s limit': async ({ open }) => {
    const page = await open('/WarpField/');
    await extend(page, 250);
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('[data-field="helmWarp"] [data-edit]').click();
    await page.keyboard.type('5');
    await page.locator('#menuDialog [data-save]').click();
    await expect(page.locator('#notice')).toHaveText('The field holds the Helm to warp 2.7.');
    assert.ok(near((await state(page)).warp, 6 / 2.25));
  },

  'less supply than the drive\'s max power lowers the warp it can reach, and can stop it altogether': async ({ open }) => {
    const page = await open('/WarpField/');
    await configure(page, { supply: 70 });
    let now = await state(page);
    assert.ok(near(now.cap, 3), 'half the power: half the max warp');
    await extend(page, 500);
    now = await state(page);
    assert.ok(now.cap < 1);
    await expect(page.locator('#state')).toHaveText('NO WARP');
    await expect(page.locator('#capNote')).toHaveText('cannot reach warp 1');
    await expect(page.locator('#advisory')).toHaveText(/^Not enough supply to push a field this size: 140 PU needed for warp 1, 70 PU supplied\.$/);
  },

  'drive presets use the same rule: Courier 286 m, Mark II 714 m': async ({ open }) => {
    const page = await open('/WarpField/');
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('[data-drive="courier"]').click();
    let now = await state(page);
    assert.equal(now.normalRadius, 50);
    assert.ok(near(now.maxExtension, 285.71));
    await page.locator('[data-drive="mark2"]').click();
    now = await state(page);
    assert.equal(now.normalRadius, 110);
    assert.ok(near(now.maxExtension, 714.29));
    await expect(page.locator('#caption')).toHaveText(/MARK II · 200 PU · MAX WARP 7\.5/);
    // The universal stretch rate changes every drive alike.
    await page.locator('[data-field="stretchPerPu"] [data-edit]').click();
    await page.keyboard.type('5');
    await page.locator('#menuDialog [data-save]').click();
    assert.equal((await state(page)).maxExtension, 1000);
    await page.locator('#resetDemo').click();
    now = await state(page);
    assert.ok(near(now.maxExtension, 500));
    assert.equal(now.ships.length, 2);
  },

  'ships lie at their own headings, and the field must reach the hull\'s far corner': async ({ open }) => {
    const page = await open('/WarpField/');
    await page.evaluate(() => WarpFieldControl.ships([{ name: 'Across', bearing: 90, distance: 200, length: 100, heading: 0 }, { name: 'Along', bearing: 90, distance: 200, length: 100, heading: 90 }]));
    const now = await state(page);
    // Across our beam (heading 0): the far corner is √(216.5² + 50²) out. Along it (heading 90): 250 m out.
    assert.equal(now.ships[0].enclose, Math.ceil(Math.hypot(200 + 16.5, 50) - 80));
    assert.equal(now.ships[1].enclose, Math.ceil(Math.hypot(250, 16.5) - 80));
    const transform = await page.locator('.ship[data-ship="Along"] image').getAttribute('transform');
    assert.ok(transform.startsWith('rotate(180 '), 'the image is turned to its heading');
  },
});
