// Tactical Officer Control: the tactical scanner fills the window; a tap selects a contact; the six weapons
// fire with lead and cool down; detailed scans reveal the target and its subsystems; the training ships fire
// back at our shields and hull; the view screen camera turns and zooms with a joystick and jumps to the four
// views; the readiness condition; and the demo controls in the menu.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const state = page => page.evaluate(() => TacticalOfficer.state());
const step = (page, n) => page.evaluate(count => TacticalOfficer.step(count), n);
const set = (page, values) => page.evaluate(v => TacticalOfficer.set(v), values);
const weapon = (page, id) => page.locator(`[data-weapon="${id}"]`);
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
    await expect(page.locator('[data-weapon] .wstate')).toHaveText(Array(6).fill('NO TARGET'));
    await expect(page.locator('#totalSeo')).toHaveText('400.0 / 400.0 SEO');
    await expect(page.locator('#ownHullValue')).toHaveText('500.0 / 500.0 · 100.0%');
    await expect(page.locator('#noTarget')).toBeVisible();
    await expect(page.locator('#conditionValue')).toHaveText('IV');
    await expect(page.locator('#advisory')).toHaveText('No target. Tap a contact on the scanner.');
    await expect(page.locator('.dock button')).toHaveText(['SCAN TARGET', 'SUBSYSTEMS', 'CLEAR TARGET', 'SHIELDS ON', 'VIEW SCREEN', 'CONDITION']);
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
    // Enemies are identified within 100 km.
    await set(page, { contacts: [{ range: 90000 }] });
    await expect(page.locator('#targetKind')).toHaveText('ENEMY');
    // Close in, the array reaches; Clear Target leaves nothing to fire at.
    await set(page, { contacts: [{ range: 40000 }] });
    await expect(weapon(page, 'EBW1').locator('.wstate')).toHaveText('READY');
    await page.locator('#clearBtn').click();
    await expect(page.locator('#noTarget')).toBeVisible();
    await expect(page.locator('#weaponsState')).toHaveText('NO TARGET');
  },
  'a detailed scan reveals the target; a subsystem can be picked at once, and locks within 25 km': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
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
  'a ship whose shields and hull are gone is destroyed and drops off the scanner': async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await tap(page, 'ship:Training ship A');
    await set(page, { contacts: [{ range: 30000, yaw: 168 }], targetShields: { 'Training ship A': { drain: [50, 50, 50, 50], flash: 0, hull: 10 } } });
    await weapon(page, 'TPD1').click();
    await step(page, 40);
    await expect(page.locator('#notice')).toHaveText('Training ship A destroyed.');
    await expect(page.locator('#noTarget')).toBeVisible();
    assert.equal(await page.evaluate(() => TacticalOfficer.tapPoint('ship:Training ship A')), null);
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
