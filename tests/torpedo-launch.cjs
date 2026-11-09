// Torpedo Launch Control: the full-window scope, aiming and zoom, target selection and readout, loading, arming
// and launching, hits, the bottom bar's toggles and delegation, history and the demo controls.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const URL = '/TorpedoLaunch/?models=0', QUIET = URL + '&battle=0';
const state = page => page.evaluate(() => TorpedoLaunch.state());
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
// Holds the training ship still at a bearing and range, for a predictable shot.
async function placeShip(page, values) {
  await demo(page, () => page.locator('#moveShips').click());
  await page.evaluate(v => TorpedoLaunch.set({ contacts: [v] }), values);
}
async function tapShip(page, name = 'Training ship A') {
  const point = await page.evaluate(key => TorpedoLaunch.tapPoint(key), 'ship:' + name);
  assert.ok(point, `${name} is on the scope`);
  await page.mouse.click(point.x, point.y);
}
async function loadAndArm(page) {
  await page.locator('#prepared .round button').first().click();
  await page.evaluate(() => TorpedoLaunch.advance(3000));
  await expect(page.locator('#tubeTitle')).toHaveText(/LOADED$/);
  await page.locator('#armBtn').click();
  await expect(page.locator('#tubeTitle')).toHaveText(/ARMED$/);
}

run({
  'the scope fills the window and redraws at its size': async ({ open }) => {
    const page = await open(URL);
    const sizes = () => page.evaluate(() => ['stars', 'scene3d', 'hud'].map(id => { const b = document.getElementById(id).getBoundingClientRect(); return [b.width, b.height]; }).concat([[innerWidth, innerHeight], [document.getElementById('hud').width / Math.min(devicePixelRatio, 2), 0]]));
    let [stars, scene, hud, win, drawn] = await sizes();
    for (const layer of [stars, scene, hud]) assert.deepEqual(layer, win, 'each scope layer covers the window');
    assert.equal(drawn[0], win[0], 'the overlay is drawn at the window width');
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.waitForTimeout(200);
    [stars, scene, hud, win, drawn] = await sizes();
    assert.deepEqual(hud, [1100, 800]);
    assert.equal(drawn[0], 1100, 'the overlay redraws for the new size');
  },
  'dragging left and right aims within the 60° arc, and zoom is on the right': async ({ open }) => {
    const page = await open(URL);
    const box = await page.locator('#hud').boundingBox();
    const drag = async dx => {
      await page.mouse.move(box.width / 2, box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.width / 2 + dx, box.height / 2, { steps: 10 });
      await page.mouse.up();
    };
    await drag(-150);
    const right = (await state(page)).aim;
    assert.ok(right > 5, `dragging the view left turns the aim right (${right})`);
    await expect(page.locator('#aimValue')).toHaveText(/^\+\d+\.\d°$/);
    await drag(2000);
    assert.equal((await state(page)).aim, -30, 'the aim stops at the edge of the arc');
    await expect(page.locator('#aimValue')).toHaveText('−30.0°');
    await page.locator('#zoomSlider').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#zoomValue')).toHaveText('20.0×');
    await page.mouse.move(box.width / 2, box.height / 2);
    await page.mouse.wheel(0, 400);
    assert.ok((await state(page)).zoom < 20, 'the wheel zooms out');
  },
  'tapping a ship selects it and shows its readout; Clear Target clears it': async ({ open }) => {
    const page = await open(URL);
    await placeShip(page, { bearing: 3, range: 8000, yaw: 90 });
    await expect(page.locator('#noTarget')).toBeVisible();
    await expect(page.locator('#clearTarget')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#advisory')).toHaveText(/Tap a ship/);
    await tapShip(page);
    await expect(page.locator('#targetPanel')).toBeVisible();
    await expect(page.locator('#targetName')).toHaveText('Training ship A');
    await expect(page.locator('#targetKind')).toHaveText('HOSTILE');
    await expect(page.locator('#targetRange')).toHaveText('8 km');
    await expect(page.locator('#targetBearing')).toHaveText('+3.0°');
    await expect(page.locator('#targetSolution')).toHaveText('In arc');
    for (const q of ['q0', 'q1', 'q2', 'q3']) await expect(page.locator('#' + q)).toHaveText('50');
    await expect(page.locator('#hullValue')).toHaveText('500 / 500');
    await expect(page.locator('#advisory')).toHaveText(/Align the reticle with the yellow circle/);
    await page.evaluate(() => TorpedoLaunch.set({ aim: 3 }));
    await expect(page.locator('#advisory')).toHaveText(/^On target/);
    await expect(page.locator('#leadMarker')).toBeVisible();
    await page.locator('#clearTarget').click();
    await expect(page.locator('#targetPanel')).toBeHidden();
    assert.equal((await state(page)).selected, '');
  },
  'a torpedo is loaded, armed and launched; it hits the ship and the history shows it': async ({ open }) => {
    const page = await open(URL);
    await placeShip(page, { bearing: 2, range: 6000, yaw: 90 });
    await expect(page.locator('#prepared .round')).toHaveCount(3);
    await expect(page.locator('#launchBtn')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('#launchBtn').click({ force: true });
    await expect(page.locator('#notice')).toHaveText('The tube is empty. Load a prepared torpedo.');
    await page.locator('#prepared .round button').first().click();
    await expect(page.locator('#tubeTitle')).toHaveText(/^LOADING #1/);
    await expect(page.locator('#state')).toHaveText('LOADING');
    await expect(page.locator('#prepared .round')).toHaveCount(2);
    await page.evaluate(() => TorpedoLaunch.advance(3000));
    await expect(page.locator('#tubeTitle')).toHaveText('#1 WARHEAD LOADED');
    await page.locator('#launchBtn').click({ force: true });
    await expect(page.locator('#notice')).toHaveText('Arm the torpedo before launch.');
    await page.locator('#armBtn').click();
    await expect(page.locator('#state')).toHaveText('ARMED');
    await page.evaluate(() => TorpedoLaunch.set({ aim: 2 }));
    await page.locator('#launchBtn').click();
    await expect(page.locator('#tubeTitle')).toHaveText('TUBE EMPTY');
    await page.evaluate(() => TorpedoLaunch.advance(1000));
    const shot = (await state(page)).flight[0];
    assert.equal(shot.reason, 'Impact');
    assert.equal(shot.hitShip, 'Training ship A');
    assert.equal(shot.hitShield, true);
    await expect(page.locator('#historyCount')).toHaveText('1');
    await page.locator('#historyBtn').click();
    await expect(page.locator('#historyList .shot')).toHaveCount(1);
    await expect(page.locator('#historyList .shot')).toContainText('#1 WARHEAD');
    await expect(page.locator('#historyList .shot em')).toHaveText('IMPACT');
    await expect(page.locator('#historyList .shot')).toContainText('Training ship A · Starboard quadrant · shield impact');
    await page.locator('#clearHistory').click();
    await expect(page.locator('#historyList')).toHaveText('No torpedoes fired.');
    await expect(page.locator('#historyCount')).toBeHidden();
  },
  'Space and a right-click on the scope launch too': async ({ open }) => {
    const page = await open(URL);
    await placeShip(page, { bearing: 0, range: 40000, yaw: 90 });
    await loadAndArm(page);
    // Space works from the scope; on a focused button it presses that button instead.
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('Space');
    assert.equal((await state(page)).flight.length, 1, 'Space launched');
    await loadAndArm(page);
    await page.mouse.click(400, 500, { button: 'right' });
    assert.equal((await state(page)).flight.length, 2, 'a right-click launched');
    await page.evaluate(() => TorpedoLaunch.advance(60000));
    await page.locator('#historyBtn').click();
    await expect(page.locator('#historyList .shot em').first()).toHaveText(/IMPACT|MISS/);
  },
  'Auto Load and Auto Arm light up and keep the tube loaded and armed': async ({ open }) => {
    const page = await open(URL);
    await page.locator('#autoLoadBtn').click();
    await expect(page.locator('#autoLoadBtn')).toHaveClass(/active/);
    await page.locator('#autoArmBtn').click();
    await expect(page.locator('#autoArmBtn')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => TorpedoLaunch.advance(3000));
    await expect(page.locator('#tubeTitle')).toHaveText('#1 WARHEAD ARMED');
    await page.locator('#launchBtn').click();
    await page.evaluate(() => TorpedoLaunch.advance(3000));
    await expect(page.locator('#tubeTitle')).toHaveText('#2 WARHEAD ARMED');
    await page.locator('#autoLoadBtn').click();
    await expect(page.locator('#autoLoadBtn')).not.toHaveClass(/active/);
  },
  'delegated launch and aim pass to the bridge, whose stand-ins are in the demo controls': async ({ open }) => {
    const page = await open(URL);
    await loadAndArm(page);
    await page.locator('#delegateLaunchBtn').click();
    await expect(page.locator('#delegateLaunchBtn')).toHaveClass(/active/);
    await expect(page.locator('#launchMode')).toHaveText('BRIDGE LAUNCH');
    await page.locator('#launchBtn').click({ force: true });
    await expect(page.locator('#notice')).toHaveText('Launch control is delegated to the bridge.');
    await page.locator('#delegateAimBtn').click();
    await expect(page.locator('#aimMode')).toHaveText('BRIDGE AIM');
    const box = await page.locator('#hud').boundingBox();
    await page.mouse.move(box.width / 2, box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.width / 2 - 200, box.height / 2, { steps: 8 });
    await page.mouse.up();
    assert.equal((await state(page)).aim, 0, 'a drag does not aim while aim is delegated');
    await demo(page, async () => {
      await setField(page, 'bridgeAim', '-12');
      await page.locator('#bridgeLaunch').click();
    });
    const after = await state(page);
    assert.equal(after.aim, -12);
    assert.equal(after.flight.length, 1, 'the bridge launched');
    assert.equal(after.flight[0].aim, -12);
    await page.locator('#delegateAimBtn').click();
    await page.locator('#delegateLaunchBtn').click();
    await expect(page.locator('#launchMode')).toHaveText('LOCAL LAUNCH');
  },
  'demo controls: load power, ready capacity, prepared torpedoes and ships': async ({ open }) => {
    // The training ships alone: the demo's engagement (four more contacts) is switched off.
    const page = await open(URL + (URL.includes('?') ? '&' : '?') + 'battle=0');
    await demo(page, () => setField(page, 'availablePower', '5'));
    await expect(page.locator('#loadCycle')).toHaveText('PAUSED');
    await page.locator('#prepared .round button').first().click({ force: true });
    await expect(page.locator('#notice')).toHaveText('Loading paused: check the launcher power and load times.');
    await demo(page, () => setField(page, 'availablePower', '24'));
    await expect(page.locator('#loadCycle')).toHaveText('1.5 s · 12.0 PU');
    await demo(page, async () => {
      await setField(page, 'rtlMax', '5');
      await page.locator('#seedRounds').click();
      await page.locator('#addShip').click();
    });
    await expect(page.locator('#preparedCount')).toHaveText('5 / 5');
    assert.equal((await state(page)).contacts.length, 2);
  },
  // As the live console (1.0.0-Beta10) and Combat (Beta9, the shared Shared/demo-combat.js). The demo's engagement is switched
  // off in these cases, so its ships do not pass in front of the target.
  'the ship\'s two launchers: AFT turns the scope aft, with its own tube and prepared torpedoes, while the forward one keeps loading': async ({ open }) => {
    const page = await open(QUIET);
    await expect(page.locator('#scanCaption')).toHaveText('TPD1 · FORWARD TORPEDO LAUNCHER · 60° ACQUISITION ARC · MANUAL LEAD');
    await page.locator('#prepared .round button').first().click();
    await page.locator('#launcherSeg [data-launcher="TPD2"]').click();
    await expect(page.locator('#notice')).toHaveText('TPD2 launcher: the scope looks aft.');
    await expect(page.locator('#scanCaption')).toHaveText('TPD2 · AFT TORPEDO LAUNCHER · 60° ACQUISITION ARC · MANUAL LEAD');
    await expect(page.locator('#launcherSeg [data-launcher="TPD2"]')).toHaveClass(/active/);
    await expect(page.locator('#tubeTitle')).toHaveText('TUBE EMPTY');
    await expect(page.locator('#prepared .round')).toHaveCount(3);
    await expect(page.locator('#prepared .round b').first()).toHaveText('#4 WARHEAD');
    let s = await state(page);
    assert.equal(Math.abs(s.facing), 180, 'the scope looks aft');
    assert.equal(s.aim, 0, 'aim at the launcher\'s centre');
    await page.evaluate(() => TorpedoLaunch.advance(3000));
    s = await state(page);
    assert.equal(s.launchers[0].tube.id, 1, 'the forward launcher loaded while the aft one was shown');
    await page.locator('#prepared .round button').first().click();
    await page.evaluate(() => TorpedoLaunch.advance(3000));
    await page.locator('#armBtn').click();
    await page.locator('#launchBtn').click();
    s = await state(page);
    assert.equal(Math.abs(s.flight[0].aim), 180, 'the aft torpedo runs astern');
    await page.locator('#launcherSeg [data-launcher="TPD1"]').click();
    await expect(page.locator('#tubeTitle')).toHaveText('#1 WARHEAD LOADED');
  },
  'critical damage: a launcher\'s range halved halves its WARHEAD RANGE and shows a red line, for that launcher only': async ({ open }) => {
    const page = await open(QUIET);
    await expect(page.locator('#warheadRange')).toHaveText('600 km');
    await page.evaluate(() => DemoCombat.set('TPD2', ['range-halved']));
    await expect(page.locator('#launcherCritical')).toBeHidden();
    await page.locator('#launcherSeg [data-launcher="TPD2"]').click();
    await expect(page.locator('#warheadRange')).toHaveText('300 km (halved)');
    await expect(page.locator('#torpedoSpeed')).toHaveText('10 km/s · 30 s');
    await expect(page.locator('#launcherCritical')).toHaveText('CRITICAL · Range halved');
  },
  'targeting computer offline: the red pill shows, and there is no intercept circle, lead marker or intercept': async ({ open }) => {
    const page = await open(QUIET);
    await placeShip(page, { bearing: 3, range: 8000, yaw: 90 });
    await tapShip(page);
    await expect(page.locator('#leadMarker')).toBeVisible();
    await page.evaluate(() => DemoCombat.set('targeting', ['targeting-computer-offline']));
    await expect(page.locator('#targetingOffline')).toBeVisible();
    await expect(page.locator('#leadMarker')).toBeHidden();
    await expect(page.locator('#targetIntercept')).toHaveText('Offline');
    await expect(page.locator('#targetSolution')).toHaveText('No guidance');
    await expect(page.locator('#advisory')).toHaveText('Targeting computer offline: no guidance reticle. Aim by hand.');
  },
  'LOCK: the target reads LOCKING then LOCKED, and a locked launch leads the target whatever the aim': async ({ open }) => {
    const page = await open(QUIET);
    await placeShip(page, { bearing: 4, range: 6000, yaw: 90 });
    await tapShip(page);
    await expect(page.locator('#targetKind')).toHaveText('HOSTILE');
    await page.locator('#lockBtn').click();
    await expect(page.locator('#targetKind')).toHaveText('LOCKING');
    await page.evaluate(() => TorpedoLaunch.advance(2100));
    await expect(page.locator('#targetKind')).toHaveText('LOCKED');
    await expect(page.locator('#lockBtn')).toHaveText('UNLOCK');
    await expect(page.locator('#advisory')).toHaveText(/Locked: the launcher leads the target\.$|Align the reticle|Pan toward/);
    await loadAndArm(page);
    await page.evaluate(() => TorpedoLaunch.set({ aim: -25 }));
    const lead = (await state(page)).lead.bearing;
    await page.locator('#launchBtn').click();
    await expect(page.locator('#notice')).toHaveText('Torpedo #1 launched at Training ship A.');
    await page.evaluate(() => TorpedoLaunch.advance(1500));
    const shot = (await state(page)).flight[0];
    assert.ok(Math.abs(shot.aim - lead) < 0.01, `the torpedo ran along the solution (${shot.aim} vs ${lead})`);
    assert.equal(shot.hitShip, 'Training ship A');
  },
  'a settlement is a target: its shield, the lock and a led intercept on it': async ({ open }) => {
    const page = await open(QUIET);
    await placeShip(page, { bearing: 25, range: 8000, yaw: 90 });
    const point = await page.evaluate(() => TorpedoLaunch.tapPoint('body:tycho-outpost'));
    assert.ok(point, 'the outpost is on the scope');
    await page.mouse.click(point.x, point.y);
    await expect(page.locator('#targetName')).toHaveText('Tycho Rock Outpost');
    await expect(page.locator('#targetKind')).toHaveText('SETTLEMENT');
    await expect(page.locator('#targetSub')).toHaveText('Settlement · Tycho Rock');
    await expect(page.locator('#placeShieldValue')).toHaveText('None raised');
    await expect(page.locator('#targetIntercept')).toHaveText(/^29\.5 s · −6\.0°$/);
    await page.evaluate(() => DemoCombat.setPlaceShield('Tycho Rock Outpost', true));
    await expect(page.locator('#placeShieldValue')).toHaveText('10,000 / 10,000');
    await page.locator('#lockBtn').click();
    await page.evaluate(() => TorpedoLaunch.advance(2100));
    await expect(page.locator('#targetKind')).toHaveText('LOCKED');
  },
  'a ship whose hull is gone is a wreck: grey, WRECK on the target panel': async ({ open }) => {
    const page = await open(QUIET);
    await placeShip(page, { bearing: 3, range: 8000, yaw: 90 });
    await page.evaluate(() => TorpedoLaunch.set({ hulls: { 'Training ship A': 0 } }));
    await page.evaluate(() => TorpedoLaunch.advance(200));
    await tapShip(page);
    await expect(page.locator('#targetKind')).toHaveText('WRECK');
    assert.deepEqual((await state(page)).wrecks, ['Training ship A']);
  },
  'the 3D models load, or the scope falls back to outlines': async ({ open }) => {
    const page = await open('/TorpedoLaunch/');
    await page.waitForFunction(() => TorpedoLaunch.state().modelsReady, null, { timeout: 60000 });
    const { modelsFailed } = await state(page);
    console.log(`     3D models ${modelsFailed ? 'unavailable here; outlines shown' : 'loaded'}`);
    assert.ok(await page.evaluate(() => TorpedoLaunch.tapPoint('ship:Training ship A') !== null), 'the training ship is on the scope');
  },
});
