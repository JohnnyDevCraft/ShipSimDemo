// Tactical Officer Control: the tactical scanner fills the window; a tap selects a contact; the six weapons
// fire with lead and cool down; detailed scans reveal the target and its subsystems; the training ships fire
// back at our shields and hull; the view screen camera turns and zooms with a joystick and jumps to the four
// views; the readiness condition; and the demo controls in the menu. Combat (live Beta9/10): hostile and wrecked contacts,
// AUTO TARGET, critical damage, the targeting computer offline, the last hit on us, station shields and Menu → Sensors.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const state = page => page.evaluate(() => TacticalOfficer.state());
const step = (page, n) => page.evaluate(count => TacticalOfficer.step(count), n);
const set = (page, values) => page.evaluate(v => TacticalOfficer.set(v), values);
const weapon = (page, id) => page.locator(`[data-weapon="${id}"]`);
// Weapons start safe (tests/tactical-weapons.cjs sets them up from the overlays); these cases start with every
// weapon armed and every tube loaded, as the demo's "Weapons ready on entry" switch does.
const readyWeapons = page => page.evaluate(() => TacticalOfficer.readyWeapons());
async function tap(page, key) {
  const point = await page.evaluate(k => TacticalOfficer.tapPoint(k), key);
  assert.ok(point, `${key} is on the scanner`);
  await page.mouse.click(point.x, point.y);
}
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
  for (const key of text) await pad.getByRole('button', { name: key, exact: true }).click();
  await page.locator('#menuDialog [data-save]').click();
}

run({
  'the scanner fills the window with the weapons, shields, target and range around it': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    const map = await page.locator('#map').boundingBox();
    assert.deepEqual([map.x, map.y, map.width, map.height], [0, 0, 1500, 1000]);
    await expect(page.locator('.scan-caption')).toHaveText('TACTICAL · SHORT RANGE SCAN · 200 KM RADIUS');
    await expect(page.locator('[data-weapon] .wname')).toHaveText(['CANNON 1', 'CANNON 2', 'TORPEDO 1', 'TORPEDO 2', 'ARRAY 1', 'CANNON 3']);
    await expect(page.locator('[data-weapon] .wstate')).toHaveText(['SAFE', 'SAFE', 'TUBE EMPTY', 'TUBE EMPTY', 'SAFE', 'SAFE']);
    await readyWeapons(page);
    await expect(page.locator('[data-weapon] .wstate')).toHaveText(Array(6).fill('NO TARGET'));
    await expect(page.locator('#totalSeo')).toHaveText('400.0 / 400.0 SEO');
    await expect(page.locator('#ownHullValue')).toHaveText('500.0 / 500.0 · 100.0%');
    await expect(page.locator('#noTarget')).toBeVisible();
    await expect(page.locator('#conditionValue')).toHaveText('IV');
    await expect(page.locator('#advisory')).toHaveText('No target. Tap a contact on the scanner.');
    await expect(page.locator('.dock button')).toHaveText(['SCAN TARGET', 'SUBSYSTEMS', 'AUTO TARGET', 'CLEAR TARGET', 'WEAPONS', 'SHIELDS ON', 'VIEW SCREEN', 'CONDITION']);
    // Shields on and off is a bottom-bar command; the panel only reports it.
    await expect(page.locator('.shields button')).toHaveCount(0);
    await expect(page.locator('#shieldsState')).toHaveText('ON');
    // The long range scan has its own range.
    await page.locator('.scan-tabs [data-mode="LRS"]').click();
    await expect(page.locator('.scan-caption')).toHaveText('TACTICAL · LONG RANGE SCAN · 30.0 LY RADIUS');
    await page.locator('.scan-tabs [data-mode="SRS"]').click();
    await expect(page.locator('.scan-caption')).toHaveText('TACTICAL · SHORT RANGE SCAN · 200 KM RADIUS');
  },
  'a tap selects a contact; the weapons fire with lead, hit and cool down; arc and range are checked': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await readyWeapons(page);
    await tap(page, 'ship:Training ship A');
    await expect(page.locator('#targetName')).toHaveText('Training ship A');
    await expect(page.locator('#targetKind')).toHaveText('UNKNOWN');
    await expect(page.locator('#tHull')).toHaveText('Unknown');
    await expect(weapon(page, 'EPW1').locator('.wstate')).toHaveText('READY');
    await expect(weapon(page, 'TPD2').locator('.wstate')).toHaveText('OUT OF ARC');
    await expect(weapon(page, 'EBW1').locator('.wstate')).toHaveText('OUT OF RANGE');
    await expect(weapon(page, 'TPD2')).toBeDisabled();
    await weapon(page, 'EPW1').click();
    await expect(page.locator('#notice')).toHaveText('Phaser cannon 1 fired at Training ship A.');
    await expect(weapon(page, 'EPW1').locator('.wstate')).toHaveText('CHARGING');
    assert.equal((await state(page)).shots.length, 1);
    // About seven seconds for the pulse to cross 110 km at 15 km/s; it drains the shield it meets.
    await step(page, 90);
    const after = await state(page);
    assert.equal(after.shots.length, 0);
    assert.ok(after.targetShields['Training ship A'].drain.some(d => d > 100), 'the pulse drained a shield quadrant');
    await expect(weapon(page, 'EPW1').locator('.wstate')).toHaveText('READY');
    // Enemies are identified within 100 km, and shown as hostile.
    await set(page, { contacts: [{ range: 90000 }] });
    await expect(page.locator('#targetKind')).toHaveText('HOSTILE');
    await expect(page.locator('#targetSub')).toHaveText('Starship · 430 m hull · hostile');
    // Close in, the array reaches; Clear Target leaves nothing to fire at.
    await set(page, { contacts: [{ range: 40000 }] });
    await expect(weapon(page, 'EBW1').locator('.wstate')).toHaveText('READY');
    await page.locator('#clearBtn').click();
    await expect(page.locator('#noTarget')).toBeVisible();
    await expect(page.locator('#weaponsState')).toHaveText('NO TARGET');
  },
  'a detailed scan reveals the target; a subsystem can be picked at once, and locks within 25 km': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await readyWeapons(page);
    await page.locator('#scanBtn').click();
    await expect(page.locator('#notice')).toHaveText('Select a ship to request a detailed scan.');
    await tap(page, 'ship:Training ship A');
    await page.locator('#scanBtn').click();
    await expect(page.locator('#scanStatus')).toHaveText(/^Scanning · shields up · 3× scan time · \d+%$/);
    await step(page, 91);
    await expect(page.locator('#notice')).toHaveText('Detailed scan of Training ship A complete.');
    await expect(page.locator('#scanStatus')).toHaveText('DETAILED SCAN COMPLETE');
    await expect(page.locator('#tHull')).toHaveText('500.0 / 500.0');
    await expect(page.locator('#tWeapons')).toHaveText('Safe · not armed');
    await expect(page.locator('#tPeople')).toHaveText('24');
    await expect(page.locator('#tCoils')).toHaveText('Idle · 0.0%');
    await page.locator('#subsystemsBtn').click();
    // Straight after the scan, about 100 km out, any working subsystem can be picked.
    await expect(page.locator('#subsystemGrid .subsystem')).toHaveCount(9);
    await expect(page.locator('#subsystemGrid .subsystem').first()).toBeEnabled();
    await expect(page.locator('#subsystemsStatus')).toHaveText('Training ship A · tap a subsystem to target it.');
    const generator = page.locator('#subsystemGrid .subsystem', { hasText: 'Shield generator' });
    await generator.click();
    await expect(generator).toHaveAttribute('aria-pressed', 'true');
    await expect(generator).toHaveAttribute('data-locked', 'false');
    await expect(page.locator('#notice')).toHaveText('Shield generator selected. It locks within 25 km.');
    await expect(page.locator('#subsystemsStatus')).toHaveText(/^Shield generator selected · locks within 25 km · now [\d,.]+ km\.$/);
    await page.locator('#subsystemsDialog [data-close]').click();
    await expect(page.locator('#tSubsystem')).toHaveText('Shield generator · NOT LOCKED');
    // Out of range the pick is not locked, so shots do not aim at it.
    await weapon(page, 'EPW1').click();
    assert.equal((await state(page)).shots.at(-1).targetSubsystem, '');
    // Within 25 km it locks, and shots aim at it.
    await set(page, { contacts: [{ range: 20000 }] });
    await step(page, 1);
    await expect(page.locator('#tSubsystem')).toHaveText('Shield generator · LOCKED');
    await expect(page.locator('#notice')).toHaveText('Subsystem locked: Shield generator on Training ship A.');
    await step(page, 20);
    await weapon(page, 'EPW1').click();
    assert.equal((await state(page)).shots.at(-1).targetSubsystem, 'module-3');
    await page.locator('#subsystemsBtn').click();
    await expect(generator).toHaveAttribute('data-locked', 'true');
    await expect(page.locator('#subsystemsStatus')).toHaveText(/^Shield generator locked · [\d,.]+ km\.$/);
    await page.locator('#subsystemsDialog [data-close]').click();
    // Back beyond 25 km the lock is lost but the pick is kept.
    await set(page, { contacts: [{ range: 30000 }] });
    await step(page, 1);
    await expect(page.locator('#notice')).toHaveText('Subsystem lock lost: Shield generator on Training ship A is beyond 25 km.');
    await expect(page.locator('#tSubsystem')).toHaveText('Shield generator · NOT LOCKED');
    await set(page, { contacts: [{ range: 20000 }] });
    // Coils charge in ten seconds once the demo starts them.
    await demo(page, () => page.locator('#demoCoils').click());
    await step(page, 50);
    await expect(page.locator('#tCoils')).toHaveText(/^Charging · warp preparation · (5\d|6\d)\.\d%$/);
    await step(page, 50);
    await expect(page.locator('#tCoils')).toHaveText('Charged · ready for warp · 100.0%');
  },
  'the training ship fires back: the shield facing it takes the hits, then the hull, and at zero the simulation ends': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    // Dead ahead of us at 20 km, nose toward us.
    await set(page, { contacts: [{ bearing: 0, range: 20000, yaw: 180 }] });
    await step(page, 20);
    let s = await state(page);
    assert.ok(s.drain[0] > 0 && s.drain[1] === 0 && s.drain[2] === 0 && s.drain[3] === 0, `the forward quadrant took the fire (${s.drain})`);
    assert.equal(s.hull, 500);
    await expect(page.locator('#advisory')).toHaveText(/^Incoming fire|^No target/);
    await page.locator('.dock #shieldsBtn').click();
    await expect(page.locator('#shieldsLabel')).toHaveText('SHIELDS OFF');
    await expect(page.locator('#shieldsBtn')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#shieldsState')).toHaveText('OFF');
    await expect(page.locator('#totalSeo')).toHaveText('0.0 / 400.0 SEO');
    await step(page, 20);
    s = await state(page);
    assert.ok(s.hull < 500, `with the shields off the hull takes the hits (${s.hull})`);
    await set(page, { hull: 1 });
    await step(page, 40);
    await expect(page.locator('#destroyedDialog')).toBeVisible();
    await expect(page.locator('#destroyedDialog')).toContainText('SHIP DESTROYED');
    await expect(page.locator('#advisory')).toHaveText('Ship destroyed. Simulation ended.');
    assert.equal((await state(page)).weapons.filter(w => w.can).length, 0);
    await page.locator('#restartBtn').click();
    await expect(page.locator('#destroyedDialog')).toBeHidden();
    await expect(page.locator('#ownHullValue')).toHaveText('500.0 / 500.0 · 100.0%');
  },
  'a ship whose shields and hull are gone is destroyed and stays on the scanner as a wreck no one fires at': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await readyWeapons(page);
    await tap(page, 'ship:Training ship A');
    await set(page, { contacts: [{ range: 30000, yaw: 168 }], targetShields: { 'Training ship A': { drain: [50, 50, 50, 50], flash: 0, hull: 10 } } });
    await weapon(page, 'TPD1').click();
    await step(page, 40);
    assert.deepEqual((await state(page)).destroyed, ['Training ship A']);
    // Still selected, now a wreck: grey, stopped, and nothing to fire at.
    await expect(page.locator('#targetPanel')).toBeVisible();
    await expect(page.locator('#targetKind')).toHaveText('WRECK');
    await expect(page.locator('#targetSub')).toHaveText('Starship · 430 m hull · wreck');
    await expect(page.locator('[data-weapon] .wstate')).toHaveText(Array(6).fill('NO TARGET'));
    await expect(page.locator('#advisory')).toHaveText(/^Training ship A · wreck · [\d,.]+ km\.$/);
    assert.ok(await page.evaluate(() => TacticalOfficer.tapPoint('ship:Training ship A')), 'the wreck is still on the scanner');
    const before = (await state(page)).contacts[0];
    await step(page, 30);
    const after = await state(page);
    assert.equal(after.contacts[0].speed, 0, 'the wreck has stopped');
    assert.equal(after.enemyShots.length, 0, 'the wreck fires no more');
    assert.ok(Math.abs(after.contacts[0].range - before.range) < 700, 'it moves on the scan only as we do');
    // A Scan Target on it is refused like an empty selection.
    await page.locator('#scanBtn').click();
    await expect(page.locator('#notice')).toHaveText('Select a ship to request a detailed scan.');
  },
  'hostile ships carry HOSTILE with their lock state; AUTO TARGET locks the nearest hostile and is lost to critical damage': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await set(page, { contacts: [{ range: 60000 }], demo: { scanKm: 100000 } });
    await page.locator('#demoAddShip').evaluate(b => b.click());
    await set(page, { contacts: [{}, { name: 'Training ship 2', bearing: 10, range: 40000 }] });
    // Auto target takes the nearest identified hostile in reach and sight.
    await page.locator('#autoTargetBtn').click();
    await expect(page.locator('#notice')).toHaveText('Auto target: locking on Training ship 2.');
    await expect(page.locator('#targetName')).toHaveText('Training ship 2');
    await expect(page.locator('#targetKind')).toHaveText('HOSTILE · LOCKING');
    await step(page, 100);
    await expect(page.locator('#targetKind')).toHaveText('HOSTILE · LOCKED');
    // Not hostile (enemy contacts off): CONTACT, then LOCKED once scanned.
    await page.locator('#demoHostile').evaluate(box => { box.checked = false; box.dispatchEvent(new Event('change')); });
    await page.evaluate(() => TacticalOfficer.select('ship:Training ship A'));
    await expect(page.locator('#targetKind')).toHaveText('CONTACT');
    // The targeting sensors' 'no-auto-target' critical disables the button (set from Menu → Critical damage).
    await page.locator('#menuBtn').click();
    await page.locator('#openCritical').click();
    await page.locator('#criticalDialog [data-component="targeting"] [data-effect="no-auto-target"]').click();
    await page.locator('#criticalDialog .mhead button').click();
    await expect(page.locator('#autoTargetBtn')).toBeDisabled();
    await expect(page.locator('#autoTargetBtn')).toHaveAttribute('title', 'Auto target unavailable (critical damage)');
    await expect(page.locator('#weaponCritical')).toHaveText('TARGETINGAuto target unavailable');
  },
  'critical damage: weapons list it and show CRIT, a halved range changes OUT OF RANGE, and shield SEO and quadrants follow': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await readyWeapons(page);
    await tap(page, 'ship:Training ship A');
    // A running ship holds its fire, so our shield figures stay put.
    await set(page, { contacts: [{ range: 80000 }], demo: { behavior: 'run' } });
    await expect(weapon(page, 'EBW1').locator('.wstate')).toHaveText('READY');
    await expect(page.locator('#weaponCritical')).toBeHidden();
    await page.evaluate(() => DemoCombat.set('EBW1', ['range-halved']));
    await expect(weapon(page, 'EBW1').locator('.wstate')).toHaveText('OUT OF RANGE');
    await expect(weapon(page, 'EBW1')).toHaveAttribute('data-critical', 'true');
    await expect(weapon(page, 'EBW1')).toHaveAttribute('title', /CRITICAL: Range halved/);
    await expect(weapon(page, 'EPW1')).toHaveAttribute('data-critical', 'false');
    await expect(page.locator('#weaponCritical li')).toHaveText(['ARRAY 1Range halved (50 km of 100 km)']);
    // Shields: SEO halved and one quadrant disabled.
    await expect(page.locator('#shieldCritical')).toBeHidden();
    await page.evaluate(() => DemoCombat.set('shields', ['quadrant-disabled', 'seo-halved']));
    await expect(page.locator('#shieldCritical li')).toHaveText(['SHIELDSOne shield quadrant disabled', 'SHIELDSShield SEO halved']);
    await expect(page.locator('#totalSeo')).toHaveText('150.0 / 150.0 SEO');
    await expect(page.locator('#ownQuadrants [data-qv="3"]')).toHaveText('0.0 SEO');
    await expect(page.locator('#ownQuadrants path[data-q="3"]')).toHaveAttribute('data-level', 'down');
    // Repairs clear it.
    await page.evaluate(() => DemoCombat.clearCritical());
    await expect(page.locator('#totalSeo')).toHaveText('400.0 / 400.0 SEO');
    await expect(weapon(page, 'EBW1').locator('.wstate')).toHaveText('READY');
  },
  'the targeting computer offline: a banner, no lead on the shots, and the advisory says to aim by hand': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await tap(page, 'ship:Training ship A');
    await set(page, { contacts: [{ range: 20000, yaw: 90 }] });
    await page.locator('#scanBtn').click();
    await step(page, 95);
    // Crossing at 2 km/s, read in one go so the page's own clock does not move the ship between the two.
    const crossing = () => page.evaluate(() => {
      const c = TacticalOfficer.state().contacts[0];
      TacticalOfficer.set({ contacts: [{ range: 20000, yaw: (c.bearing + 90) % 360, speed: 2000 }], demo: { enemyImpulse: 10 } });
      const s = TacticalOfficer.state();
      return { bearing: s.contacts[0].bearing, lead: s.weapons.find(w => w.id === 'EPW1').lead };
    });
    const led = await crossing();
    assert.ok(!led.lead.unguided && Math.abs(led.lead.bearing - led.bearing) > 2, `the computer leads a crossing target (${JSON.stringify(led)})`);
    await expect(page.locator('#targetingOffline')).toBeHidden();
    await page.evaluate(() => DemoCombat.set('targeting', ['targeting-computer-offline']));
    await expect(page.locator('#targetingOffline')).toBeVisible();
    await expect(page.locator('#targetingOffline')).toHaveText('TARGETING COMPUTER OFFLINE');
    await expect(page.locator('#advisory')).toHaveText('TARGETING COMPUTER OFFLINE · Training ship A locked: no guidance, aim by hand.');
    const offline = await crossing();
    assert.ok(offline.lead.unguided, 'no lead');
    assert.equal(offline.lead.bearing, offline.bearing, 'aimed where the target is now');
  },
  'the last hit on us shows for 8 seconds and flashes that side: shields held, then a hull hit naming the component': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await expect(page.locator('#lastHit')).toBeHidden();
    // The beam lands first, on the forward shield (read at once: the page's own clock keeps the fight going).
    const first = await page.evaluate(() => {
      TacticalOfficer.set({ contacts: [{ bearing: 0, range: 20000, yaw: 180 }] });
      TacticalOfficer.step(3);
      return TacticalOfficer.state().lastHit;
    });
    assert.equal(first.kind, 'shieldonly');
    assert.equal(first.side, 'forward');
    assert.equal(first.by, 'Training ship A');
    await expect(page.locator('#lastHit')).toBeVisible();
    await expect(page.locator('#lastHit')).toHaveText(/^(FORWARD SHIELDS HELD · [\d.]+ stopped|HIT FORWARD · .+) by Training ship A$/);
    // Shields off: the hull takes it, and a component is struck.
    await page.locator('#shieldsBtn').click();
    await step(page, 25);
    await expect(page.locator('#lastHit')).toHaveText(/^HIT FORWARD · (PULSE|BEAM|TORPEDO) · [\d.]+ hull damage · \w+ took [\d.]+.* by Training ship A$/);
    const hit = (await state(page)).lastHit;
    assert.ok(hit.hullDamage > 0 && hit.componentSlot, `a hull hit (${JSON.stringify(hit)})`);
    // A torpedo at full yield on the hull leaves critical damage on the component it struck, shared with every console.
    if (hit.critical) assert.ok(await page.evaluate(h => DemoCombat.has(h.componentSlot, h.critical), hit));
    // Out of reach, the line goes after 8 seconds.
    await set(page, { contacts: [{ range: 900000 }], demo: { enemyImpulse: 0 } });
    await step(page, 120);
    await expect(page.locator('#lastHit')).toBeHidden();
  },
  'a station shield shows on the target panel; Scan Target locks the station and our weapons drain its shield': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await readyWeapons(page);
    await page.evaluate(() => TacticalOfficer.select('body:Sol|Earth Orbital Station'));
    await expect(page.locator('#targetKind')).toHaveText('STATION');
    await expect(page.locator('#tShield')).toHaveText('SHIELD UP 100% · 10,000 / 10,000 · 8 km');
    await expect(page.locator('[data-weapon] .wstate')).toHaveText(Array(6).fill('NO LOCK'));
    await expect(page.locator('#advisory')).toHaveText('Earth Orbital Station selected · Scan Target to lock the targeting sensors on it.');
    await page.locator('#scanBtn').click();
    await expect(page.locator('#notice')).toHaveText('Locking on Earth Orbital Station.');
    await step(page, 1);
    await expect(page.locator('#scanStatus')).toHaveText(/^Waiting for target within 30,000 km · 0%$/);
    await set(page, { demo: { scanKm: 200000, cannonRangeKm: 200000, cannonSpeed: 1e8, cannonZeroKm: 300000, cannonFullKm: 250000 }, heading: 0 });
    await set(page, { demo: { ownImpulse: 0 } });
    await step(page, 35);
    await expect(page.locator('#notice')).toHaveText('Targeting sensors locked on Earth Orbital Station.');
    await expect(page.locator('#targetKind')).toHaveText('STATION · LOCKED');
    await expect(page.locator('#scanStatus')).toHaveText('TARGET LOCKED');
    // The station lies astern: the aft cannon reaches it.
    await expect(weapon(page, 'EPW3').locator('.wstate')).toHaveText('READY');
    await weapon(page, 'EPW3').click();
    await expect(page.locator('#notice')).toHaveText('Phaser cannon 3 fired at Earth Orbital Station.');
    await step(page, 15);
    await expect(page.locator('#tShield')).toHaveText('SHIELD UP 99% · 9,880 / 10,000 · 8 km');
    assert.equal(await page.evaluate(() => DemoCombat.placeShield('Earth Orbital Station').strength), 9880);
    // Drained from the menu: the panel follows.
    await page.evaluate(() => DemoCombat.setPlaceShield('Earth Orbital Station', true, 0));
    await expect(page.locator('#tShield')).toHaveText('SHIELD DRAINED · 0 / 10,000 · 8 km');
    // Clear Target drops the lock.
    await page.locator('#clearBtn').click();
    assert.equal((await state(page)).bodyLock, null);
  },
  'Menu → Sensors sets the power of the three sensors; the reach follows, and a scan waits for the targeting reach': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await page.locator('#menuBtn').click();
    await page.locator('#openSensors').click();
    await expect(page.locator('#menuTitle')).toHaveText('SENSORS');
    await expect(page.locator('#sensorControls [data-field="targeting"] [data-value]')).toHaveText('100%');
    await expect(page.locator('#sensorReach')).toHaveText(/^Targeting 30,000 km \(1 km–30,000 km\) · short-range 1 MKM · long-range 3\.000 LY \(0\.001–3 LY\)$/);
    await setField(page, 'targeting', '0');
    await expect(page.locator('#sensorControls [data-field="targeting"] [data-value]')).toHaveText('0%');
    await expect(page.locator('#sensorReach')).toHaveText(/^Targeting 1 km \(1 km–30,000 km\) · /);
    await page.evaluate(() => DemoCombat.set('srs', ['range-halved']));
    await expect(page.locator('#sensorReach')).toHaveText(/short-range 500,000 KM · .* · short-range: CRITICAL — Range halved$/i);
    await page.locator('#menuDialog [data-close]').last().click();
    await tap(page, 'ship:Training ship A');
    await page.locator('#scanBtn').click();
    await step(page, 2);
    await expect(page.locator('#scanStatus')).toHaveText(/^Waiting for target within 1 km · 0%$/);
  },
  'the view screen camera turns and zooms with the joystick, jumps to the four views, and the View Screen follows': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    const screen = await open('/ViewScreen/?models=0');
    await page.bringToFront();
    await page.locator('#cameraBtn').click();
    await expect(page.locator('#cameraDialog')).toBeVisible();
    await expect(page.locator('#cameraBearing')).toHaveText('000.0°');
    await expect(page.locator('[data-camera-view="forward"]')).toHaveAttribute('aria-pressed', 'true');
    // Full right for a second turns the camera 90°; full up for a second zooms in 2^1.2 times.
    await page.evaluate(() => TacticalOfficer.camera.hold(1, 0, 1));
    await expect(page.locator('#cameraBearing')).toHaveText('090.0°');
    await expect(page.locator('#cameraView')).toHaveText('STARBOARD VIEW');
    await expect(screen.locator('#caption')).toHaveText('STARBOARD VIEW · ZOOM 1× · SRS 1 BKM · LRS 30 LY');
    await page.evaluate(() => TacticalOfficer.camera.hold(0, 1, 1));
    await expect(page.locator('#cameraZoom')).toHaveText('2.3×');
    // Dragging the knob: right turns to starboard, down zooms out; letting go holds.
    const stick = await page.locator('#cameraStick').boundingBox();
    await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2);
    await page.mouse.down();
    await page.mouse.move(stick.x + stick.width * 0.85, stick.y + stick.height * 0.85, { steps: 4 });
    await page.waitForTimeout(600);
    await page.mouse.up();
    const after = await page.evaluate(() => ViewScreenSettings.read());
    assert.ok(after.camera > 90 && after.zoom < 2.3, `turned to starboard and zoomed out (${after.camera}°, ${after.zoom}×)`);
    const held = after.camera;
    await page.waitForTimeout(300);
    assert.equal((await page.evaluate(() => ViewScreenSettings.read())).camera, held, 'holds when let go');
    // The four buttons jump straight to the views.
    await page.locator('[data-camera-view="aft"]').click();
    await expect(page.locator('#cameraBearing')).toHaveText('180.0°');
    await expect(page.locator('[data-camera-view="aft"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(screen.locator('#caption')).toHaveText(/^AFT VIEW · ZOOM /);
    await page.locator('[data-camera-view="port"]').click();
    await expect(page.locator('#cameraBearing')).toHaveText('270.0°');
    await expect(screen.locator('#caption')).toHaveText(/^PORT VIEW · /);
    await page.locator('[data-camera-view="forward"]').click();
    await expect(screen.locator('#caption')).toHaveText(/^FORWARD VIEW · /);
    // The arrow keys push the stick halfway.
    await page.locator('#cameraStick').focus();
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(400);
    await page.keyboard.up('ArrowLeft');
    assert.ok((await page.evaluate(() => ViewScreenSettings.read())).camera > 300, 'the left arrow turned the camera to port');
  },
  'the readiness condition is set from its overlay and shown in the top bar': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await page.locator('#conditionBtn').click();
    await expect(page.locator('[data-condition]')).toHaveText(['I', 'II', 'III', 'IV', 'V']);
    await expect(page.locator('[data-condition="4"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-condition="1"]').click();
    await expect(page.locator('#conditionValue')).toHaveText('I');
    await expect(page.locator('#notice')).toHaveText('Condition I set.');
    await expect(page.locator('[data-condition="1"]')).toHaveAttribute('aria-pressed', 'true');
  },
  'the demo controls live in the menu: training ships, identification, our flight and weapon settings': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await expect(page.locator('#demoControls')).toBeHidden();
    await demo(page, async () => {
      await page.locator('#demoAddShip').click();
      await page.locator('#demoKnown').check({ force: true });
      await page.locator('#demoBehavior').selectOption('run');
      await setField(page, 'cannonPower', '50');
      await setField(page, 'ownImpulse', '0');
    });
    await readyWeapons(page);
    const s = await state(page);
    assert.equal(s.contacts.length, 2);
    assert.deepEqual(s.identified.sort(), ['Training ship 2', 'Training ship A']);
    assert.equal(s.demo.behavior, 'run');
    assert.equal(s.demo.cannonPower, 50);
    // Half power halves the cannon's damage and its recharge.
    await tap(page, 'ship:Training ship A');
    await weapon(page, 'EPW1').click();
    const shot = (await state(page)).shots[0];
    assert.equal(shot.wed, 60);
    const cooldown = (await state(page)).cooldowns.EPW1;
    assert.ok(cooldown <= 750 && cooldown > 400, `half the 1.5 s recharge (${cooldown} ms left)`);
    await page.locator('#menuBtn').click();
    await page.locator('#resetDemo').click();
    assert.equal((await state(page)).contacts.length, 1);
  },
});
