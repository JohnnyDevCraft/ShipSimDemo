// Fighter Control: engines and the pocket reactor, the flight stick (turn, throttle, hold), drift and Forward Thrust,
// all stop, reversing, the power bus, weapons along the nose, shields and hits, and the shared scope's flying hooks.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const state = page => page.evaluate(() => FighterControl.state());
const advance = (page, ms) => page.evaluate(value => FighterControl.advance(value), ms);
const stick = (page, x, y) => page.evaluate(([a, b]) => FighterControl.stick(a, b), [x, y]);
const near = (a, b, tolerance = 0.5) => Math.abs(a - b) <= tolerance;
// Opens the page with the clock stopped (the tests run it by hand) and, if asked, the engines lit.
async function open(openPage, { lit = false } = {}) {
  const page = await openPage('/Fighter/?models=0');
  await page.evaluate(() => FighterControl.pause(true));
  if (lit) {
    await page.evaluate(() => document.getElementById('engineBtn').click());
    await advance(page, 90100);
  }
  return page;
}

run({
  'it opens with the engines off: the battery runs life support, comms and sensors, and nothing else works': async ({ open: openPage }) => {
    const page = await open(openPage);
    const before = (await state(page)).battery;
    await advance(page, 1000);
    const now = await state(page);
    assert.equal(now.reactor, 'off');
    assert.deepEqual(now.given, { life: 5, comms: 2, sensors: 1, dampener: 0, impulse: 0, shield: 0, torpedo: 0, cannon: 0 });
    assert.ok(near(before - now.battery, 8, 0.01), '8 PU for a second from the battery');
    await expect(page.locator('#state')).toHaveText('ENGINES OFF');
    await expect(page.locator('#engineBtn')).toHaveText('START ENGINES');
    await expect(page.locator('#flightStick')).toHaveClass(/disabled/);
    await expect(page.locator('#advisory')).toHaveText('Engines off. Start engines to light the pocket reactor and power the ship.');
    for (const [button, notice] of [['#weaponsCmd', 'Start engines before bringing weapons online.'], ['#shieldsCmd', 'Start engines before raising shields.']]) {
      await page.locator(button).click();
      await expect(page.locator('#notice')).toHaveText(notice);
    }
    await page.locator('#fireBtn').click();
    await expect(page.locator('#notice')).toHaveText('Start engines to power the cannon.');
  },

  'the Engines pop-up cold-starts the pocket reactor in 1.5 minutes, then the reactor powers the ship and charges the battery': async ({ open: openPage }) => {
    const page = await open(openPage);
    await expect(page.locator('#enginesLabel')).toHaveText('ENGINES OFF');
    await page.locator('#enginesBtn').click();
    await expect(page.locator('#enginesDialog')).toBeVisible();
    await expect(page.locator('#ignitionNote')).toHaveText('Cold start takes 1:30');
    await page.locator('#engineBtn').click();
    await expect(page.locator('#notice')).toHaveText('Pocket reactor cold start: online in 1:30.');
    await advance(page, 45000);
    let now = await state(page);
    assert.equal(now.reactor, 'ignition');
    assert.ok(near(now.ignition, 0.5, 0.01));
    await expect(page.locator('#state')).toHaveText('IGNITION 0:45');
    await expect(page.locator('#engineState')).toHaveText('COLD START');
    await expect(page.locator('#engineBtn')).toHaveText('ABORT START');
    await expect(page.locator('#advisory')).toHaveText('Pocket reactor cold start · 50% · online in 0:45.');
    await expect(page.locator('#enginesLabel')).toHaveText('START 0:45');
    await advance(page, 45100);
    now = await state(page);
    assert.equal(now.reactor, 'online');
    assert.equal(now.given.dampener, 26, 'the dampener comes on with the reactor');
    assert.ok(now.batteryFlow > 0, 'spare reactor output recharges the battery');
    await expect(page.locator('#engineBtn')).toHaveText('STOP ENGINES');
    await expect(page.locator('.system-row').filter({ hasText: 'Inertial dampener' }).locator('em')).toHaveText('OK');
    await page.locator('#enginesDialog [data-close]').click();
    await expect(page.locator('#state')).toHaveText('FLYING');
    await expect(page.locator('#enginesLabel')).toHaveText('ENGINES ON');
    await expect(page.locator('#flightStick')).not.toHaveClass(/disabled/);
  },

  'the stick turns the nose and throttles; let go and the speed holds, and the view turns with the nose': async ({ open: openPage }) => {
    const page = await open(openPage, { lit: true });
    await stick(page, 0, -1); // up: accelerate at 150 m/s²
    await advance(page, 4000);
    let now = await state(page);
    assert.ok(near(now.speed, 600), `600 m/s after 4 s (${now.speed})`);
    assert.ok(near(now.given.impulse, 35, 0.01), 'full effort draws the engine\'s full 35 PU');
    await stick(page, 0, 0);
    await advance(page, 3000);
    now = await state(page);
    assert.ok(near(now.speed, 600), 'the speed holds with the stick in the middle');
    assert.ok(near(now.z, 0.5 * 150 * 16 + 600 * 3, 40), 'and we keep flying');
    await expect(page.locator('#flightState')).toHaveText('HOLDING SPEED');
    await stick(page, 1, 0); // starboard at 30°/s
    await advance(page, 1000);
    now = await state(page);
    assert.ok(near(now.heading, 30), 'the nose turned 30°');
    assert.ok(near(now.aim, 30), 'the scope looks along the nose');
    await expect(page.locator('#aimValue')).toHaveText('030°');
  },

  'turning does not turn the momentum: the ship drifts until Forward Thrust swings it to the nose, keeping the speed': async ({ open: openPage }) => {
    const page = await open(openPage, { lit: true });
    await stick(page, 0, -1);
    await advance(page, 5000); // 750 m/s along 000°
    await stick(page, -1, 0);
    await advance(page, 3000); // nose to 270°
    await stick(page, 0, 0);
    let now = await state(page);
    assert.ok(near(now.heading, -90) && near(now.course, 0) && near(now.drift, 90) && near(now.speed, 750));
    await expect(page.locator('#flightState')).toHaveText('DRIFTING');
    await expect(page.locator('#driftValue')).toHaveText('90° S');
    await expect(page.locator('#advisory')).toHaveText('Drifting 90° to starboard. Hold Forward Thrust to swing the motion onto the nose.');
    // The throttle works along the drift, not the nose.
    await stick(page, 0, -1);
    await advance(page, 1000);
    await stick(page, 0, 0);
    now = await state(page);
    assert.ok(near(now.speed, 900) && near(now.course, 0), 'up added speed along the way we move');
    // Forward Thrust (held): the motion swings round to the nose at the engine's acceleration.
    await page.evaluate(() => FighterControl.thrust(true));
    await advance(page, 2000);
    now = await state(page);
    assert.ok(Math.abs(now.drift) < 90 && Math.abs(now.drift) > 1, 'part way round');
    await expect(page.locator('#flightState')).toHaveText('THRUSTING');
    await expect(page.locator('#thrustBtn')).toHaveClass(/active/);
    await advance(page, 8000); // 900·√2 ÷ 150 ≈ 8.5 s in all
    now = await state(page);
    assert.ok(near(now.drift, 0, 0.01) && near(now.speed, 900), `on the nose at the speed we had (${now.speed}, ${now.drift})`);
    await page.evaluate(() => FighterControl.thrust(false));
    await expect(page.locator('#flightState')).toHaveText('HOLDING SPEED');
    // The rule: a full reversal passes through a stop.
    const swing = await page.evaluate(() => {
      FighterControl.set({ heading: 0, vx: 0, vz: -500 });
      FighterControl.thrust(true);
      FighterControl.advance(500 / 150 * 1000);
      const half = FighterControl.state().speed;
      FighterControl.advance(500 / 150 * 1000 + 100);
      const end = FighterControl.state();
      return { half, end: end.speed, course: end.course };
    });
    assert.ok(swing.half < 1 && near(swing.end, 500) && near(swing.course, 0));
  },

  'Auto-Drift keeps the motion on the nose through a turn, and the stick sets the speed ahead or astern': async ({ open: openPage }) => {
    const page = await open(openPage, { lit: true });
    await page.locator('#autoDriftCmd').click();
    await expect(page.locator('#autoDriftLabel')).toHaveText('AUTO-DRIFT ON');
    await expect(page.locator('#autoDriftCmd')).toHaveClass(/active/);
    await stick(page, 0, -1);
    await advance(page, 5000); // 750 m/s ahead
    await stick(page, -1, 0);
    await advance(page, 3000); // the nose swings 90° to port
    await stick(page, 0, 0);
    let now = await state(page);
    assert.ok(near(now.heading, -90));
    assert.ok(Math.abs(now.drift) < 90, `the motion followed part of the turn (${now.drift})`);
    await advance(page, 8000);
    now = await state(page);
    assert.ok(near(now.drift, 0, 0.01) && near(now.speed, 750, 0.01), `back on the nose at 750 m/s (${now.drift}, ${now.speed})`);
    await expect(page.locator('#flightState')).toHaveText('HOLDING SPEED');
    // Without it, the same turn leaves the motion behind.
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('v');
    assert.equal((await state(page)).autoDrift, false);
    await stick(page, 1, 0);
    await advance(page, 3000);
    await stick(page, 0, 0);
    await advance(page, 3000);
    assert.ok(near((await state(page)).drift, -90), 'no correction with auto-drift off');
    // Astern: down through zero reverses along the nose, and a turn keeps it astern of the nose.
    await page.locator('#autoDriftCmd').click();
    await page.evaluate(() => FighterControl.set({ vx: 0, vz: 0, heading: 0 }));
    await stick(page, 0, 1);
    await advance(page, 3000);
    await stick(page, 1, 0);
    await advance(page, 1000);
    await stick(page, 0, 0);
    await advance(page, 4000);
    now = await state(page);
    assert.ok(near(now.speed, 450, 0.01) && near(Math.abs(now.drift), 180, 0.01), `reversing along the new nose (${now.speed}, ${now.drift})`);
  },

  'the throttle slows to a stop before it reverses, and up from reversing slows again; All Stop sheds all motion': async ({ open: openPage }) => {
    const page = await open(openPage, { lit: true });
    await page.evaluate(() => FighterControl.set({ vx: 0, vz: 300 }));
    await stick(page, 0, 1); // down
    await advance(page, 2000);
    let now = await state(page);
    assert.ok(near(now.speed, 0), 'stopped after 2 s');
    await advance(page, 5000);
    now = await state(page);
    assert.ok(near(now.speed, 500) && near(Math.abs(now.course), 180), 'reversing, held to the 500 m/s reverse limit');
    await expect(page.locator('#flightState')).toHaveText('REVERSING');
    await expect(page.locator('#advisory')).toHaveText('Reversing at 500 m/s. Push the stick up to slow down.');
    await stick(page, 0, -1);
    await advance(page, 1000);
    assert.ok(near((await state(page)).speed, 350), 'up slows a reversing ship');
    await stick(page, 0, 0);
    // All Stop: retro thrust until still, at the engine's acceleration; moving the stick cancels it.
    await page.evaluate(() => FighterControl.set({ vx: 400, vz: 300 }));
    await page.locator('#stopBtn').click();
    await expect(page.locator('#flightState')).toHaveText('ALL STOP');
    await advance(page, 2000);
    assert.ok(near((await state(page)).speed, 200));
    await advance(page, 1500);
    now = await state(page);
    assert.equal(now.speed, 0);
    assert.equal(now.allStop, false);
    await expect(page.locator('#notice')).toHaveText('All stop: holding still.');
    await page.evaluate(() => FighterControl.set({ vx: 0, vz: 300 }));
    await page.locator('#stopBtn').click();
    await stick(page, 0, -1);
    await advance(page, 200);
    assert.equal((await state(page)).allStop, false, 'the stick cancels all stop');
  },

  'Stop Engines leaves the ship coasting, with weapons and shields offline and the stick locked': async ({ open: openPage }) => {
    const page = await open(openPage, { lit: true });
    await page.locator('#weaponsCmd').click();
    await page.locator('#shieldsCmd').click();
    await page.evaluate(() => FighterControl.set({ vx: 0, vz: 800 }));
    await page.locator('#enginesBtn').click();
    await page.locator('#engineBtn').click();
    await page.locator('#enginesDialog [data-close]').click();
    await expect(page.locator('#notice')).toHaveText('Engines stopped; weapons and shields offline. Coasting at 800 m/s.');
    await stick(page, 1, -1);
    await advance(page, 2000);
    const now = await state(page);
    assert.ok(near(now.speed, 800) && near(now.heading, 0), 'no thrust and no turning, but the momentum stays');
    assert.equal(now.weapons, false);
    assert.equal(now.shields, false);
    await expect(page.locator('#flightStick')).toHaveClass(/disabled/);
    await expect(page.locator('#flightState')).toHaveText('COASTING');
    await expect(page.locator('#advisory')).toHaveText('Engines off · coasting at 800 m/s. Start engines to manoeuvre.');
  },

  'the bus shares the reactor and battery in order: over the reactor\'s rating the battery helps, and the cannon charges last': async ({ open: openPage }) => {
    const page = await open(openPage, { lit: true });
    await page.locator('#weaponsCmd').click();
    await page.locator('#shieldsCmd').click();
    await page.evaluate(() => FighterControl.set({ quads: [125, 125, 125, 125] }));
    await stick(page, 0, -1);
    await advance(page, 100);
    let now = await state(page);
    // 5 + 2 + 1 + 26 + 35 + 20 + 9 + 50 = 148 PU asked: 120 from the reactor and 28 from the battery.
    assert.ok(near(now.load, 148, 0.01) && near(now.batteryFlow, -28, 0.01), JSON.stringify(now.given));
    await page.evaluate(() => FighterControl.configure({ batteryOutput: 10 }));
    await advance(page, 100);
    now = await state(page);
    assert.ok(near(now.given.cannon, 50 - 18, 0.01), 'the cannon gets what is left');
    await page.locator('#enginesBtn').click();
    await expect(page.locator('.system-row').filter({ hasText: 'Phase cannon' }).locator('em')).toHaveText('SHORT');
    await expect(page.locator('.system-row').filter({ hasText: 'Impulse engine' }).locator('em')).toHaveText('OK');
    await page.locator('#enginesDialog [data-close]').click();
    // The dampener needs all of its power, or the engine stops.
    await page.evaluate(() => FighterControl.configure({ reactorRated: 20, batteryOutput: 10 }));
    await advance(page, 1000);
    now = await state(page);
    assert.equal(now.dampenerOk, false);
    assert.equal(now.impulseShare, 0);
  },

  'weapons fire where the nose points: the cannon draws on its capacitor, torpedoes load themselves, and pulses hit': async ({ open: openPage }) => {
    const page = await open(openPage, { lit: true });
    await page.locator('#weaponsCmd').click();
    await expect(page.locator('#state')).toHaveText('WEAPONS HOT');
    await expect(page.locator('#weaponsLabel')).toHaveText('WEAPONS ON');
    await advance(page, 1000);
    let now = await state(page);
    assert.ok(near(now.charge, 50, 0.01), 'the capacitor fills at 50 PU a second');
    assert.equal(now.loaded, false);
    await page.locator('#fireBtn').click();
    await expect(page.locator('#notice')).toHaveText('The cannon is charging: 50 of 60 PU.');
    await advance(page, 4000);
    now = await state(page);
    assert.equal(now.charge, 240);
    assert.equal(now.loaded, true);
    await expect(page.locator('#chargeValue')).toHaveText('240 / 240 PU · 4 SHOTS');
    await expect(page.locator('#torpedoState')).toHaveText('READY');
    // Put the training ship dead ahead at 5 km, still, and fire along the nose.
    await page.evaluate(() => {
      const scope = FighterControl.scope;
      if (scope.moving) scope.toggleMoving();
      Object.assign(scope.contacts[0], { bearing: 40, range: 5000, yaw: 40 });
      FighterControl.set({ heading: 40 });
    });
    await page.locator('#nextTarget').click();
    await expect(page.locator('#advisory')).toHaveText(/^On target · intercept 0\.2 s\. Fire!$/);
    await page.locator('#shotPower [data-shot="120"]').click();
    await page.locator('#fireBtn').click();
    await advance(page, 400);
    now = await state(page);
    assert.ok(near(now.charge, 120 + 50 * 0.4, 0.01), 'a full shot taken, and charging again');
    assert.deepEqual(now.flight.map(f => [f.type, f.reason, f.hitShip, Math.round(f.aim)]), [['Pulse', 'Impact', 'Training ship A', 40]]);
    const shield = await page.evaluate(() => FighterControl.scope.shieldOf('Training ship A'));
    assert.equal(shield.drain[2], 40, 'a 120 PU pulse carries the cannon\'s full 40 WED (the ship shows us its stern)');
    // A torpedo; the next loads by itself.
    await page.locator('#torpedoBtn').click();
    now = await state(page);
    assert.equal(now.loaded, false);
    assert.equal(now.flight.at(-1).type, 'Torpedo');
    await expect(page.locator('#torpedoValue')).toHaveText('11 / 12');
    await advance(page, 1600);
    assert.equal((await state(page)).loaded, true);
    // A turn of the nose turns the aim: the pulse goes the new way.
    await page.evaluate(() => (FighterControl.set({ heading: 100 }), document.activeElement.blur()));
    await page.keyboard.press('Space');
    assert.equal(Math.round((await state(page)).flight.at(-1).aim), 100);
  },

  'the intercept allows for our own motion, and the advisory says which way to turn': async ({ open: openPage }) => {
    const page = await open(openPage, { lit: true });
    const results = await page.evaluate(() => {
      const scope = FighterControl.scope;
      if (scope.moving) scope.toggleMoving();
      Object.assign(scope.contacts[0], { bearing: 0, range: 20000 });
      scope.select('ship:Training ship A');
      FighterControl.set({ heading: 0, vx: 0, vz: 0 });
      const still = scope.lead().bearing;
      FighterControl.set({ vx: 2000, vz: 0 }); // sliding east: aim to port of the ship
      return { still, sliding: scope.lead().bearing };
    });
    assert.ok(near(results.still, 0, 0.01));
    assert.ok(near(results.sliding, -4.6, 0.1), `aim off for our own drift (${results.sliding})`);
    await page.evaluate(() => FighterControl.set({ vx: 0, vz: 0, heading: 20 }));
    await expect(page.locator('#advisory')).toHaveText('Turn 20° to port to put the yellow circle under the reticle · intercept 0.8 s.');
  },

  'flying moves us through space: ships slide past, and their routes stay put': async ({ open: openPage }) => {
    const page = await open(openPage, { lit: true });
    const moved = await page.evaluate(() => {
      const scope = FighterControl.scope;
      if (scope.moving) scope.toggleMoving();
      Object.assign(scope.contacts[0], { bearing: 0, range: 10000 });
      FighterControl.set({ vx: 0, vz: 1000 });
      FighterControl.advance(4000);
      return scope.contacts[0];
    });
    assert.ok(near(moved.range, 6000, 1) && near(moved.bearing, 0, 0.01), '4 km closer after 4 s at 1 km/s');
  },

  'our shield is four quadrants: a hit lands on the one facing the shooter, the hull takes what it cannot hold, and at zero the fighter is lost': async ({ open: openPage }) => {
    const page = await open(openPage, { lit: true });
    const hit = bearing => page.evaluate(value => FighterControl.hit(value), bearing);
    await page.locator('#shieldsCmd').click();
    await expect(page.locator('#shieldState')).toHaveText('UP · 1,000 SEO');
    await expect(page.locator('#shieldsLabel')).toHaveText('SHIELDS UP');
    await expect(page.locator('#qv0')).toHaveText('250 SEO');
    await hit(0); // dead ahead
    let now = await state(page);
    assert.deepEqual(now.quads, [100, 250, 250, 250]);
    assert.equal(now.hull, 100);
    await expect(page.locator('#qv0')).toHaveText('100 SEO');
    await expect(page.locator('#ownQuadrants path[data-q="0"]')).toHaveAttribute('data-level', 'warn');
    await expect(page.locator('#shieldState')).toHaveText('RECHARGING · 850 SEO');
    await advance(page, 3000);
    assert.ok(near((await state(page)).quads[0], 100 + (6.67 / 4) * 3, 0.01), 'each quadrant gets a quarter of the recharge');
    await page.evaluate(() => FighterControl.set({ heading: 30 }));
    await hit(30 + 180); // from astern
    await hit(30 + 95); // from starboard
    now = await state(page);
    assert.equal(now.quads[2], 100);
    assert.equal(now.quads[1], 100);
    await hit(30 + 180); // astern again: 100 SEO holds two thirds of it
    now = await state(page);
    assert.equal(now.quads[2], 0);
    assert.ok(near(now.hull, 100 - 25 / 3, 0.01));
    await expect(page.locator('#ownQuadrants path[data-q="2"]')).toHaveAttribute('data-level', 'down');
    await page.locator('#shieldsCmd').click();
    await hit(30);
    assert.ok(near((await state(page)).hull, 75 - 25 / 3, 0.01), 'with the shields down the hull takes it all');
    await page.evaluate(() => { for (let i = 0; i < 3; i++) FighterControl.hit(); });
    now = await state(page);
    assert.equal(now.destroyed, true);
    assert.equal(now.reactor, 'off');
    await expect(page.locator('#state')).toHaveText('DESTROYED');
    await expect(page.locator('#advisory')).toHaveText('Fighter destroyed. Reset the demo from the menu.');
    await page.locator('#enginesBtn').click();
    await page.locator('#engineBtn').click({ force: true });
    await expect(page.locator('#notice')).toHaveText('The fighter is destroyed. Reset the demo from the menu.');
  },

  'multi-touch: one finger steers while others fire the cannon, launch a torpedo and press the bottom bar, each once': async ({ context, base, engine }) => {
    if (engine !== 'chromium') return; // multi-finger touch comes from Chromium's DevTools protocol
    const touchContext = await context.browser().newContext({ viewport: { width: 1366, height: 1024 }, hasTouch: true, isMobile: false });
    try {
      const page = await touchContext.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/Fighter/?models=0');
      await page.evaluate(() => {
        FighterControl.pause(true);
        document.getElementById('engineBtn').click();
        FighterControl.advance(90100);
        document.getElementById('weaponsCmd').click();
        FighterControl.advance(5000);
      });
      const cdp = await touchContext.newCDPSession(page);
      const centre = async selector => { const b = await page.locator(selector).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
      // Each event lists the fingers down after it: a finger left out is lifted; touchEnd lifts them all.
      const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
      const stickAt = await centre('#flightStick'), held = { x: stickAt.x + 35, y: stickAt.y - 55, id: 1 };
      // Finger 1 holds the stick up and to starboard.
      await touch('touchStart', [{ ...stickAt, id: 1 }]);
      await touch('touchMove', [held]);
      // Finger 2 taps Fire, then Torpedo, then Shields, while finger 1 stays on the stick.
      for (const [selector, id] of [['#fireBtn', 2], ['#torpedoBtn', 3], ['#shieldsCmd', 4]]) {
        const at = await centre(selector);
        await touch('touchStart', [held, { ...at, id }]);
        await touch('touchMove', [held]);
      }
      await page.waitForTimeout(300);
      await page.evaluate(() => FighterControl.advance(1000));
      let now = await page.evaluate(() => FighterControl.state());
      assert.equal(now.fired.cannon, 1, 'one tap, one pulse');
      assert.equal(now.fired.torpedo, 1, 'one tap, one torpedo');
      assert.equal(now.shields, true, 'one tap raised the shields (and did not lower them again)');
      assert.ok(now.speed > 50 && now.heading > 5, `the stick kept steering throughout (${now.speed}, ${now.heading})`);
      // Three fingers: the stick, Forward Thrust held, and a tap on Fire.
      const thrustAt = await centre('#thrustBtn'), thrust = { ...thrustAt, id: 5 };
      await touch('touchStart', [held, thrust]);
      const fireAt = await centre('#fireBtn');
      await touch('touchStart', [held, thrust, { ...fireAt, id: 6 }]);
      await touch('touchMove', [held, thrust]);
      await page.waitForTimeout(200);
      now = await page.evaluate(() => FighterControl.state());
      assert.equal(now.thrust, true, 'Forward Thrust stays held');
      assert.equal(now.fired.cannon, 2);
      await touch('touchMove', [held]);
      await touch('touchEnd', []);
      await page.waitForTimeout(200);
      now = await page.evaluate(() => FighterControl.state());
      assert.equal(now.thrust, false, 'letting go of Forward Thrust stops it');
      assert.deepEqual(errors, []);
    } finally {
      await touchContext.close();
    }
  },

  'the default keys: half and full turns, half throttle, full stop, max forward and reverse, and the weapon and system toggles': async ({ open: openPage }) => {
    const page = await open(openPage, { lit: true });
    await page.evaluate(() => document.activeElement.blur());
    const hold = async (key, ms) => {
      await page.keyboard.down(key);
      await advance(page, ms);
      await page.keyboard.up(key);
    };
    await hold('a', 1000); // port at half of 30°/s
    assert.ok(near((await state(page)).heading, -15));
    await hold('q', 1000); // port at full rate
    assert.ok(near((await state(page)).heading, -45));
    await hold('e', 1000);
    await hold('d', 2000);
    assert.ok(near((await state(page)).heading, 15));
    await hold('w', 2000); // half of 150 m/s²
    let now = await state(page);
    assert.ok(near(now.speed, 150), `half-rate acceleration (${now.speed})`);
    await hold('x', 1000); // slow at half rate
    assert.ok(near((await state(page)).speed, 75));
    await page.keyboard.press('s'); // full stop
    assert.equal((await state(page)).allStop, true);
    await page.keyboard.press('s'); // pressing again keeps it on
    assert.equal((await state(page)).allStop, true);
    await advance(page, 1000);
    assert.equal((await state(page)).speed, 0);
    // Max forward: full throttle until 2,500 m/s, then the order ends.
    await page.keyboard.press('c');
    await expect(page.locator('#flightState')).toHaveText('TO MAX FORWARD');
    await advance(page, 10000);
    assert.ok(near((await state(page)).speed, 1500));
    await advance(page, 8000);
    now = await state(page);
    assert.ok(near(now.speed, 2500, 0.01) && now.order === 0, 'there, and holding');
    await expect(page.locator('#notice')).toHaveText('At max forward speed · 2,500 m/s.');
    // Max reverse: slows through zero and backs up to 500 m/s; the throttle cancels it.
    await page.keyboard.press('z');
    await advance(page, 5000);
    await page.keyboard.down('w');
    await advance(page, 100);
    await page.keyboard.up('w');
    now = await state(page);
    assert.equal(now.order, 0, 'the throttle cancelled the order');
    await page.keyboard.press('z');
    await advance(page, 30000);
    now = await state(page);
    assert.ok(near(now.speed, 500, 0.01) && near(Math.abs(now.drift), 180, 0.01), 'backing up at max reverse');
    // Toggles and triggers.
    await page.keyboard.press('b');
    assert.equal((await state(page)).weapons, true);
    await page.keyboard.press('n');
    assert.equal((await state(page)).shields, true);
    await page.keyboard.press('v');
    assert.equal((await state(page)).autoDrift, true);
    await advance(page, 5000);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    now = await state(page);
    assert.deepEqual(now.fired, { cannon: 1, torpedo: 1 });
    await page.keyboard.down('f');
    assert.equal((await state(page)).thrust, true);
    await page.keyboard.up('f');
    assert.equal((await state(page)).thrust, false);
  },

  'Menu → Controls rebinds keys: a key in use moves, Backspace unbinds, Escape cancels, and the choice survives a reload': async ({ open: openPage }) => {
    const page = await open(openPage, { lit: true });
    await page.locator('#menuBtn').click();
    await page.locator('#openControls').click();
    const cap = id => page.locator(`.binding[data-action="${id}"] .key-cap`);
    await expect(cap('fireCannon')).toHaveText('←');
    await expect(cap('turnPort')).toHaveText('Q');
    // Fire Cannon on Space; then Q moves from Turn Port to Fire Torpedo.
    await cap('fireCannon').click();
    await expect(cap('fireCannon')).toHaveText('PRESS A KEY…');
    await page.keyboard.press('Space');
    await expect(cap('fireCannon')).toHaveText('SPACE');
    await cap('fireTorpedo').click();
    await page.keyboard.press('q');
    await expect(cap('fireTorpedo')).toHaveText('Q');
    await expect(cap('turnPort')).toHaveText('—');
    await expect(page.locator('#bindingNote')).toHaveText('Q moved from “Turn to port · full rate” to “Launch torpedo”.');
    await cap('nextTarget').click();
    await page.keyboard.press('Backspace');
    await expect(cap('nextTarget')).toHaveText('—');
    await cap('shields').click();
    await page.keyboard.press('Escape');
    await expect(cap('shields')).toHaveText('N');
    await expect(page.locator('#menuDialog')).toBeVisible();
    await page.locator('#menuDialog [data-close]').last().click();
    // The new keys work: Space fires (once, not also through the scope), Q launches.
    await page.evaluate(() => { document.getElementById('weaponsCmd').click(); FighterControl.advance(5000); document.activeElement.blur(); });
    await page.keyboard.press('Space');
    await page.keyboard.press('q');
    let now = await state(page);
    assert.deepEqual(now.fired, { cannon: 1, torpedo: 1 });
    assert.ok(near(now.heading, 0), 'Q no longer turns');
    // Kept after a reload; Reset to Defaults puts them back.
    await page.reload();
    assert.equal((await page.evaluate(() => FighterControl.bindings())).fireCannon, 'Space');
    await page.locator('#menuBtn').click();
    await page.locator('#openControls').click();
    await page.locator('#resetBindings').click();
    await expect(cap('fireCannon')).toHaveText('←');
    await expect(cap('turnPort')).toHaveText('Q');
    // The demo settings are still there.
    await page.locator('#menuBack').click();
    await page.locator('#openDemoControls').click();
    await page.locator('[data-field="turnRate"] [data-edit]').click();
    await page.keyboard.type('90');
    await page.locator('#menuDialog [data-save]').click();
    assert.equal((await state(page)).settings.turnRate, 90);
    await page.locator('#enemyFire').click();
    await expect(page.locator('#enemyFire')).toHaveText('ENEMY FIRE: ON');
  },
});
