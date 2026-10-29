// Shield System Control: emitter output and extension, facing allocation, hits and recovery, raising and
// lowering, integrity limits, nearby-ship coverage and the demo controls.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

// Stepped demo time only: the page's own clock is paused so timings are exact.
async function openPaused(open) {
  const page = await open('/Shields/');
  await page.evaluate(() => ShieldControl.pause(true));
  return page;
}
const state = page => page.evaluate(() => ShieldControl.state());
const step = (page, seconds) => page.evaluate(value => ShieldControl.step(value), seconds);
const configure = (page, values) => page.evaluate(value => ShieldControl.configure(value), values);
async function demo(page, act) {
  await page.locator('#menuBtn').click();
  await page.locator('#openDemoControls').click();
  await act();
  if (await page.locator('#menuDialog').isVisible()) await page.locator('#menuDialog [data-close]').last().click();
}
const hit = (page, facing, times = 1) => demo(page, async () => { for (let i = 0; i < times; i++) await page.locator(`[data-hit="${facing}"]`).click(); });

run({
  'the console opens with shields up, four balanced facings, the full emitter output and one rescue ship': async ({ open }) => {
    const page = await openPaused(open);
    await expect(page.locator('#state')).toHaveText('SHIELDS UP');
    await expect(page.locator('#maxSeo')).toHaveText('400');
    await expect(page.locator('#availableSeo')).toHaveText('400.0');
    await expect(page.locator('#extensionValue')).toHaveText('20 m');
    await expect(page.locator('#radiusReading')).toHaveText('80 m');
    await expect(page.locator('#allocationNote')).toHaveText('ALLOCATED 100%');
    await expect(page.locator('#facings .facing')).toHaveCount(4);
    await expect(page.locator('.l-value[data-facing="Forward"]')).toHaveText('100.0 / 100.0');
    await expect(page.locator('.ship')).toHaveCount(1);
    await expect(page.locator('.enemy')).toHaveCount(0);
    await expect(page.locator('.c-num')).toHaveCount(12);
    await expect(page.locator('#advisory')).toHaveText('Rescue ship 1 is not fully protected. Extend shields to 162 m.');
  },

  'extending the shield widens the envelope and costs emitter output': async ({ open }) => {
    const page = await openPaused(open);
    const before = (await state(page)).view;
    await page.locator('#extensionSlider').focus();
    await page.keyboard.press('End');
    let now = await state(page);
    assert.equal(now.settings.extension, 500);
    assert.equal(now.radius, 560);
    assert.equal(now.effectiveSeo, 160, 'at 500 m the emitter keeps 40% of 400 SEO');
    await expect(page.locator('#availableSeo')).toHaveText('160.0');
    await expect(page.locator('.l-value[data-facing="Port"]')).toHaveText('40.0 / 40.0');
    await page.waitForTimeout(800);
    assert.ok((await state(page)).view > before, 'the map zooms out to fit the wider envelope');
  },

  'moving one facing shares the rest among the others, and Balance restores 25% each': async ({ open }) => {
    const page = await openPaused(open);
    const forward = page.locator('.facing-slider').first();
    await forward.focus();
    for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowUp');
    let now = await state(page);
    assert.equal(now.quadrants[0].allocation, 40);
    assert.ok(now.quadrants.slice(1).every(q => Math.abs(q.allocation - 20) < 1e-9), 'the other three share 60%');
    await expect(page.locator('#allocationNote')).toHaveText('ALLOCATED 100%');
    await expect(page.locator('#facingRows tr').first().locator('td').first()).toHaveText('160.0');
    await page.locator('#balance').click();
    now = await state(page);
    assert.ok(now.quadrants.every(q => q.allocation === 25));
  },

  'hits drain their facing, colour it by what is left, and recovery restores it over time': async ({ open }) => {
    const page = await openPaused(open);
    await hit(page, 3); // Port, 40 of 100
    let port = (await state(page)).quadrants[3];
    assert.equal(port.drain, 40);
    assert.equal(port.level, 'good', '60% left is still blue');
    await expect(page.locator('#notice')).toHaveText('Port facing hit: 40 SEO drained.');
    await hit(page, 3);
    port = (await state(page)).quadrants[3];
    assert.equal(port.remaining, 20);
    assert.equal(port.level, 'warn', '20% left is yellow');
    await expect(page.locator('#advisory')).toHaveText(/Port facing below 50%\. Recovering 10 SEO every 1 s\./);
    await expect(page.locator('#facingRows tr').nth(3)).toHaveAttribute('data-level', 'warn');
    await step(page, 3);
    assert.equal((await state(page)).quadrants[3].drain, 50, 'three seconds of recovery remove 30 SEO of drain');
    await step(page, 5);
    assert.equal((await state(page)).quadrants[3].drain, 0);
  },

  'a drained facing goes down, and a hit there reaches the hull without adding drain': async ({ open }) => {
    const page = await openPaused(open);
    await configure(page, { recover: false });
    await hit(page, 0, 3); // 120 of 100 SEO
    let now = await state(page);
    assert.equal(now.quadrants[0].remaining, 0);
    assert.equal(now.quadrants[0].level, 'down');
    await expect(page.locator('#state')).toHaveText('FACING DOWN');
    await expect(page.locator('.l-value[data-facing="Forward"]')).toHaveText('DOWN');
    await expect(page.locator('#advisory')).toHaveText('Forward facing down. Hits there reach the hull.');
    const drain = now.quadrants[0].drain;
    await hit(page, 0);
    assert.equal((await state(page)).quadrants[0].drain, drain, 'no drain added');
    await expect(page.locator('#notice')).toHaveText('Forward facing is down: the hit reached the hull.');
  },

  'lowering the shields leaves no protection; raising needs enough module integrity': async ({ open }) => {
    const page = await openPaused(open);
    await page.locator('#shieldToggle').click();
    await expect(page.locator('#state')).toHaveText('SHIELDS DOWN');
    await expect(page.locator('#toggleLabel')).toHaveText('RAISE SHIELDS');
    await expect(page.locator('#totalReading')).toHaveText('0.0 SEO');
    await expect(page.locator('.f-offline')).toHaveCount(1);
    await expect(page.locator('#advisory')).toHaveText('Shields down. Raise shields to protect the ship.');
    await configure(page, { integrity: 15 });
    await expect(page.locator('#shieldToggle')).toHaveAttribute('aria-disabled', 'true');
    // A blocked Raise is still tappable (marked aria-disabled, not disabled), so the tap can say why.
    await page.locator('#shieldToggle').click({ force: true });
    await expect(page.locator('#notice')).toHaveText('Module integrity 15% is below the 20% needed to raise shields.');
    assert.equal((await state(page)).shields, false);
    await configure(page, { integrity: 60 });
    await page.locator('#shieldToggle').click();
    await expect(page.locator('#state')).toHaveText('SHIELDS UP');
    // Integrity falling below the minimum takes raised shields offline.
    await configure(page, { integrity: 10 });
    await expect(page.locator('#state')).toHaveText('OFFLINE');
    await expect(page.locator('#emitterState')).toHaveText('OFFLINE');
    await configure(page, { integrity: 0 });
    await expect(page.locator('#state')).toHaveText('DESTROYED');
    await expect(page.locator('#advisory')).toHaveText(/Shield generator destroyed/);
  },

  'nearby ships lie at their own headings and are protected only inside the envelope': async ({ open }) => {
    const page = await openPaused(open);
    let now = await state(page);
    // Rescue ship 1 is 180 m to starboard, turned 30°: its far corner is 221.7 m out, 162 m past our hull.
    assert.equal(now.ships[0].heading, 30);
    assert.equal(now.ships[0].extensionNeeded, 162);
    assert.equal(now.ships[0].covered, false);
    await expect(page.locator('#coverageBtn')).toHaveAttribute('data-alert', 'true');
    await demo(page, async () => { await page.locator('#addShip').click(); await page.locator('#addShip').click(); });
    now = await state(page);
    assert.equal(now.ships.length, 3);
    assert.ok(now.ships.slice(1).every(ship => ship.heading >= 0 && ship.heading < 360), 'added ships get a heading');
    const transforms = await page.locator('.ship image').evaluateAll(images => images.map(image => image.getAttribute('transform')));
    assert.ok(transforms[0].startsWith('rotate(120 '), 'the ship image is turned to its heading');
    await configure(page, { extension: 162 });
    now = await state(page);
    assert.equal(now.ships[0].covered, true, 'Rescue ship 1 is inside at 162 m');
    await page.locator('#coverageBtn').click();
    await expect(page.locator('.coverage-row[data-ship="Rescue ship 1"] em')).toHaveText('PROTECTED');
    const second = now.ships[1];
    await expect(page.locator('.coverage-row[data-ship="Rescue ship 2"] em')).toHaveText(second.covered ? 'PROTECTED' : second.extensionNeeded <= 500 ? `EXTEND TO ${second.extensionNeeded} M` : 'BEYOND REACH');
    await page.locator('#coverageDialog [data-close]').click();
    await expect(page.locator('.ship[data-ship="Rescue ship 1"]')).toHaveClass(/safe/);
  },

  'a ship over a facing that is down is not protected': async ({ open }) => {
    const page = await openPaused(open);
    await configure(page, { extension: 200, recover: false });
    assert.equal((await state(page)).ships[0].covered, true, 'Rescue ship 1 lies to starboard, inside 200 m');
    await hit(page, 1, 3);
    assert.equal((await state(page)).ships[0].covered, false);
    await page.locator('#coverageBtn').click();
    await expect(page.locator('.coverage-row em')).toHaveText('FACING DOWN');
  },

  'enemies show as red dots on the compass rose, fire on the facing they are over, and the console says where to reinforce': async ({ open }) => {
    const page = await openPaused(open);
    await configure(page, { recover: false, enemyDrift: false, extension: 200 });
    await demo(page, () => page.locator('#addEnemy').click()); // Raider 1 at 300°, over the Port facing
    let now = await state(page);
    assert.equal(now.enemies[0].facing, 'Port');
    assert.deepEqual(now.threats, [0, 0, 0, 1]);
    await expect(page.locator('.enemy[data-enemy="Raider 1"] .e-dot')).toHaveCount(1);
    const dot = await page.locator('.enemy .e-dot').evaluate(c => [+c.getAttribute('cx'), +c.getAttribute('cy')]);
    assert.ok(Math.abs(Math.atan2(dot[0], -dot[1]) * 180 / Math.PI + 60) < 0.5, 'the dot sits at bearing 300');
    await expect(page.locator('.enemy .e-detail')).toHaveText('12 KM · 300°');
    await expect(page.locator('#facingRows tr').nth(3).locator('.threat')).toHaveText('◆ 1');
    await expect(page.locator('#advisory')).toHaveText('Enemy fire on the Port facing (1 contact). Move allocation to Port.');
    await page.locator('.facing-slider').nth(3).focus();
    for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowUp');
    await expect(page.locator('#advisory')).toHaveText(/Port reinforced against 1 enemy\./);
    await step(page, 2);
    assert.equal((await state(page)).quadrants[3].drain, 40, 'its first shot drained Port');
    await step(page, 4);
    assert.equal((await state(page)).quadrants[3].drain, 80, 'and it fires every 4 s');
    // Reinforced but worn down: the usual warning, not more allocation advice.
    await expect(page.locator('#advisory')).toHaveText(/^Port facing below 50%/);
    // With the shields down its fire reaches the hull.
    await page.locator('#shieldToggle').click();
    await expect(page.locator('#advisory')).toHaveText('Shields down with 1 enemy in range. Raise shields.');
    await step(page, 4);
    assert.equal((await state(page)).quadrants[3].drain, 80, 'no drain while the shields are down');
  },

  'enemies circle the ship unless told to hold, and can be cleared': async ({ open }) => {
    const page = await openPaused(open);
    await configure(page, { enemyFire: false });
    await demo(page, async () => { await page.locator('#addEnemy').click(); await page.locator('#addEnemy').click(); });
    await step(page, 10);
    let now = await state(page);
    assert.equal(Math.round(now.enemies[0].bearing), 315, 'Raider 1 drifts 1.5° a second');
    assert.equal(Math.round(now.enemies[1].bearing), 60, 'Raider 2 drifts the other way');
    await demo(page, () => page.locator('#clearEnemies').click());
    await expect(page.locator('.enemy')).toHaveCount(0);
  },

  'demo controls: hit strength, max SEO and reset': async ({ open }) => {
    const page = await openPaused(open);
    await demo(page, async () => {
      await page.locator('[data-field="damageAmount"] [data-edit]').click();
      await page.keyboard.type('15');
      await page.locator('#menuDialog [data-save]').click();
      await page.locator('[data-hit="2"]').click();
      await page.locator('[data-field="maxSeo"] [data-edit]').click();
      await page.keyboard.type('800');
      await page.locator('#menuDialog [data-save]').click();
    });
    let now = await state(page);
    assert.equal(now.quadrants[2].drain, 15);
    assert.equal(now.effectiveSeo, 800);
    await expect(page.locator('#maxSeo')).toHaveText('800');
    await demo(page, () => page.locator('#resetDemo').click());
    now = await state(page);
    assert.equal(now.settings.maxSeo, 400);
    assert.equal(now.quadrants[2].drain, 0);
    assert.equal(now.ships.length, 1);
    assert.equal(now.enemies.length, 0);
  },
});
