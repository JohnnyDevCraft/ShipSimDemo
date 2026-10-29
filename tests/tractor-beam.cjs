// Tractor Beam Control: what the reticle is on, the lock rules (range, ships only, shields, power), moving and
// turning a held ship with the two joysticks (at the same time, by two fingers), the warp field and the demo controls.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

async function openPaused(open) {
  const page = await open('/TractorBeam/?models=0');
  await page.evaluate(() => TractorControl.pause(true));
  return page;
}
const state = page => page.evaluate(() => TractorControl.state());
const step = (page, seconds) => page.evaluate(value => TractorControl.step(value), seconds);
const aimAt = (page, bearing) => page.evaluate(value => TractorControl.aimAt(value), bearing);
const configure = (page, values) => page.evaluate(value => TractorControl.configure(value), values);
const stick = (page, which, x, y = 0) => page.evaluate(([w, a, b]) => TractorControl.stick(w, a, b), [which, x, y]);
const ship = (now, name) => now.ships.find(item => item.name === name);
async function lockKestrel(page) {
  await aimAt(page, 12);
  await page.locator('#engageBtn').click();
  assert.equal((await state(page)).held, 'Shuttle Kestrel');
}

run({
  'the reticle readout names what the beam points at and how far away it is': async ({ open }) => {
    const page = await openPaused(open);
    await expect(page.locator('#reticleChip')).toBeHidden();
    await expect(page.locator('#advisory')).toHaveText(/Line the reticle up on a ship/);
    await aimAt(page, 12);
    await expect(page.locator('#reticleName')).toHaveText('Shuttle Kestrel');
    await expect(page.locator('#reticleRange')).toHaveText('1.10 km');
    await expect(page.locator('#reticleStatus')).toHaveText('LOCKABLE · 3.4 PU');
    await expect(page.locator('#targetKind')).toHaveText('SHIP · IN RANGE');
    await expect(page.locator('#state')).toHaveText('READY');
    await aimAt(page, 32);
    await expect(page.locator('#reticleName')).toHaveText('Training Station Halcyon');
    await expect(page.locator('#reticleRange')).toHaveText('14.2 km');
    await expect(page.locator('#reticleStatus')).toHaveText('SHIPS ONLY');
    await expect(page.locator('#advisory')).toHaveText('Training Station Halcyon · 14.2 km. Stations cannot be tractored; the beam holds ships only.');
    await aimAt(page, -24);
    await expect(page.locator('#reticleName')).toHaveText('Earth');
    await expect(page.locator('#reticleRange')).toHaveText('192,000 km');
  },

  'the beam locks only on a ship within range with its shields down, and says why not': async ({ open }) => {
    const page = await openPaused(open);
    const tryEngage = async message => {
      await page.locator('#engageBtn').click({ force: true });
      await expect(page.locator('#notice')).toHaveText(message);
      assert.equal((await state(page)).held, null);
    };
    await expect(page.locator('#engageBtn')).toHaveAttribute('aria-disabled', 'true');
    await tryEngage('Nothing under the reticle. Line up on a ship within beam range.');
    await aimAt(page, 32);
    await tryEngage('Stations cannot be tractored. The beam holds ships only.');
    await aimAt(page, -38);
    await tryEngage('Training ship A is 7.80 km away; the beam reaches 5.00 km.');
    await configure(page, { beamRange: 9000 });
    await tryEngage('Training ship A has its shields up. The beam cannot lock through shields.');
    await expect(page.locator('#reticleStatus')).toHaveText('SHIELDS UP');
    await page.evaluate(() => TractorControl.shields('Training ship A', false));
    await page.locator('#engageBtn').click();
    assert.equal((await state(page)).held, 'Training ship A');
    await expect(page.locator('#state')).toHaveText('LOCKED');
    await expect(page.locator('#notice')).toHaveText('Tractor beam locked on Training ship A.');
  },

  'raising its shields breaks a held ship free': async ({ open }) => {
    const page = await openPaused(open);
    await lockKestrel(page);
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('#shipShields input[data-ship="Shuttle Kestrel"]').check({ force: true });
    await page.locator('#menuDialog [data-close]').last().click();
    assert.equal((await state(page)).held, null);
    await expect(page.locator('#notice')).toHaveText('Beam lost: Shuttle Kestrel raised its shields.');
  },

  'the Position stick pushes, pulls and swings the held ship round at the same distance': async ({ open }) => {
    const page = await openPaused(open);
    await expect(page.locator('#positionStick')).toHaveClass(/disabled/);
    await lockKestrel(page);
    await expect(page.locator('#positionStick')).not.toHaveClass(/disabled/);
    // Up (y −1): away at the full 100 m/s.
    await stick(page, 'position', 0, -1);
    await step(page, 2);
    let now = await state(page);
    assert.equal(Math.round(ship(now, 'Shuttle Kestrel').range), 1300);
    await expect(page.locator('#radialRate')).toHaveText('+100 m/s');
    // Right: round to starboard, 200 m of arc at 1,300 m, with the range unchanged.
    await stick(page, 'position', 1, 0);
    await step(page, 2);
    now = await state(page);
    const kestrel = ship(now, 'Shuttle Kestrel');
    assert.equal(Math.round(kestrel.range), 1300);
    assert.ok(Math.abs(kestrel.bearing - (12 + (200 / 1300) * 180 / Math.PI)) < 0.05, `swung to ${kestrel.bearing}`);
    assert.equal(now.aim, kestrel.bearing, 'the view follows the held ship');
    // Down: pulled in, but not closer than the clearance between hulls.
    await stick(page, 'position', 0, 1);
    await step(page, 20);
    now = await state(page);
    assert.equal(ship(now, 'Shuttle Kestrel').range, 60 + 20 + 40);
    await expect(page.locator('#positionNote')).toHaveText('MINIMUM CLEARANCE');
    // And no further out than the beam reaches.
    await stick(page, 'position', 0, -1);
    await step(page, 60);
    assert.equal(ship(await state(page), 'Shuttle Kestrel').range, 5000);
    await expect(page.locator('#positionNote')).toHaveText('BEAM LIMIT');
  },

  'the Heading stick turns the held ship, and both sticks follow two fingers at once': async ({ open }) => {
    const page = await openPaused(open);
    await lockKestrel(page);
    // Two touches, one on each stick, held together.
    const centre = async id => page.locator(id).evaluate(el => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width }; });
    const left = await centre('#positionStick'), right = await centre('#headingStick');
    const touch = (id, type, pointerId, x, y) => page.locator(id).dispatchEvent(type, { pointerId, pointerType: 'touch', isPrimary: pointerId === 11, clientX: x, clientY: y, bubbles: true });
    await touch('#positionStick', 'pointerdown', 11, left.x, left.y);
    await touch('#headingStick', 'pointerdown', 12, right.x, right.y);
    await touch('#positionStick', 'pointermove', 11, left.x, left.y - left.w);
    await touch('#headingStick', 'pointermove', 12, right.x + right.w, right.y);
    let now = await state(page);
    assert.ok(now.sticks.position.y < -0.95, 'the Position stick is pushed up');
    assert.ok(now.sticks.heading.x > 0.95, 'the Heading stick is pushed right at the same time');
    const before = ship(now, 'Shuttle Kestrel');
    await step(page, 5);
    now = await state(page);
    const after = ship(now, 'Shuttle Kestrel');
    assert.equal(Math.round(after.range - before.range), 500, 'pushed away');
    assert.equal(Math.round(after.yaw - before.yaw), 30, 'turned 30° at 6°/s');
    // Lifting one finger leaves the other stick working.
    await touch('#headingStick', 'pointerup', 12, right.x + right.w, right.y);
    now = await state(page);
    assert.equal(now.sticks.heading.x, 0, 'the Heading stick springs back');
    assert.ok(now.sticks.position.y < -0.95, 'the Position stick is still held');
    await touch('#positionStick', 'pointerup', 11, left.x, left.y - left.w);
    assert.equal((await state(page)).sticks.position.y, 0);
  },

  'the keyboard drives the sticks too: W/S, A/D and Q/E': async ({ open }) => {
    const page = await openPaused(open);
    await lockKestrel(page);
    await page.keyboard.down('w');
    await page.keyboard.down('e');
    let now = await state(page);
    assert.ok(now.sticks.position.y < -0.95 && now.sticks.heading.x > 0.95);
    await page.keyboard.up('w');
    await page.keyboard.up('e');
    now = await state(page);
    assert.equal(now.sticks.position.y, 0);
    assert.equal(now.sticks.heading.x, 0);
  },

  'a held ship inside the warp field and on our heading is ready to go to warp with us': async ({ open }) => {
    const page = await openPaused(open);
    await lockKestrel(page);
    await expect(page.locator('#advisory')).toHaveText('Holding Shuttle Kestrel at 1.10 km. Pull it within the 500 m warp field: 620 m to go.');
    await stick(page, 'position', 0, 1);
    await step(page, 7);
    await stick(page, 'position', 0, 0);
    let now = await state(page);
    assert.ok(ship(now, 'Shuttle Kestrel').warp.inside);
    await expect(page.locator('#advisory')).toHaveText('Shuttle Kestrel is inside the warp field. Turn it 160° to starboard to match our heading.');
    await expect(page.locator('#targetWarp')).toHaveText('TURN 160°');
    await stick(page, 'heading', 1);
    await step(page, 160 / 6 + 0.05);
    await stick(page, 'heading', 0);
    now = await state(page);
    assert.ok(ship(now, 'Shuttle Kestrel').warp.ready);
    await expect(page.locator('#state')).toHaveText('WARP READY');
    await expect(page.locator('#targetWarp')).toHaveText('READY');
    await expect(page.locator('#advisory')).toHaveText(/inside the warp field and aligned/);
  },

  'holding draws power by distance, from idle alongside to max at beam range, and the power sets how far out it can hold': async ({ open }) => {
    const page = await openPaused(open);
    await expect(page.locator('#powerDraw')).toHaveText('1.0');
    // 1.1 km of 5 km: 1 + 11 × 0.22 = 3.42 PU.
    await lockKestrel(page);
    await expect(page.locator('#powerDraw')).toHaveText('3.4');
    await expect(page.locator('#reticleChip')).toBeHidden();
    // At the full 5 km it takes the full 12 PU.
    await stick(page, 'position', 0, -1);
    await step(page, 40);
    assert.equal(ship(await state(page), 'Shuttle Kestrel').range, 5000);
    await expect(page.locator('#powerDraw')).toHaveText('12.0');
    // Pulled back in to 2.5 km: 6.5 PU.
    await stick(page, 'position', 0, 1);
    await step(page, 25);
    await stick(page, 'position', 0, 0);
    assert.equal(Math.round(ship(await state(page), 'Shuttle Kestrel').range), 2500);
    await expect(page.locator('#powerDraw')).toHaveText('6.5');
    // With 6.5 PU available the beam holds out to 2.5 km and no further.
    await configure(page, { available: 6.5 });
    await expect(page.locator('#reachReading')).toHaveText('2.50 km');
    await stick(page, 'position', 0, -1);
    await step(page, 5);
    assert.equal(Math.round(ship(await state(page), 'Shuttle Kestrel').range), 2500);
    await expect(page.locator('#positionNote')).toHaveText('POWER LIMIT');
    await stick(page, 'position', 0, 0);
    // Less power than its distance needs: the beam lets go.
    await configure(page, { available: 4 });
    await step(page, 0.1);
    assert.equal((await state(page)).held, null);
    await expect(page.locator('#notice')).toHaveText('Beam lost: not enough power to hold Shuttle Kestrel at 2.50 km.');
    // Nor can it lock a ship further out than the power reaches.
    await aimAt(page, -14);
    await expect(page.locator('#reticleStatus')).toHaveText('NOT ENOUGH POWER');
    await page.locator('#engageBtn').click({ force: true });
    await expect(page.locator('#notice')).toHaveText('Holding Freighter Meridian at 2.40 km needs 6.3 PU; 4.0 PU available reaches 1.36 km.');
    await configure(page, { available: 0.5 });
    await expect(page.locator('#state')).toHaveText('NO POWER');
  },

  'Next Ship lines up on the lockable ships in range; Release lets go': async ({ open }) => {
    const page = await openPaused(open);
    await page.locator('#nextBtn').click();
    await step(page, 1);
    assert.equal((await state(page)).under, 'Shuttle Kestrel');
    await page.locator('#nextBtn').click();
    await step(page, 1);
    assert.equal((await state(page)).under, 'Freighter Meridian', 'round to the freighter; the shielded ship is skipped');
    await page.locator('#engageBtn').click();
    await page.locator('#releaseBtn').click();
    assert.equal((await state(page)).held, null);
    await expect(page.locator('#notice')).toHaveText('Freighter Meridian released.');
  },
});
