// EPW Control (phase cannon) and EBW Control (phaser array): the shared scope with each weapon's arc, charging,
// shot power, pulses and beams, arming and firing, delegation, history and the demo controls.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const CANNON = '/PhaseCannon/?models=0', ARRAY = '/PhaserArray/?models=0';
const QUIET_CANNON = CANNON + '&battle=0', QUIET_ARRAY = ARRAY + '&battle=0';
const state = page => page.evaluate(() => EnergyWeapon.state());
async function demo(page, act) {
  await page.locator('#menuBtn').click();
  await page.locator('#openDemoControls').click();
  await act();
  if (await page.locator('#menuDialog').isVisible()) await page.locator('#menuDialog [data-close]').last().click();
}
async function setField(page, key, text) {
  await page.locator(`#menuDialog [data-field="${key}"] [data-edit]`).click();
  const pad = page.locator('#menuDialog .keypad');
  await pad.getByRole('button', { name: 'Clear' }).click();
  for (const key of text) await pad.getByRole('button', { name: key === '-' ? 'Change sign' : key, exact: true }).click();
  await page.locator('#menuDialog [data-save]').click();
}
async function placeShip(page, values) {
  await demo(page, () => page.locator('#moveShips').click());
  await page.evaluate(v => EnergyWeapon.set({ contacts: [v] }), values);
}
async function tapShip(page) {
  const point = await page.evaluate(() => EnergyWeapon.tapPoint('ship:Training ship A'));
  assert.ok(point, 'the ship is on the scope');
  await page.mouse.click(point.x, point.y);
}

run({
  'EPW: three chambers charge to the shot power, and the first ready one fires': async ({ open }) => {
    const page = await open(CANNON);
    await expect(page.locator('.title-pill')).toHaveText('EPW CONTROL');
    await expect(page.locator('.cell')).toHaveCount(3);
    await page.evaluate(() => EnergyWeapon.advance(1500));
    await expect(page.locator('.cell span')).toHaveText(['READY', 'READY', 'READY']);
    await expect(page.locator('.cell').first()).toHaveAttribute('data-state', 'next');
    await expect(page.locator('#powerDamage')).toHaveText('WED 78.0 · WKD 26.0');
    await page.locator('#fireBtn').click({ force: true });
    await expect(page.locator('#notice')).toHaveText('Arm the phase cannon before firing.');
    await page.locator('#armBtn').click();
    await expect(page.locator('#state')).toHaveText('READY');
    await page.locator('#fireBtn').click();
    let s = await state(page);
    assert.equal(s.flight[0].type, 'Pulse');
    assert.equal(s.flight[0].wed, 78);
    assert.equal(Math.round(s.charges[0]), 0, 'chamber 1 spent its charge');
    await expect(page.locator('.cell').nth(1)).toHaveAttribute('data-state', 'next');
    await page.locator('#fireBtn').click();
    await page.locator('#fireBtn').click();
    await expect(page.locator('#shotsFired')).toHaveText('3');
    await page.locator('#fireBtn').click({ force: true });
    await expect(page.locator('#notice')).toHaveText('No chamber is charged to the shot power yet.');
    await expect(page.locator('#state')).toHaveText('CHARGING');
  },
  'EPW: shot power sets the damage, and a pulse that meets the ship hits its shield': async ({ open }) => {
    const page = await open(CANNON);
    await placeShip(page, { bearing: 5, range: 6000, yaw: 90 });
    await page.locator('#powerSlider').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#powerValue')).toHaveText('100%');
    await expect(page.locator('#powerDamage')).toHaveText('WED 120.0 · WKD 40.0');
    await tapShip(page);
    await expect(page.locator('#targetName')).toHaveText('Training ship A');
    await page.evaluate(() => EnergyWeapon.set({ aim: 5 }));
    await expect(page.locator('#advisory')).toHaveText(/^On target · intercept/);
    await page.evaluate(() => EnergyWeapon.advance(1500));
    await page.locator('#armBtn').click();
    await page.locator('#fireBtn').click();
    await page.evaluate(() => EnergyWeapon.advance(600));
    const shot = (await state(page)).flight[0];
    assert.equal(shot.reason, 'Impact');
    assert.equal(shot.hitShield, true);
    await expect(page.locator('#q1')).toHaveText('0');
    await page.locator('#historyBtn').click();
    await expect(page.locator('#historyList .shot')).toContainText('#1 PULSE');
    await expect(page.locator('#historyList .shot em')).toHaveText('IMPACT');
  },
  'EPW: the arc is ±45°, and the demo controls change chambers, supply and pulses': async ({ open }) => {
    const page = await open(CANNON);
    const box = await page.locator('#hud').boundingBox();
    await page.mouse.move(box.width / 2, box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.width / 2 + 3000, box.height / 2, { steps: 10 });
    await page.mouse.up();
    assert.equal((await state(page)).aim, -45);
    await expect(page.locator('#aimTape .tape span').first()).toHaveText('−45');
    await demo(page, async () => {
      await page.locator('#chamberCount [data-count="1"]').click();
      await setField(page, 'supply', '0');
      await setField(page, 'pulseSpeed', '20000');
    });
    await expect(page.locator('.cell')).toHaveCount(1);
    await expect(page.locator('#recharge')).toHaveText('PAUSED');
    await expect(page.locator('#reach')).toHaveText(/^20 km\/s/);
    const before = (await state(page)).charges[0];
    await page.evaluate(() => EnergyWeapon.advance(5000));
    assert.equal((await state(page)).charges[0], before, 'no supply, no charging');
  },
  'EBW: one capacitor, a one-second beam that hits at once, and a full circle to aim in': async ({ open }) => {
    const page = await open(ARRAY);
    await expect(page.locator('.title-pill')).toHaveText('EBW CONTROL');
    await expect(page.locator('.cell')).toHaveCount(1);
    await expect(page.locator('.cell small')).toHaveText('CAPACITOR');
    await expect(page.locator('#aimTape .tape span').last()).toHaveText('+180');
    await placeShip(page, { bearing: -120, range: 4000, yaw: 200 });
    await page.evaluate(() => EnergyWeapon.set({ aim: -120 }));
    assert.equal((await state(page)).aim, -120, 'the array aims behind the ship');
    await tapShip(page);
    await expect(page.locator('#advisory')).toHaveText('On target.');
    await page.evaluate(() => EnergyWeapon.advance(2000));
    await page.locator('#armBtn').click();
    await page.locator('#fireBtn').click();
    await expect(page.locator('#state')).toHaveText('FIRING');
    await page.locator('#fireBtn').click({ force: true });
    await expect(page.locator('#notice')).toHaveText('The beam is still firing.');
    await page.evaluate(() => EnergyWeapon.advance(1100));
    const s = await state(page);
    assert.equal(s.beamActive, false);
    assert.equal(s.flight[0].type, 'Beam');
    assert.equal(s.flight[0].reason, 'Hit');
    assert.ok(s.flight[0].contactsHit[0].startsWith('Training ship A'), 'the beam hit the ship');
    const drained = s.shields['Training ship A'].drain.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(drained - 39) < 0.5, `a full beam drains WED 39 at 65% power (${drained})`);
    await page.locator('#historyBtn').click();
    await expect(page.locator('#historyList .shot em')).toHaveText('HIT');
    await expect(page.locator('#historyList .shot')).toContainText('#1 BEAM');
  },
  'EBW: the beam reaches 100 km; beyond it there is no solution': async ({ open }) => {
    const page = await open(ARRAY);
    await placeShip(page, { bearing: 0, range: 150000, yaw: 90 });
    await page.evaluate(() => EnergyWeapon.set({ zoom: 20 }));
    await tapShip(page);
    await expect(page.locator('#advisory')).toHaveText('Out of beam range: the array reaches 100 km.');
    await expect(page.locator('#targetSolution')).toHaveText('Out of range');
  },
  // Combat (MissionProtocol 1.0.0-Beta9), from the shared demo combat state (Shared/demo-combat.js). The demo's engagement is
  // switched off in these cases, so its ships do not pass in front of the target.
  'critical damage: a weapon\'s range halved marks its reach (halved), halves it and shows a red line naming it': async ({ open }) => {
    const page = await open(QUIET_ARRAY);
    await expect(page.locator('#reach')).toHaveText('1 s · 100 km');
    await expect(page.locator('#weaponCritical')).toBeHidden();
    await page.evaluate(() => DemoCombat.set('EBW1', ['range-halved']));
    await expect(page.locator('#weaponCritical')).toHaveText('CRITICAL · Range halved');
    await expect(page.locator('#reach')).toHaveText('1 s · 50 km (halved)');
    await placeShip(page, { bearing: 0, range: 70000, yaw: 90 });
    await page.evaluate(() => EnergyWeapon.set({ zoom: 20 }));
    await tapShip(page);
    await expect(page.locator('#advisory')).toHaveText('Out of beam range: the array reaches 50 km.');
    await expect(page.locator('#targetSolution')).toHaveText('Out of range');
    const cannon = await open(QUIET_CANNON);
    await cannon.evaluate(() => DemoCombat.set('EPW2', ['range-halved']));
    await expect(cannon.locator('#weaponCritical')).toHaveText('CRITICAL · CH 2: Range halved');
    await expect(cannon.locator('#reach')).toHaveText(/\(halved\)$/);
  },
  'targeting computer offline: the red pill shows, and there is no solution circle, lead marker or intercept': async ({ open }) => {
    const page = await open(QUIET_CANNON);
    await placeShip(page, { bearing: 5, range: 6000, yaw: 90 });
    await tapShip(page);
    await expect(page.locator('#leadMarker')).toBeVisible();
    await expect(page.locator('#targetingOffline')).toBeHidden();
    await page.evaluate(() => DemoCombat.set('targeting', ['targeting-computer-offline']));
    await expect(page.locator('#targetingOffline')).toHaveText('TARGETING COMPUTER OFFLINE');
    await expect(page.locator('#leadMarker')).toBeHidden();
    await expect(page.locator('#targetIntercept')).toHaveText('Offline');
    await expect(page.locator('#targetSolution')).toHaveText('No guidance');
    await expect(page.locator('#advisory')).toHaveText('Targeting computer offline: no guidance reticle. Aim by hand.');
    assert.equal((await state(page)).lead, null, 'no guidance');
  },
  'LOCK locks the targeting sensors on the selected ship (LOCKING…, then UNLOCK), and the weapon fires at the lock whatever the aim': async ({ open }) => {
    const page = await open(QUIET_CANNON);
    await placeShip(page, { bearing: 8, range: 6000, yaw: 90 });
    await expect(page.locator('#lockBtn')).toHaveAttribute('aria-disabled', 'true');
    await tapShip(page);
    await expect(page.locator('#targetKind')).toHaveText('HOSTILE');
    await expect(page.locator('#targetSolution')).toHaveText('Aim by hand');
    await page.locator('#lockBtn').click();
    await expect(page.locator('#lockBtn')).toHaveText('LOCKING…');
    await expect(page.locator('#targetSolution')).toHaveText('Locking…');
    await page.evaluate(() => EnergyWeapon.advance(2100));
    await expect(page.locator('#lockBtn')).toHaveText('UNLOCK');
    await expect(page.locator('#targetSolution')).toHaveText('Locked');
    await expect(page.locator('#fireMode')).toHaveText('LOCKED FIRE');
    await page.evaluate(() => EnergyWeapon.set({ aim: -30 }));
    await page.locator('#armBtn').click();
    await page.locator('#fireBtn').click();
    const s = await state(page);
    assert.ok(Math.abs(s.flight[0].aim - s.lead.bearing) < 0.01, `the pulse went along the solution (${s.flight[0].aim} vs ${s.lead.bearing}), not the aim`);
    await expect(page.locator('#notice')).toHaveText(/at Training ship A\.$/);
    await page.locator('#lockBtn').click();
    await expect(page.locator('#lockBtn')).toHaveText('LOCK');
    await expect(page.locator('#notice')).toHaveText('Targeting lock released.');
  },
  'each shot\'s split: LAST SHOT and the history read what the shield stopped and the hull KD': async ({ open }) => {
    const page = await open(QUIET_CANNON);
    await placeShip(page, { bearing: 5, range: 6000, yaw: 90 });
    await page.locator('#powerSlider').focus();
    await page.keyboard.press('End');
    await page.evaluate(() => EnergyWeapon.set({ aim: 5 }));
    await page.evaluate(() => EnergyWeapon.advance(1500));
    await page.locator('#armBtn').click();
    await page.locator('#fireBtn').click();
    await expect(page.locator('#lastShot')).toHaveText('100% · CH 1 · IN FLIGHT');
    await page.evaluate(() => EnergyWeapon.advance(600));
    // WED 120 on a 50 SEO quadrant: the shield stops 50 and 70/120 of the 40 WKD reaches the hull.
    await expect(page.locator('#lastShot')).toHaveText('100% · CH 1 · shield 50.0 · hull KD 23.3');
    await page.locator('#historyBtn').click();
    await expect(page.locator('#historyList .shot')).toContainText('shield stopped 50.0 · hull KD 23.3');
  },
  'a station is a target: its shield ring and strength show, and a shot drains the shield': async ({ open }) => {
    const page = await open(QUIET_CANNON);
    const point = await page.evaluate(() => EnergyWeapon.tapPoint('body:cislunar-relay'));
    assert.ok(point, 'the relay station is on the scope');
    await page.mouse.click(point.x, point.y);
    await expect(page.locator('#targetName')).toHaveText('Cislunar Relay Station');
    await expect(page.locator('#targetKind')).toHaveText('STATION');
    await expect(page.locator('#shieldBlock')).toBeHidden();
    await expect(page.locator('#placeShieldValue')).toHaveText('10,000 / 10,000');
    await expect(page.locator('#placeShieldNote')).toHaveText(/^SHIELD UP 100% · 3\.2 km around it\.$/);
    await expect(page.locator('#targetSolution')).toHaveText('Aim by hand');
    await page.evaluate(() => EnergyWeapon.set({ aim: 10 }));
    await page.evaluate(() => EnergyWeapon.advance(1500));
    await page.locator('#armBtn').click();
    await page.locator('#fireBtn').click();
    await page.evaluate(() => EnergyWeapon.advance(11000));
    const shot = (await state(page)).flight[0];
    assert.equal(shot.hitPlace, 'Cislunar Relay Station');
    assert.ok(shot.shieldStopped > 0, 'the station\'s shield stopped the pulse');
    await expect(page.locator('#placeShieldValue')).not.toHaveText('10,000 / 10,000');
    await page.evaluate(() => DemoCombat.setPlaceShield('Cislunar Relay Station', false));
    await expect(page.locator('#placeShieldValue')).toHaveText('None raised');
  },
  'a training ship whose hull is gone stays on the scope as a wreck': async ({ open }) => {
    const page = await open(QUIET_CANNON);
    await placeShip(page, { bearing: 5, range: 6000, yaw: 90 });
    await page.evaluate(() => EnergyWeapon.set({ hulls: { 'Training ship A': 0 } }));
    await page.evaluate(() => EnergyWeapon.advance(200));
    const s = await state(page);
    assert.deepEqual(s.wrecks.filter(n => n.startsWith('Training')), ['Training ship A']);
    await tapShip(page);
    await expect(page.locator('#targetKind')).toHaveText('WRECK');
    await expect(page.locator('#targetPanel')).toHaveAttribute('data-affiliation', 'wreck');
  },
  'Menu → Phase cannons lists each weapon: charge, rate, fire power, damage, arc and range, critical damage and power': async ({ open }) => {
    const page = await open(QUIET_CANNON);
    await page.evaluate(() => DemoCombat.set('EPW3', ['range-halved']));
    await page.locator('#menuBtn').click();
    await page.locator('#openWeapons').click();
    await expect(page.locator('#menuTitle')).toHaveText('PHASE CANNONS');
    await expect(page.locator('#weaponsList .msection')).toHaveCount(3);
    await expect(page.locator('#weaponsList .msection h3').first()).toHaveText('CH 1 · Phase cannon EPW1');
    const third = page.locator('[data-weapon-slot="EPW3"]');
    await expect(third).toContainText('±45° · 45,000 km (halved from 90,000)');
    await expect(third).toContainText('Range halved');
    await expect(page.locator('[data-weapon-slot="EPW1"]')).toContainText('WED 120 · WKD 40');
  },
  'delegated fire and aim pass to the bridge, whose stand-ins are in the demo controls': async ({ open }) => {
    const page = await open(CANNON);
    await page.evaluate(() => EnergyWeapon.advance(1500));
    await page.locator('#armBtn').click();
    await page.locator('#delegateFireBtn').click();
    await expect(page.locator('#delegateFireBtn')).toHaveClass(/active/);
    await expect(page.locator('#fireMode')).toHaveText('BRIDGE FIRE');
    await page.locator('#fireBtn').click({ force: true });
    await expect(page.locator('#notice')).toHaveText('Fire control is delegated to the bridge.');
    await page.locator('#delegateAimBtn').click();
    await demo(page, async () => {
      await setField(page, 'bridgeAim', '-20');
      await page.locator('#bridgeFire').click();
    });
    const s = await state(page);
    assert.equal(s.aim, -20);
    assert.equal(s.flight.length, 1, 'the bridge fired');
    assert.equal(s.flight[0].aim, -20);
  },
  'Space and a right-click on the scope fire': async ({ open }) => {
    const page = await open(CANNON);
    await page.evaluate(() => EnergyWeapon.advance(1500));
    await page.locator('#armBtn').click();
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('Space');
    await page.mouse.click(700, 400, { button: 'right' });
    assert.equal((await state(page)).flight.length, 2);
  },
});
