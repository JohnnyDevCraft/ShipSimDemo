// Flying Helm Control: the helm has to be on course, charged, at zero impulse and with the external dampener field
// down to engage warp (the coils may charge with it up), and leaving warp discharges the coils and brings the field back up. Warp is set in warp factors from 0.25 up to the ship's rating.
// TRACK keeps the course on a contact selected on the scanner; QUICK JUMP warps a set distance straight ahead.
// Keyboard commands fly the helm, and Menu → Keyboard commands changes them on this device.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

// Selects a contact on the scanner by clicking where the map drew it.
async function selectContact(page, name) {
  await page.waitForTimeout(200);
  const contact = await page.evaluate(wanted => mapContacts.find(candidate => candidate.name === wanted), name);
  assert.ok(contact, `the scanner shows ${name}`);
  await page.locator('#map').click({ position: { x: contact.x, y: contact.y }, force: true });
  await expect(page.locator('#contactChip')).toContainText(name);
}
// A stand-in game controller (standard mapping): tests set window.testPad.axes and .buttons[i].pressed.
const PAD_SCRIPT = () => {
  window.testPad = { id: 'Test Pad (STANDARD GAMEPAD)', mapping: 'standard', connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  navigator.getGamepads = () => [window.testPad];
};
const padButton = (page, index, pressed) => page.evaluate(([i, down]) => { window.testPad.buttons[i] = { pressed: down, value: down ? 1 : 0 }; }, [index, pressed]);
const padAxis = (page, index, value) => page.evaluate(([i, v]) => { window.testPad.axes[i] = v; }, [index, value]);
const bearingTo = (page, name) => page.evaluate(wanted => NavWorld.bearingTo(ship, worldObjects().find(object => object.name === wanted)), name);
const headingNow = async page => parseFloat(await page.locator('#headingValue').innerText());
const headingOff = (heading, bearing) => Math.abs(((heading - bearing + 540) % 360) - 180);
// Sets the quick jump distance on the dialog's keypad and picks its unit.
async function setJumpDistance(page, digits, unit) {
  await page.locator(`#jumpUnit [data-unit="${unit}"]`).click();
  await page.locator('#jumpDialog [data-field="distance"] [data-edit]').click();
  await page.keyboard.type(digits);
  await page.keyboard.press('Enter');
  await expect(page.locator('#jumpDialog [data-field="distance"] [data-value]')).toHaveText(`${Number(digits).toLocaleString('en-US')} ${unit}`);
}

run({
  'helm aligns, charges, engages and exits warp': async ({ open }) => {
    const page = await open('/Helm/');
    await page.locator('#warpTab').click();
    await expect(page.locator('#warpPane')).toBeVisible();
    await expect(page.locator('#impulsePane')).toBeHidden();
    await expect(page.locator('#extField')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#chargeBtn').click(); // the coils charge with the external field up
    await expect(page.locator('#chargeValue')).toHaveText('100%', { timeout: 15000 });
    await expect(page.locator('#engage')).toBeDisabled(); // charged, but not on course
    await page.locator('#alignBtn').click();
    await expect(page.locator('.heading')).toHaveAttribute('data-lock', 'COURSE LOCK', { timeout: 40000 });
    await expect(page.locator('#headingValue')).toHaveText('047.0°');
    await expect(page.locator('#engage')).toBeDisabled(); // on course, but the external field is up
    await expect(page.locator('#engineNote')).toHaveText(/external dampener field off to engage warp/);
    await page.locator('#extField').click();
    await expect(page.locator('#extField')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#engage')).toBeEnabled();
    await page.locator('#engage').click();
    await expect(page.locator('#state')).toHaveText('AT WARP');
    await expect(page.locator('#alignBtn')).toBeDisabled();
    await expect(page.locator('#impulse')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('[data-mode="SRS"]').click();
    await expect(page.locator('#srsBlank')).toBeVisible(); // SRS cannot scan at warp
    await page.locator('[data-mode="LRS"]').click();
    await expect(page.locator('#srsBlank')).toBeHidden();
    await expect(page.locator('#extField')).toBeDisabled(); // cannot come up at warp
    await page.locator('#engage').click();
    await expect(page.locator('#state')).toHaveText('SUBLIGHT');
    await expect(page.locator('#chargeValue')).toHaveText('0%');
    await expect(page.locator('#extField')).toHaveAttribute('aria-pressed', 'true'); // up again on leaving warp
    await expect(page.locator('#targetName')).toHaveText('Gliese 1061');
  },
  'TRACK keeps the course on a contact selected on the scanner until the helmsman steers by hand': async ({ open }) => {
    const page = await open('/Helm/');
    const track = page.locator('.dock #trackBtn');
    await expect(track).toBeDisabled(); // nothing selected yet
    await expect(track).toHaveAttribute('aria-pressed', 'false');
    await selectContact(page, 'Tau Ceti');
    await expect(track).toBeEnabled();
    await track.click();
    await expect(track).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#notice')).toContainText('Tracking Tau Ceti');
    await expect(page.locator('#contactChip')).toContainText('TRACKING · Tau Ceti');
    const lit = await track.locator('.ring').evaluate(ring => getComputedStyle(ring).backgroundImage);
    assert.match(lit, /radial-gradient/); // lit while on
    await expect(page.locator('.heading')).toHaveAttribute('data-lock', 'COURSE LOCK', { timeout: 60000 });
    assert.ok(headingOff(await headingNow(page), await bearingTo(page, 'Tau Ceti')) <= 0.1, 'the heading is on Tau Ceti');
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '0'); // course only: impulse stays the helmsman's
    await expect(page.locator('#impulse')).not.toHaveAttribute('aria-disabled', 'true');
    await page.locator('#map').click({ position: { x: 600, y: 120 }, force: true }); // select nothing
    await expect(page.locator('#contactChip')).toContainText('TRACKING · Tau Ceti'); // the tracked contact stays on the chip
    await page.locator('#joystick').focus();
    await page.keyboard.down('ArrowLeft');
    await expect(track).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.up('ArrowLeft');
    await expect(page.locator('#notice')).toHaveText('Tracking off · steering by hand.');
    await expect(track).toBeDisabled(); // the selection was cleared, so there is nothing to track
  },
  'TRACK turns the course after the contact as the ship moves, and pressing it again stops tracking': async ({ open }) => {
    const page = await open('/Helm/');
    await page.locator('[data-mode="SRS"]').click();
    await page.evaluate(() => setZoom(zoomFor(rangeScales.SRS, 1e6)));
    await selectContact(page, 'Moon');
    await page.locator('#trackBtn').click();
    await expect(page.locator('.heading')).toHaveAttribute('data-lock', 'COURSE LOCK', { timeout: 60000 });
    const first = await headingNow(page);
    assert.ok(headingOff(first, await bearingTo(page, 'Moon')) <= 0.1, 'the heading is on the Moon');
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('#placeStation').click(); // the ship moves; the Moon is now on another bearing
    const second = await bearingTo(page, 'Moon');
    assert.ok(headingOff(first, second) > 1, 'the Moon has moved on the compass');
    await expect(page.locator('#contactChip')).toContainText('TRACKING · Moon');
    await expect.poll(async () => headingOff(await headingNow(page), second), { timeout: 60000 }).toBeLessThanOrEqual(0.1);
    await page.locator('#trackBtn').click();
    await expect(page.locator('#trackBtn')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#notice')).toHaveText('Tracking off · the helm holds its heading.');
  },
  'QUICK JUMP warps the distance set straight ahead, keeps the ship moving and needs the coils charged again': async ({ open }) => {
    const page = await open('/Helm/');
    await page.locator('#impulse').focus();
    for (let step = 0; step < 20; step++) await page.keyboard.press('ArrowUp'); // slowly enough to pass TNS Endeavor without an approach limit
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '20');
    await page.waitForTimeout(2000);
    await page.keyboard.press('Home'); // coast: the coils charge only at zero impulse
    await page.locator('#warpTab').click();
    await page.locator('#warp').focus();
    await page.keyboard.press('Home');
    for (let step = 0; step < 7; step++) await page.keyboard.press('ArrowUp');
    await expect(page.locator('#driveSetting')).toHaveText('WF 2.00');
    await page.locator('.dock #quickJumpBtn').click();
    const dialog = page.locator('#jumpDialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#jumpWarp')).toHaveText('WF 2.00');
    await expect(page.locator('#jumpCoils')).toHaveText('0% · charge them');
    await expect(page.locator('#jumpField')).toHaveText('On · switch it off');
    await expect(page.locator('#jumpClear')).toHaveText('Clear');
    await expect(page.locator('#jumpReady [data-ready="field"]')).toHaveAttribute('data-ok', 'false');
    await expect(page.locator('#jumpGo')).toBeDisabled();
    await page.locator('#jumpCharge').click();
    await expect(page.locator('#jumpCoils')).toHaveText('Charged', { timeout: 15000 });
    await dialog.locator('[data-close]').click();
    await page.locator('.dock #extField').click(); // the external field must be off, as for any warp
    await page.locator('.dock #quickJumpBtn').click();
    await expect(page.locator('#jumpField')).toHaveText('Off');
    await expect(page.locator('#jumpGo')).toBeEnabled();
    await setJumpDistance(page, '31', 'LY');
    await page.locator('#jumpGo').click();
    await expect(dialog.locator('[data-error]')).toHaveText('A quick jump reaches 30 light years at most.');
    await setJumpDistance(page, '20', 'MKM');
    await expect(page.locator('#jumpTime')).toHaveText('6 sec');
    const before = await page.evaluate(() => ({ x: ship.x, y: ship.y, vx: velocity.x, vy: velocity.y, heading }));
    assert.ok(Math.hypot(before.vx, before.vy) > 1, 'the ship is moving before the jump');
    await page.locator('#jumpGo').click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#state')).toHaveText('QUICK JUMP');
    await expect(page.locator('#trackBtn')).toBeDisabled(); // tracking cannot start at warp
    await expect(page.locator('#state')).toHaveText('SUBLIGHT', { timeout: 15000 });
    await expect(page.locator('#notice')).toContainText('Quick jump complete');
    const after = await page.evaluate(() => ({ x: ship.x, y: ship.y, vx: velocity.x, vy: velocity.y }));
    const moved = Math.hypot(after.x - before.x, after.y - before.y);
    assert.ok(Math.abs(moved - 20e6) < 2000, `jumped 20 million km (${moved})`);
    const along = await page.evaluate(([from, to]) => NavWorld.bearingTo(from, to), [before, after]);
    assert.ok(headingOff(along, before.heading) < 0.01, 'straight ahead along the heading');
    const speedBefore = Math.hypot(before.vx, before.vy), speedAfter = Math.hypot(after.vx, after.vy);
    assert.ok(Math.abs(speedAfter - speedBefore) / speedBefore < 0.01, `still moving as it went in (${speedBefore} → ${speedAfter} km/s)`);
    assert.ok(Math.abs(after.vx / speedAfter - before.vx / speedBefore) < 1e-6, 'in the same direction');
    await expect(page.locator('#chargeValue')).toHaveText('0%'); // the coils discharged
    await expect(page.locator('.dock #extField')).toHaveAttribute('aria-pressed', 'true'); // the field is back up
    await expect(page.locator('#targetName')).toHaveText('Gliese 1061'); // navigation's destination is left alone
    await page.locator('.dock #quickJumpBtn').click();
    await expect(page.locator('#jumpCoils')).toHaveText('0% · charge them');
    await expect(page.locator('#jumpGo')).toBeDisabled();
  },
  'tracking waits through a quick jump and ends when the contact is lost': async ({ open }) => {
    const page = await open('/Helm/');
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('#maxWarp [data-warp="8"]').click();
    await page.locator('#menuDialog [data-close]').click();
    await page.locator('#warpTab').click();
    await page.locator('#warp').focus();
    await page.keyboard.press('End');
    await page.locator('[data-mode="SRS"]').click();
    await page.evaluate(() => setZoom(zoomFor(rangeScales.SRS, 100)));
    await selectContact(page, 'TNS Endeavor');
    await page.locator('#trackBtn').click();
    await expect(page.locator('#contactChip')).toContainText('TRACKING · TNS Endeavor');
    await page.locator('#chargeBtn').click();
    await page.locator('.dock #extField').click();
    await expect(page.locator('.heading')).toHaveAttribute('data-lock', 'COURSE LOCK', { timeout: 60000 });
    await expect(page.locator('#chargeValue')).toHaveText('100%', { timeout: 15000 });
    await page.locator('.dock #quickJumpBtn').click();
    await setJumpDistance(page, '12', 'LY');
    await page.locator('#jumpGo').click();
    await expect(page.locator('#state')).toHaveText('QUICK JUMP');
    await expect(page.locator('#trackBtn')).toHaveAttribute('aria-pressed', 'true'); // tracking waits at warp
    await expect(page.locator('#trackBtn')).toBeEnabled(); // and can still be stopped
    await expect(page.locator('#state')).toHaveText('SUBLIGHT', { timeout: 20000 });
    await expect(page.locator('#trackBtn')).toHaveAttribute('aria-pressed', 'false', { timeout: 3000 });
    await expect(page.locator('#notice')).toHaveText('Lost track of TNS Endeavor.');
  },
  'keyboard commands throttle, turn, select targets and act on the helm': async ({ open }) => {
    const page = await open('/Helm/');
    await page.locator('#map').click({ position: { x: 600, y: 120 }, force: true }); // keys act on the console, not a focused control
    for (let press = 0; press < 3; press++) await page.keyboard.press('w');
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '15');
    await expect(page.locator('#notice')).toHaveText('Impulse 15%');
    await page.keyboard.press('s');
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '10');
    await page.keyboard.press('Shift+W'); // either case
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '15');
    await page.keyboard.press('x');
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '0');
    await page.keyboard.down('d'); // held: turns to starboard at 50% until released
    await page.waitForTimeout(1200);
    await page.keyboard.up('d');
    const heading = await headingNow(page);
    assert.ok(heading > 0.3 && heading < 10, `turned to starboard (${heading})`);
    await expect(page.locator('.heading')).toHaveAttribute('data-lock', 'COURSE LOCK', { timeout: 5000 });
    const nearest = await page.evaluate(() => mapContacts.slice().sort((a, b) => a.distanceKm - b.distanceKm).map(contact => contact.name));
    await page.keyboard.press('.');
    await expect(page.locator('#contactChip')).toContainText(nearest[0]);
    await page.keyboard.press('.');
    await expect(page.locator('#contactChip')).toContainText(nearest[1]);
    await page.keyboard.press(',');
    await expect(page.locator('#contactChip')).toContainText(nearest[0]);
    await page.keyboard.press(',');
    await expect(page.locator('#contactChip')).toContainText(nearest.at(-1)); // wraps to the farthest
    await page.keyboard.press('1');
    await expect(page.locator('#notice')).toHaveText('Charge the coils first.'); // nothing jumps
    await expect(page.locator('#state')).toHaveText('SUBLIGHT');
    await page.keyboard.press('g');
    await expect(page.locator('#notice')).toHaveText('Align to the course first.');
    await page.keyboard.press(']');
    await expect(page.locator('#warpPane')).toBeVisible(); // the warp tab is shown
    await expect(page.locator('#driveSetting')).toHaveText('WF 1.25');
    await page.keyboard.press('[');
    await expect(page.locator('#driveSetting')).toHaveText('WF 1.00');
    await page.keyboard.press('c');
    await expect(page.locator('#chargeBtn')).toHaveText('CHARGING…');
    await page.keyboard.press('f');
    await expect(page.locator('.heading')).toHaveAttribute('data-lock', 'ALIGNING');
    await page.keyboard.press('z');
    await expect(page.locator('#jumpDialog')).toBeVisible();
    await page.keyboard.press('w'); // ignored while a dialog is open
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '0');
  },
  'the number keys quick jump their distance at once': async ({ open }) => {
    const page = await open('/Helm/');
    await page.locator('#map').click({ position: { x: 600, y: 120 }, force: true });
    await page.keyboard.press('c');
    await page.locator('.dock #extField').click();
    await expect(page.locator('#chargeValue')).toHaveText('100%', { timeout: 15000 });
    await page.locator('#map').click({ position: { x: 600, y: 120 }, force: true });
    const before = await page.evaluate(() => ({ x: ship.x, y: ship.y }));
    await page.keyboard.press('4');
    await expect(page.locator('#notice')).toContainText('Quick jump complete', { timeout: 5000 });
    const after = await page.evaluate(() => ({ x: ship.x, y: ship.y }));
    assert.ok(Math.abs(Math.hypot(after.x - before.x, after.y - before.y) - 1000) < 1, 'jumped 1,000 km');
    await expect(page.locator('#chargeValue')).toHaveText('0%');
  },
  'keyboard commands are changed from the menu and kept on this device': async ({ open }) => {
    const page = await open('/Helm/');
    const keyButton = id => page.locator(`#keysList [data-action="${id}"]`);
    const openKeys = async () => {
      await page.locator('#menuBtn').click();
      await page.locator('#openKeys').click();
      await expect(page.locator('#keysDialog')).toBeVisible();
    };
    await openKeys();
    await expect(page.locator('#keysList [data-action]')).toHaveCount(28);
    await expect(keyButton('impulseUp')).toHaveText('W');
    await expect(keyButton('nextTarget')).toHaveText('.');
    await expect(keyButton('track')).toHaveText('—'); // no default key
    await keyButton('impulseUp').click();
    await expect(keyButton('impulseUp')).toHaveText('Press a key…');
    await page.keyboard.press('i');
    await expect(keyButton('impulseUp')).toHaveText('I');
    await expect(page.locator('#keysNote')).toHaveText('Impulse up 5%: I.');
    await keyButton('fullStop').click();
    await page.keyboard.press('Escape'); // cancels the capture, keeps the key and the window
    await expect(keyButton('fullStop')).toHaveText('X');
    await expect(page.locator('#keysDialog')).toBeVisible();
    await keyButton('chargeCoils').click();
    await page.keyboard.press('Backspace');
    await expect(keyButton('chargeCoils')).toHaveText('—');
    await page.locator('#keysDialog [data-close]').click();
    await page.locator('#map').click({ position: { x: 600, y: 120 }, force: true });
    await page.keyboard.press('w'); // no longer bound
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '0');
    await page.keyboard.press('i');
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '5');
    await page.reload();
    await page.locator('#map').click({ position: { x: 600, y: 120 }, force: true });
    await page.keyboard.press('i'); // kept on this device
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '5');
    await openKeys();
    await keyButton('track').click();
    await page.keyboard.press('i'); // a key in use moves to the new action
    await expect(keyButton('track')).toHaveText('I');
    await expect(keyButton('impulseUp')).toHaveText('—');
    await expect(page.locator('#keysNote')).toHaveText('I moved from Impulse up 5% (now no key) to Track selected target.');
    await page.locator('#keysDefaults').click();
    await expect(keyButton('impulseUp')).toHaveText('W');
    await expect(keyButton('chargeCoils')).toHaveText('C');
    await expect(keyButton('track')).toHaveText('—');
    await expect(page.locator('#keysNote')).toHaveText('Default keys restored.');
  },
  'warp factors run from 0.25 to the rating chosen in demo controls': async ({ open }) => {
    const page = await open('/Helm/');
    await page.locator('#warpTab').click();
    const warp = page.locator('#warp');
    await expect(warp).toHaveAttribute('aria-valuemin', '0.25');
    await expect(warp).toHaveAttribute('aria-valuemax', '6');
    await warp.focus();
    await page.keyboard.press('Home');
    await expect(warp).toHaveAttribute('aria-valuenow', '0.25');
    await expect(page.locator('#driveSetting')).toHaveText('WF 0.25');
    await page.keyboard.press('ArrowUp');
    await expect(warp).toHaveAttribute('aria-valuenow', '0.5');
    await expect(page.locator('#demoControls')).toBeHidden(); // demo controls stay behind the menu
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('#maxWarp [data-warp="8"]').click();
    await page.locator('#menuDialog [data-close]').click();
    await expect(warp).toHaveAttribute('aria-valuemax', '8');
    await expect(page.locator('#tEtaMaxLabel')).toHaveText('ETA (MAX WARP 8)');
    await warp.focus();
    await page.keyboard.press('End');
    await expect(page.locator('#driveSetting')).toHaveText('WF 8.00');
    await expect(page.locator('#tEtaMax')).toBeHidden(); // the warp set is the maximum, so one row says it
  },
  'impulse speeds the ship up and blocks coil charging': async ({ open }) => {
    const page = await open('/Helm/');
    await page.locator('#impulse').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '100');
    await expect(page.locator('#state')).toHaveText('IMPULSE');
    await expect(page.locator('#speed')).not.toHaveText('0 km/s');
    await page.locator('#warpTab').click();
    await expect(page.locator('#chargeBtn')).toBeDisabled();
    await expect(page.locator('#engineNote')).toHaveText(/impulse to zero/);
  },
  'the joystick turns the ship while it is held and eases to a stop': async ({ open }) => {
    const page = await open('/Helm/');
    await page.locator('#joystick').focus();
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(1500);
    assert.notEqual(await page.locator('#knob').evaluate(knob => knob.style.getPropertyValue('--x')), '0px');
    await page.keyboard.up('ArrowRight');
    const heading = parseFloat(await page.locator('#headingValue').innerText());
    assert.ok(heading > 0.5 && heading < 10, `turned to starboard (${heading})`);
    await expect(page.locator('.heading')).toHaveAttribute('data-lock', 'COURSE LOCK', { timeout: 5000 });
    await expect(page.locator('.heading')).toHaveAttribute('data-turn-rate', '0.0');
  },
  'the heading box shows the heading and the joystick, and no status text': async ({ open }) => {
    const page = await open('/Helm/');
    assert.equal((await page.locator('.heading').innerText()).replace(/\s+/g, ' ').trim(), 'HEADING 000.0° AUTO DRIFT OFF');
  },
  'auto drift under the joystick swings a coasting ship\'s motion back onto the nose': async ({ open }) => {
    const page = await open('/Helm/');
    // Well clear of everything at 10 km/s with impulse set to that speed, the motion 30° off the nose.
    await page.evaluate(() => { ship.x += 5e6; ship.y += 5e6; velocity = polar(10, heading + 30); setImpulse((10 / fullImpulseKmS) * 100); });
    await page.waitForTimeout(800);
    const drifting = await page.evaluate(() => window.helmDriftState());
    assert.ok(drifting.off > 2, `moving off the nose (${JSON.stringify(drifting)})`);
    await page.locator('#autoDriftBtn').click();
    await expect(page.locator('#autoDriftBtn')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#autoDriftBtn')).toHaveText('AUTO DRIFT ON');
    await page.waitForFunction(() => window.helmDriftState().off <= 2.5, null, { timeout: 15000 });
    const caught = await page.evaluate(() => window.helmDriftState());
    assert.ok(caught.impulse > 0 && Math.abs(caught.speed - drifting.speed) / drifting.speed < 0.05, `on the nose at the same speed (${JSON.stringify(caught)})`);
    await page.keyboard.press('v');
    await expect(page.locator('#autoDriftBtn')).toHaveText('AUTO DRIFT OFF');
  },
  'a game controller flies the helm: its axes drive the joystick and every slider, mapped by moving them, and every command takes a button as well as a key': async ({ open, context }) => {
    await context.addInitScript(PAD_SCRIPT);
    const page = await open('/Helm/');
    await page.evaluate(() => { ship.x += 5e6; ship.y += 5e6; });
    const tap = async index => { await padButton(page, index, true); await page.waitForTimeout(150); await padButton(page, index, false); await page.waitForTimeout(150); };
    await expect(page.locator('#notice')).toHaveText('Controller connected: Test Pad (STANDARD GAMEPAD).');
    // Left stick up: impulse rises, 40 points a second at full travel.
    await padAxis(page, 1, -1);
    await page.waitForTimeout(700);
    await padAxis(page, 1, 0);
    const raised = Number(await page.locator('#impulse').getAttribute('aria-valuenow'));
    assert.ok(raised >= 15 && raised <= 40, `impulse rose with the stick (${raised})`);
    // Left stick across: the helm steers by hand, and lets go when the stick centres.
    await padAxis(page, 0, 0.8);
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => steer > 50 && steerHeld), 'steering to starboard');
    await padAxis(page, 0, 0);
    await page.waitForTimeout(200);
    assert.ok(await page.evaluate(() => steer === 0 && !steerHeld), 'the stick let go');
    // Right stick up zooms the scanner in.
    const zoomBefore = await page.evaluate(() => zoom[mode]);
    await padAxis(page, 3, -1);
    await page.waitForTimeout(400);
    await padAxis(page, 3, 0);
    assert.ok((await page.evaluate(() => zoom[mode])) > zoomBefore + 5, 'zoomed in');
    // Y toggles auto drift, and so does its key.
    await tap(3);
    assert.equal((await page.evaluate(() => window.helmDriftState())).autoDrift, true);
    await page.locator('#map').click({ position: { x: 600, y: 120 }, force: true });
    await page.keyboard.press('v');
    assert.equal((await page.evaluate(() => window.helmDriftState())).autoDrift, false);
    // Rebind it to RT (Warp up's default), in Menu → Keyboard and controller.
    await page.locator('#menuBtn').click();
    await page.locator('#openKeys').click();
    await expect(page.locator('#padStatus')).toHaveText('Controller: Test Pad (STANDARD GAMEPAD)');
    await expect(page.locator('#keysList [data-pad="autoDrift"]')).toHaveText('Y');
    await expect(page.locator('#keysList [data-pad="warpUp"]')).toHaveText('RT');
    await page.locator('#keysList [data-pad="autoDrift"]').click();
    await expect(page.locator('#keysList [data-pad="autoDrift"]')).toHaveText('Press a button…');
    await tap(7);
    await expect(page.locator('#keysNote')).toHaveText('RT moved from Warp up 5% (now no button) to Auto drift on or off.');
    await expect(page.locator('#keysList [data-pad="autoDrift"]')).toHaveText('RT');
    await expect(page.locator('#keysList [data-pad="warpUp"]')).toHaveText('—');
    // Backspace clears a button; Escape keeps it.
    await page.locator('#keysList [data-pad="track"]').click();
    await page.keyboard.press('Backspace');
    await expect(page.locator('#keysNote')).toHaveText('Track selected target: no controller button.');
    await page.locator('#keysList [data-pad="align"]').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#keysDialog')).toBeVisible();
    await expect(page.locator('#keysList [data-pad="align"]')).toHaveText('A');
    await page.locator('#keysDialog [data-close]').click();
    await tap(7);
    assert.equal((await page.evaluate(() => window.helmDriftState())).autoDrift, true, 'RT now toggles auto drift');
    // Axes (John's list): turn moved to the right stick by moving it; impulse control and the brake given axes too.
    await page.locator('#menuBtn').click();
    await page.locator('#openKeys').click();
    const axisCap = id => page.locator(`[data-axis-fn="${id}"] .pad-axis-cap`);
    await expect(axisCap('turn')).toHaveText('LEFT STICK ↔');
    await expect(axisCap('impulseRate')).toHaveText('LEFT STICK ↕');
    await expect(axisCap('zoom')).toHaveText('RIGHT STICK ↕');
    await axisCap('turn').click();
    await expect(axisCap('turn')).toHaveText('MOVE AN AXIS…');
    await padAxis(page, 2, 1);
    await expect(axisCap('turn')).toHaveText('RIGHT STICK ↔');
    await expect(page.locator('#keysNote')).toHaveText('Turn right / left: RIGHT STICK ↔.');
    await padAxis(page, 2, 0);
    // Impulse control on the left stick's up and down (taking it from impulse increase/decrease), inverted so forward is 100 %.
    await axisCap('impulseLevel').click();
    await padAxis(page, 1, 1);
    await expect(page.locator('#keysNote')).toHaveText('LEFT STICK ↕ moved from Impulse increase / decrease (centre holds) (now no axis) to Impulse control (0–100 %).');
    await padAxis(page, 1, 0);
    await page.locator('[data-axis-fn="impulseLevel"] .pad-axis-invert').click();
    await expect(page.locator('[data-axis-fn="impulseLevel"] .pad-axis-invert')).toHaveAttribute('aria-pressed', 'true');
    // The brake on the right stick's up and down (taking it from zoom).
    await axisCap('brake').click();
    await padAxis(page, 3, -1);
    await expect(axisCap('brake')).toHaveText('RIGHT STICK ↕');
    await expect(axisCap('zoom')).toHaveText('—');
    await page.locator('#keysDialog [data-close]').click();
    await padAxis(page, 0, 0.8);
    await padAxis(page, 3, -1);   // the brake lever at rest
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => steer === 0), 'the left stick no longer turns');
    await padAxis(page, 0, 0);
    await padAxis(page, 2, -0.8);
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => steer < -50 && steerHeld), 'the right stick turns to port');
    await padAxis(page, 2, 0);
    await padAxis(page, 1, -1);   // pushed all the way forward: 100 %
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '100');
    await padAxis(page, 1, 0);   // the middle: 50 %
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '50');
    // The brake lever: a quarter of its travel is light braking, three quarters hard braking, at rest none.
    await padAxis(page, 3, -0.5);
    await page.waitForFunction(() => window.helmDriftState().brake === 'light');
    await padAxis(page, 3, 0.5);
    await page.waitForFunction(() => window.helmDriftState().brake === 'hard');
    await padAxis(page, 3, -1);
    await page.waitForFunction(() => window.helmDriftState().brake === null);
    // Kept on this device; Restore Defaults puts the buttons back.
    await page.reload();
    await page.locator('#menuBtn').click();
    await page.locator('#openKeys').click();
    await expect(page.locator('#keysList [data-pad="autoDrift"]')).toHaveText('RT');
    await expect(page.locator('[data-axis-fn="turn"] .pad-axis-cap')).toHaveText('RIGHT STICK ↔');
    await page.locator('#keysDefaults').click();
    await expect(page.locator('[data-axis-fn="turn"] .pad-axis-cap')).toHaveText('LEFT STICK ↔');
    await expect(page.locator('[data-axis-fn="brake"] .pad-axis-cap')).toHaveText('—');
    await expect(page.locator('#keysList [data-pad="autoDrift"]')).toHaveText('Y');
    await expect(page.locator('#keysList [data-pad="warpUp"]')).toHaveText('RT');
  },
  'with auto drift on the speed follows impulse: lowering it brakes lightly to the new speed, not at once': async ({ open }) => {
    const page = await open('/Helm/');
    await page.evaluate(() => { ship.x += 5e6; ship.y += 5e6; setImpulse(100); velocity = polar(fullImpulseKmS, heading); });
    await page.locator('#autoDriftBtn').click();
    await page.waitForTimeout(300);
    await page.evaluate(() => setImpulse(25));
    await page.waitForTimeout(400);
    const braking = await page.evaluate(() => window.helmDriftState());
    assert.equal(braking.brake, 'light', `the light brake is on by itself (${JSON.stringify(braking)})`);
    assert.ok(braking.speed > braking.full * 0.5, `still slowing, not at the new speed at once (${JSON.stringify(braking)})`);
    await page.waitForFunction(() => window.helmDriftState().brake === null, null, { timeout: 5000 });
    const settled = await page.evaluate(() => window.helmDriftState());
    assert.ok(Math.abs(settled.speed - settled.full * 0.25) / (settled.full * 0.25) < 0.02, `at a quarter impulse's speed (${JSON.stringify(settled)})`);
    // Off, lowering impulse lets the ship coast as before.
    await page.keyboard.press('v');
    await page.evaluate(() => setImpulse(10));
    await page.waitForTimeout(600);
    const coasting = await page.evaluate(() => window.helmDriftState());
    assert.ok(coasting.brake === null && coasting.speed > coasting.full * 0.24, `coasting with auto drift off (${JSON.stringify(coasting)})`);
  },
  'with an enemy present, TRACK keeps the course on Tactical\'s target, whose shields and hull Helm shows': async ({ open }) => {
    const page = await open('/Helm/');
    await expect(page.locator('#tacTarget')).toBeHidden();
    // The scene held still, so only the hits the test makes count.
    await page.evaluate(() => { DemoBattle.hold(DemoBattle.now()); DemoBattle.addEnemy(); });
    await expect(page.locator('#tacTarget')).toBeVisible();
    await expect(page.locator('#tacName')).toHaveText('Black Pearl');
    await expect(page.locator('#tacHull')).toHaveText('500 / 500');
    await expect(page.locator('#tacShields [data-q]')).toHaveCount(4);
    await expect(page.locator('#tacShields')).toContainText('FWD');
    for (let i = 0; i < 4; i++) await expect(page.locator(`#tacShields [data-q="${i}"] b`)).toHaveText('50 / 50');
    // Hits on the aft quadrant: a torpedo drains it to 20, a pulse takes it down, the next torpedo reaches the hull.
    await page.evaluate(() => DemoBattle.hitEnemy('TPD', 2));
    await expect(page.locator('#tacShields [data-q="2"] b')).toHaveText('20 / 50');
    await expect(page.locator('#tacShields [data-q="2"]')).toHaveAttribute('data-level', 'low');
    await page.evaluate(() => { DemoBattle.hitEnemy('EPW', 2); DemoBattle.hitEnemy('TPD', 2); });
    await expect(page.locator('#tacShields [data-q="2"]')).toHaveAttribute('data-level', 'down');
    await expect(page.locator('#tacHull')).toHaveText('350 / 500');
    // TRACK, with nothing selected on the scanner, follows Tactical's target.
    await page.locator('#trackBtn').click();
    await expect(page.locator('#trackBtn')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tacTracking')).toBeVisible();
    const tracking = await page.evaluate(() => window.helmTacticalTarget().tracking);
    assert.equal(tracking.tactical, true);
    const bearing = await page.evaluate(() => NavWorld.bearingTo(ship, worldObjects().find(object => object.battleId === 'black-pearl')));
    const aimed = await page.evaluate(() => goal ?? heading);
    assert.ok(Math.abs(((aimed - bearing + 540) % 360) - 180) < 0.1, `the course points at Black Pearl (${aimed} vs ${bearing})`);
    // Disabled at hull 0, it is no longer Tactical's target: the panel goes and tracking ends.
    await page.evaluate(() => { for (let i = 0; i < 4; i++) DemoBattle.hitEnemy('TPD', 2); });
    await expect(page.locator('#tacTarget')).toBeHidden();
    await expect(page.locator('#trackBtn')).toHaveAttribute('aria-pressed', 'false', { timeout: 3000 });
    // Without enemies, TRACK goes back to the scanner's selection.
    await page.evaluate(() => DemoBattle.removeEnemy());
    await expect(page.locator('#trackBtn')).toBeDisabled();
  },
  'the external dampener field is a green toggle on the dock that impulse needs': async ({ open }) => {
    const page = await open('/Helm/');
    const field = page.locator('#extField');
    await expect(field).toHaveAttribute('aria-pressed', 'true');
    const lit = await field.locator('.ring').evaluate(ring => getComputedStyle(ring).backgroundImage);
    assert.match(lit, /radial-gradient/);
    await page.locator('#impulse').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '100');
    await field.click();
    await expect(field).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '0'); // impulse stops with the field
    await expect(page.locator('#impulse')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#engineNote')).toHaveText('EXTERNAL FIELD OFF');
    const unlit = await field.locator('.ring').evaluate(ring => getComputedStyle(ring).backgroundImage);
    assert.notEqual(unlit, lit);
    await field.click();
    await expect(page.locator('#impulse')).not.toHaveAttribute('aria-disabled', 'true');
  },
  'reverse impulse is a toggle on the dock that lights up while on': async ({ open }) => {
    const page = await open('/Helm/');
    const reverse = page.locator('.dock #reverse');
    await expect(reverse).toHaveAttribute('aria-pressed', 'false');
    await reverse.click();
    await expect(reverse).toHaveAttribute('aria-pressed', 'true');
    const lit = await reverse.locator('.ring').evaluate(ring => getComputedStyle(ring).color);
    assert.equal(lit, 'rgb(6, 17, 31)'); // the icon takes the background colour
    await page.locator('#impulse').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#engineNote')).toHaveText('REVERSE IMPULSE');
    await reverse.click();
    await expect(reverse).toHaveAttribute('aria-pressed', 'false');
    assert.equal(await page.locator('#dockDialog #reverse').count(), 0); // no longer in the Docking window
  },
  'holding a control does not select text or open a context menu': async ({ open }) => {
    const page = await open('/Helm/');
    const style = await page.locator('.dock #light').evaluate(button => {
      const computed = getComputedStyle(button);
      return { select: computed.webkitUserSelect || computed.userSelect, callout: computed.webkitTouchCallout };
    });
    assert.equal(style.select, 'none');
    if (style.callout !== undefined) assert.equal(style.callout, 'none');
    const opened = await page.locator('.dock #light').evaluate(button => button.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    assert.equal(opened, false, 'the context menu is cancelled');
  },
  'the brakes on the dock slow the ship, and Full Stop stops it': async ({ open }) => {
    const page = await open('/Helm/');
    await expect(page.locator('.dock #light')).toBeDisabled(); // nothing to brake yet
    await page.locator('#impulse').focus();
    await page.keyboard.press('End');
    await expect(page.locator('.dock #hard')).toBeEnabled();
    await page.waitForTimeout(1500);
    const moving = parseFloat(await page.locator('#speed').innerText());
    assert.ok(moving > 1, `moving at ${moving} km/s`);
    await page.locator('.dock #stop').click();
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '0');
    await expect(page.locator('#speed')).toHaveText('0 km/s', { timeout: 5000 });
    await expect(page.locator('#state')).toHaveText('SUBLIGHT');
  },
  'critical damage to the impulse drive halves its top speed, says so under the speed and in the banner': async ({ open }) => {
    const page = await open('/Helm/');
    await expect(page.locator('#driveLimit')).toHaveText('MAX IMPULSE 20 km/s');
    await expect(page.locator('#criticalBanner')).toBeHidden();
    await page.evaluate(() => DemoCombat.set('impulse', ['max-speed-halved']));
    await expect(page.locator('#criticalBanner')).toBeVisible();
    await expect(page.locator('#criticalBanner')).toHaveText('CRITICAL · Impulse drive: Maximum impulse halved');
    await expect(page.locator('#driveLimit')).toHaveText('MAX IMPULSE 10 km/s (HALVED)');
    await expect(page.locator('#driveLimit')).toHaveClass(/crit/);
    await page.evaluate(() => { ship.x += 1e7; setImpulse(100); }); // out in open space, where nothing near caps impulse
    await expect.poll(() => page.evaluate(() => Math.hypot(velocity.x, velocity.y)), { timeout: 20000 }).toBeGreaterThan(9.9);
    await page.waitForTimeout(1500);
    const speed = await page.evaluate(() => Math.hypot(velocity.x, velocity.y));
    assert.ok(speed <= 10.01, `full impulse reaches 10 km/s at most (${speed})`);
  },
  'critical damage to the warp drive halves the slider\'s maximum warp and slows the coils six times': async ({ open }) => {
    const page = await open('/Helm/');
    await page.locator('#warpTab').click();
    await expect(page.locator('#driveLimit')).toHaveText('MAX WARP 6.00');
    await page.evaluate(() => DemoCombat.set('warp', ['max-warp-halved', 'coil-charge-slowed']));
    await expect(page.locator('#driveLimit')).toHaveText('MAX WARP 3.00 (HALVED) · COILS SLOW');
    await expect(page.locator('#criticalBanner')).toHaveText('CRITICAL · Warp drive: Maximum warp halved; Coil charge takes six times as long');
    await page.locator('#warp').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#driveSetting')).toHaveText('WF 3.00');
    await page.locator('#chargeBtn').click();
    await page.waitForTimeout(3000);
    const charge = await page.evaluate(() => charge);
    assert.ok(charge > 0 && charge <= 10, `the coils charge six times slower (${charge}% after 3 s, not 35%)`);
    await page.evaluate(() => DemoCombat.clearCritical());
    await expect(page.locator('#driveLimit')).toHaveText('MAX WARP 6.00');
    await expect(page.locator('#criticalBanner')).toBeHidden();
  },
  'an enemy ship reads Hostile ship, and Wreck once disabled, drawn grey': async ({ open }) => {
    const page = await open('/Helm/');
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await expect(page.locator('[data-demo-wreck]')).toBeDisabled();
    await page.locator('[data-demo-enemy]').click();
    const kindOf = () => page.evaluate(() => {
      const enemy = worldObjects().find(object => object.name === 'Black Pearl');
      return { ...describe(enemy), label: standingSuffix(enemy) };
    });
    assert.deepEqual(await kindOf(), { kind: 'Hostile ship · ZLX-01A', color: '#f45b65', label: ' · HOSTILE' });
    await page.locator('[data-demo-wreck]').click();
    await expect(page.locator('[data-demo-wreck]')).toHaveText('ENEMY SHIP DISABLED');
    assert.deepEqual(await kindOf(), { kind: 'Wreck · ZLX-01A', color: '#6b7c8c', label: ' · WRECK' });
  },
  'the quick jump checklist shows the heading, Steady or Turning, and waits for it to settle': async ({ open }) => {
    const page = await open('/Helm/');
    await page.locator('.dock #quickJumpBtn').click();
    await expect(page.locator('#jumpHeading')).toHaveText('Steady');
    await expect(page.locator('#jumpReady [data-ready="heading"]')).toHaveAttribute('data-ok', 'true');
    await page.evaluate(() => commandSteer(100));
    await expect(page.locator('#jumpHeading')).toHaveText('Turning · wait for it to settle');
    await expect(page.locator('#jumpReady [data-ready="heading"]')).toHaveAttribute('data-ok', 'false');
    await expect(page.locator('#jumpGo')).toBeDisabled();
  },
});
