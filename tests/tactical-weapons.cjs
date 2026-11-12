// Tactical Officer Control runs every weapon when the ship is short of weapons officers: WEAPONS on the bottom bar
// (one button, John 2026-11-12) opens an overlay of the weapon types, then the ship's weapons of the type chosen. A torpedo launcher takes a warhead
// set-up (yield, impact or proximity and impact, distance from target), assembles a round, keeps six ready with
// auto assemble and feeds its tube with auto load and auto arm; an energy weapon takes its shot power and is
// armed. Armed weapons fire from the weapons panel at the selected target.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const state = page => page.evaluate(() => TacticalOfficer.state());
const step = (page, n) => page.evaluate(count => TacticalOfficer.step(count), n);
const set = (page, values) => page.evaluate(v => TacticalOfficer.set(v), values);
const weapon = (page, id) => page.locator(`[data-weapon="${id}"]`);
const dialog = page => page.locator('#weaponsDialog');
async function tap(page, key) {
  const point = await page.evaluate(k => TacticalOfficer.tapPoint(k), key);
  assert.ok(point, `${key} is on the scanner`);
  await page.mouse.click(point.x, point.y);
}
// Moves a vertical slider to a value with the keys, as a keyboard user would.
async function slide(page, selector, value, min) {
  await page.locator(selector).focus();
  await page.keyboard.press('Home');
  for (let v = min; v < value; v++) await page.keyboard.press('ArrowUp');
  await expect(page.locator(selector)).toHaveAttribute('aria-valuenow', String(value));
}
// WEAPONS, then a weapon type (TPD, EPW or EBW): the ship's weapons of that type.
async function openKind(page, kind) {
  await page.locator('#weaponsBtn').click();
  await page.locator(`#weaponKinds [data-kind="${kind}"]`).click();
  await expect(page.locator('#weaponsList')).toBeVisible();
}
async function openLauncher(page, id) {
  await openKind(page, 'TPD');
  await page.locator(`#weaponsList [data-choose="${id}"]`).click();
  await expect(page.locator('#torpedoDetail')).toBeVisible();
}

run({
  'the bottom bar has one WEAPONS button; weapons start safe; the overlay offers the weapon types, then lists the ship’s weapons of each': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await expect(page.locator('.dock button')).toHaveText(['SCAN TARGET', 'SUBSYSTEMS', 'AUTO TARGET', 'CLEAR TARGET', 'WEAPONS', 'SHIELDS ON', 'VIEW SCREEN', 'CONDITION']);
    await expect(page.locator('[data-weapon] .wstate')).toHaveText(['SAFE', 'SAFE', 'TUBE EMPTY', 'TUBE EMPTY', 'SAFE', 'SAFE']);
    await tap(page, 'ship:Training ship A');
    await expect(page.locator('#advisory')).toHaveText(/no weapon armed: arm them from Weapons\.$/);
    // WEAPONS: the three weapon types first, a card each, all safe.
    await page.locator('#weaponsBtn').click();
    await expect(dialog(page)).toBeVisible();
    await expect(page.locator('#weaponsTitle')).toHaveText('WEAPONS');
    await expect(page.locator('#weaponsBack')).toBeHidden();
    await expect(page.locator('#weaponsList')).toBeHidden();
    await expect(page.locator('#weaponKinds .wc-head b')).toHaveText(['TORPEDO LAUNCHERS', 'EPW · PHASE CANNONS', 'EBW · PHASER ARRAYS']);
    await expect(page.locator('#weaponKinds [data-wc-state]')).toHaveText(['ALL SAFE', 'ALL SAFE', 'ALL SAFE']);
    await expect(page.locator('#weaponKinds [data-wc-line]')).toHaveText(['0 IN THE RACKS · 0 / 2 TUBES LOADED', '3 CANNONS · 0 READY TO FIRE', '1 ARRAY · 0 READY TO FIRE']);
    await expect(page.locator('#weaponsChip')).toHaveText('0 / 6 ARMED');
    // Torpedoes: one card per launcher; ‹ goes back to the weapon types.
    await page.locator('#weaponKinds [data-kind="TPD"]').click();
    await expect(page.locator('#weaponsTitle')).toHaveText('TORPEDO LAUNCHERS');
    await expect(page.locator('#weaponKinds')).toBeHidden();
    await expect(page.locator('#weaponsBack')).toHaveAttribute('aria-label', 'Back to the weapon types');
    await expect(page.locator('#weaponsList .wc-head b')).toHaveText(['TORPEDO 1', 'TORPEDO 2']);
    await expect(page.locator('#weaponsList .wc-head small')).toHaveText(['FORWARD ±30°', 'AFT ±30°']);
    await expect(page.locator('#weaponsList [data-wc-state]')).toHaveText(['TUBE EMPTY', 'TUBE EMPTY']);
    await expect(page.locator('#weaponsList [data-wc-line]').first()).toHaveText('RACK 0 / 6 · 8 WARHEADS LEFT');
    await expect(page.locator('#weaponsChip')).toHaveText('0 / 2 ARMED');
    // The three auto switches start off: nothing is assembled from stock until the officer asks.
    for (const flag of await page.locator('#weaponsList [data-flag]').all()) await expect(flag).toHaveAttribute('data-on', 'false');
    // Escape closes the overlay.
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    // EPW: the phase cannons; EBW: the phaser array.
    await openKind(page, 'EPW');
    await expect(page.locator('#weaponsTitle')).toHaveText('EPW · PHASE CANNONS');
    await expect(page.locator('#weaponsList .wc-head b')).toHaveText(['CANNON 1', 'CANNON 2', 'CANNON 3']);
    await expect(page.locator('#weaponsList [data-wc-state]')).toHaveText(['SAFE', 'SAFE', 'SAFE']);
    await page.locator('#weaponsDialog [data-close]').click();
    await expect(dialog(page)).toBeHidden();
    await openKind(page, 'EBW');
    await expect(page.locator('#weaponsTitle')).toHaveText('EBW · PHASER ARRAYS');
    await expect(page.locator('#weaponsList .wc-head b')).toHaveText(['ARRAY 1']);
    await expect(page.locator('#weaponsList .wc-head small')).toHaveText(['ALL ROUND']);
  },
  'a launcher is set up for warheads and assembles one round into its ready rack': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await openLauncher(page, 'TPD1');
    await expect(page.locator('#weaponsTitle')).toHaveText('TORPEDO LAUNCHER · TORPEDO 1');
    await expect(page.locator('#weaponsBack')).toBeVisible();
    // Full power to start (John, 2026-11-11), impact, the auto switches off.
    await expect(page.locator('#tdYield')).toHaveText('100%');
    await expect(page.locator('#tdDamage')).toHaveText('WED 30.0 · WKD 150.0');
    await expect(page.locator('#tdYieldSlider')).toHaveAttribute('aria-valuenow', '100');
    await expect(page.locator('#tdTrigger [data-trigger="Impact"]')).toHaveAttribute('aria-pressed', 'true');
    for (const id of ['tdAutoAssemble', 'tdAutoLoad', 'tdAutoArm']) await expect(page.locator('#' + id)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#tdProximity')).toBeHidden();
    await expect(page.locator('#tdTriggerNote')).toHaveText('Detonates on impact with the target.');
    // Yield 80%, proximity and impact at 150 m.
    await slide(page, '#tdYieldSlider', 80, 0);
    await expect(page.locator('#tdYield')).toHaveText('80%');
    await expect(page.locator('#tdDamage')).toHaveText('WED 24.0 · WKD 120.0');
    await page.locator('#tdTrigger [data-trigger="Proximity"]').click();
    await expect(page.locator('#tdTrigger [data-trigger="Proximity"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tdProximity')).toBeVisible();
    await page.locator('#tdProximity').click();
    const pad = page.locator('#weaponsPad .keypad');
    await expect(pad).toBeVisible();
    await expect(page.locator('#torpedoDetail')).toBeHidden();
    // Escape steps back from the keypad without closing the overlay.
    await page.keyboard.press('Escape');
    await expect(pad).toBeHidden();
    await expect(page.locator('#torpedoDetail')).toBeVisible();
    await page.locator('#tdProximity').click();
    await pad.getByRole('button', { name: 'Clear' }).click();
    for (const key of '150') await pad.getByRole('button', { name: key, exact: true }).click();
    await page.locator('#weaponsPad [data-save]').click();
    await expect(page.locator('#tdProximityValue')).toHaveText('150 m');
    await expect(page.locator('#tdTriggerNote')).toHaveText('Detonates within 150 m of the target’s hull, or on impact.');
    // Assemble one round: ten seconds, then it waits in the rack.
    await page.locator('#tdAssemble').click();
    await expect(page.locator('#weaponsStatus')).toHaveText('Assembling round #1: 80% · proximity 150 m.');
    // The page's own clock keeps running, so times are checked loosely.
    await expect(page.locator('#tdAssembly')).toHaveText(/^#1 · \d% · (10|9) s LEFT$/);
    await expect(page.locator('#tdStock')).toHaveText('11 hulls · 7 warheads');
    // A blocked command says why (it is marked aria-disabled, so the click is forced).
    await expect(page.locator('#tdAssemble')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('#tdAssemble').click({ force: true });
    await expect(page.locator('#weaponsStatus')).toHaveText('Round #1 is being assembled. One at a time.');
    await step(page, 50);
    await expect(page.locator('#tdAssembly')).toHaveText(/^#1 · 5\d% · 5 s LEFT$/);
    await step(page, 50);
    await expect(page.locator('#tdAssembly')).toHaveText('IDLE');
    await expect(page.locator('#tdRackCount')).toHaveText('1 / 6');
    await expect(page.locator('#tdRack .rslot[data-filled="true"] b')).toHaveText(['#1']);
    await expect(page.locator('#tdRack .rslot[data-filled="true"] span')).toHaveText(['80% · PROXIMITY 150 m']);
    await expect(page.locator('#tdRack .rslot:not([data-filled])')).toHaveCount(5);
    await expect(page.locator('#tdTubeTitle')).toHaveText('TUBE EMPTY');
    // Back to the list: the card shows the rack.
    await page.locator('#weaponsBack').click();
    await expect(page.locator('#weaponsList [data-wc-line]').first()).toHaveText('RACK 1 / 6 · 7 WARHEADS LEFT');
    // The other launcher keeps its own set-up.
    await page.locator('#weaponsList [data-choose="TPD2"]').click();
    await expect(page.locator('#tdYield')).toHaveText('100%');
    await expect(page.locator('#tdRackCount')).toHaveText('0 / 6');
  },
  'auto assemble keeps six rounds ready, and builds another when one is loaded': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await openLauncher(page, 'TPD1');
    await page.locator('#tdAutoAssemble').click();
    await expect(page.locator('#tdAutoAssemble')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#weaponsStatus')).toHaveText('TORPEDO 1 · Auto assemble on: six rounds kept ready to this set-up.');
    await step(page, 550);
    await expect(page.locator('#tdRackCount')).toHaveText('5 / 6');
    await step(page, 60);
    await expect(page.locator('#tdRackCount')).toHaveText('6 / 6');
    await expect(page.locator('#tdAssembly')).toHaveText('RACK FULL · WAITING');
    await expect(page.locator('#tdStock')).toHaveText('6 hulls · 2 warheads');
    await page.locator('#tdAssemble').click({ force: true });
    await expect(page.locator('#weaponsStatus')).toHaveText('Ready rack full. Load or fire a round before another can be assembled.');
    // Load one by hand: the rack drops to five and auto assemble builds the sixth again.
    await page.locator('#tdLoad').click();
    await expect(page.locator('#tdTubeTitle')).toHaveText(/^LOADING #1 · \d+%$/);
    await expect(page.locator('#tdRackCount')).toHaveText('5 / 6');
    await expect(page.locator('#tdAssembly')).toHaveText(/^#7 · /);
    await step(page, 26);
    await expect(page.locator('#tdTubeTitle')).toHaveText('#1 LOADED · SAFE');
    await step(page, 80);
    await expect(page.locator('#tdRackCount')).toHaveText('6 / 6');
    await expect(page.locator('#tdStock')).toHaveText('5 hulls · 1 warhead');
  },
  'with auto load and auto arm on the launcher feeds itself, and Tactical fires it at the target': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await tap(page, 'ship:Training ship A');
    // A training ship that holds still and does not fire back while the launcher fills.
    await set(page, { contacts: [{ range: 30000 }], demo: { behavior: 'run', enemyImpulse: 0, ownImpulse: 0 } });
    await openLauncher(page, 'TPD1');
    await page.locator('#tdAutoAssemble').click();
    await page.locator('#tdAutoLoad').click();
    await page.locator('#tdAutoArm').click();
    await expect(page.locator('#tdFire')).toHaveText('TUBE EMPTY');
    // The first round is assembled in 10 s, loaded in 2.5 s and armed; the rack fills behind it.
    await step(page, 101);
    await expect(page.locator('#tdTubeTitle')).toHaveText(/^(LOADING #1|#1 ARMED)/);
    await step(page, 150);
    await expect(page.locator('#tdTubeTitle')).toHaveText('#1 ARMED');
    await expect(page.locator('#tdRackCount')).toHaveText(/^[12] \/ 6$/);
    await expect(page.locator('#tdFire')).toHaveText('READY');
    await expect(page.locator('#weaponsBtn')).toHaveAttribute('data-armed', 'true');
    await page.locator('#weaponsBack').click();
    await expect(page.locator('#weaponsList [data-wc-state]').first()).toHaveText('#1 ARMED');
    await expect(page.locator('#weaponsList [data-choose="TPD1"] [data-flag]')).toHaveText(['AUTO ASSEMBLE', 'AUTO LOAD', 'AUTO ARM']);
    for (const flag of await page.locator('#weaponsList [data-choose="TPD1"] [data-flag]').all()) await expect(flag).toHaveAttribute('data-on', 'true');
    await page.locator('#weaponsDialog [data-close]').click();
    // Tactical's weapons panel fires it.
    await expect(weapon(page, 'TPD1').locator('.wstate')).toHaveText('READY');
    await weapon(page, 'TPD1').click();
    await expect(page.locator('#notice')).toHaveText('Torpedo 1 fired at Training ship A.');
    let s = await state(page);
    assert.equal(s.shots.at(-1).key, 'TPD');
    assert.equal(s.shots.at(-1).wed, 30, 'a full-yield warhead');
    assert.equal(s.shots.at(-1).wkd, 150, 'a full-yield warhead');
    assert.equal(s.launchers.TPD1.tube, null);
    // The next round comes straight through from the rack.
    await expect(weapon(page, 'TPD1').locator('.wstate')).toHaveText('LOADING');
    await step(page, 26);
    s = await state(page);
    assert.equal(s.launchers.TPD1.tube.id, 2);
    assert.equal(s.launchers.TPD1.armed, true);
    await expect(weapon(page, 'TPD1').locator('.wstate')).toHaveText('READY');
  },
  'a proximity warhead goes off within its distance of the target': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await tap(page, 'ship:Training ship A');
    // Dead ahead, 20 km, side on; a 2 km proximity round armed in the tube.
    await set(page, { contacts: [{ bearing: 0, range: 20000, yaw: 90 }], demo: { enemyImpulse: 0, ownImpulse: 0 } });
    await page.evaluate(() => {
      const s = TacticalOfficer.state();
      TacticalOfficer.set({ launchers: { ...s.launchers, TPD1: { ...s.launchers.TPD1, tube: { id: 1, type: 'Warhead', yield: 100, trigger: 'Proximity', proximity: 2000, wed: 30, wkd: 150 }, armed: true } } });
    });
    await weapon(page, 'TPD1').click();
    await step(page, 25);
    const s = await state(page);
    assert.equal(s.shots.length, 0, 'the warhead has gone off');
    assert.ok(s.explosions.length || s.targetShields['Training ship A'], 'it exploded');
    assert.ok(s.targetShields['Training ship A'].drain.some(d => d >= 30), 'the shield facing it took the warhead');
  },
  'EPW: a cannon’s shot power is set and it is armed, then it fires from Tactical': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await tap(page, 'ship:Training ship A');
    await openKind(page, 'EPW');
    await page.locator('#weaponsList [data-choose="EPW1"]').click();
    await expect(page.locator('#energyDetail')).toBeVisible();
    await expect(page.locator('#weaponsTitle')).toHaveText('EPW · CANNON 1');
    await expect(page.locator('#edPower')).toHaveText('100%');
    await expect(page.locator('#edFire')).toHaveText('SAFE');
    await slide(page, '#edPowerSlider', 50, 1);
    await expect(page.locator('#edPower')).toHaveText('50%');
    await expect(page.locator('#edDamage')).toHaveText('WED 60.0 · WKD 20.0');
    await expect(page.locator('#edRecharge')).toHaveText('0.8 s to 50%');
    await page.locator('#edArm').click();
    await expect(page.locator('#edArm')).toHaveText('SAFE');
    await expect(page.locator('#edArm')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#weaponsStatus')).toHaveText('Phaser cannon 1 armed.');
    await expect(page.locator('#edFire')).toHaveText('READY');
    await page.locator('#weaponsBack').click();
    await expect(page.locator('#weaponsList [data-wc-state]')).toHaveText(['ARMED · READY', 'SAFE', 'SAFE']);
    await expect(page.locator('#weaponsChip')).toHaveText('1 / 3 ARMED');
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(weapon(page, 'EPW1').locator('.wstate')).toHaveText('READY');
    await expect(weapon(page, 'EPW2').locator('.wstate')).toHaveText('SAFE');
    await expect(weapon(page, 'EPW2')).toBeDisabled();
    await weapon(page, 'EPW1').click();
    await expect(page.locator('#notice')).toHaveText('Phaser cannon 1 fired at Training ship A.');
    const s = await state(page);
    assert.equal(s.shots.at(-1).wed, 60);
    assert.ok(s.cooldowns.EPW1 <= 750 && s.cooldowns.EPW1 > 400, `half the 1.5 s recharge at half power (${s.cooldowns.EPW1} ms left)`);
    await expect(weapon(page, 'EPW1').locator('.wstate')).toHaveText('CHARGING');
    // Made safe again, it no longer fires.
    await openKind(page, 'EPW');
    await page.locator('#weaponsList [data-choose="EPW1"]').click();
    await expect(page.locator('#edCharge')).toHaveText(/^CHARGING · \d+%$/);
    await page.locator('#edArm').click();
    await page.locator('#weaponsDialog [data-close]').click();
    await step(page, 10);
    await expect(weapon(page, 'EPW1').locator('.wstate')).toHaveText('SAFE');
  },
  'EBW: the array’s shot power is set and it is armed, then it fires its beam from Tactical': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await tap(page, 'ship:Training ship A');
    await set(page, { contacts: [{ range: 40000 }] });
    await openKind(page, 'EBW');
    await page.locator('#weaponsList [data-choose="EBW1"]').click();
    await expect(page.locator('#weaponsTitle')).toHaveText('EBW · ARRAY 1');
    await expect(page.locator('#edChargeLabel')).toHaveText('CAPACITOR CHARGE');
    await expect(page.locator('#edFacing')).toHaveText('All round');
    await slide(page, '#edPowerSlider', 80, 1);
    await expect(page.locator('#edDamage')).toHaveText('WED 48.0 · WKD 48.0');
    await page.locator('#edArm').click();
    await expect(page.locator('#edFire')).toHaveText('READY');
    await expect(page.locator('#weaponsBtn')).toHaveAttribute('data-armed', 'true');
    await page.locator('#weaponsDialog [data-close]').click();
    await weapon(page, 'EBW1').click();
    await expect(page.locator('#notice')).toHaveText('Phaser array 1 fired at Training ship A.');
    const s = await state(page);
    assert.equal(s.beam.wed, 48);
    await expect(weapon(page, 'EBW1').locator('.wstate')).toHaveText('CHARGING');
  },
  'the demo switch readies every weapon, and Reset demo starts from it': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('#demoWeaponsReady').check({ force: true });
    await page.locator('#menuDialog [data-close]').last().click();
    await expect(page.locator('[data-weapon] .wstate')).toHaveText(Array(6).fill('NO TARGET'));
    let s = await state(page);
    assert.equal(s.launchers.TPD2.rack.length, 3);
    assert.equal(s.launchers.TPD2.autoLoad && s.launchers.TPD2.autoArm, true);
    await page.locator('#menuBtn').click();
    await page.locator('#resetDemo').click();
    await expect(page.locator('[data-weapon] .wstate')).toHaveText(Array(6).fill('NO TARGET'));
  },
  'a torpedo fired at a locked station leaves from the tube with its warhead': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await page.evaluate(() => TacticalOfficer.readyWeapons());
    await page.evaluate(() => TacticalOfficer.select('body:Sol|Earth Orbital Station'));
    await set(page, { demo: { scanKm: 200000, torpedoRangeKm: 200000, torpedoSpeed: 1e8, ownImpulse: 0 }, heading: 0 });
    await page.locator('#scanBtn').click();
    await step(page, 35);
    await expect(page.locator('#targetKind')).toHaveText('STATION · LOCKED');
    // Auto load off, so the tube stays empty after the shot.
    let s = await state(page);
    await set(page, { launchers: { ...s.launchers, TPD2: { ...s.launchers.TPD2, autoLoad: false } } });
    // The station lies astern: the aft launcher reaches it.
    await expect(weapon(page, 'TPD2').locator('.wstate')).toHaveText('READY');
    await weapon(page, 'TPD2').click();
    await expect(page.locator('#notice')).toHaveText('Torpedo 2 fired at Earth Orbital Station.');
    s = await state(page);
    assert.equal(s.placeShots.at(-1).wed, 30, 'the full-yield round from the tube');
    assert.equal(s.launchers.TPD2.tube, null);
    await expect(weapon(page, 'TPD2').locator('.wstate')).toHaveText('TUBE EMPTY');
  },
});
