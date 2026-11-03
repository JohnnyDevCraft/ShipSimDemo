// Weapons fire from real ships (Shared/demo-battle.js): the engagement's four ships fly from page load and fight by the
// weapon consoles' rules; the weapon scopes, Fighter and the View Screen show them and their fire; Helm and Navigation add
// an enemy ship that fights ours; the fire shows on short range scans and camera scopes only, at true scale, never on a
// long range scan. Tactical Officer is not part of this (it keeps its own engagement).
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const near = (a, b, px, what) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= px, `${what}: ${a.x.toFixed(1)},${a.y.toFixed(1)} vs ${b.x.toFixed(1)},${b.y.toFixed(1)}`);
const wrap = d => ((d % 360) + 540) % 360 - 180;
// Polls `test` in the page until it returns something truthy.
async function until(page, test, arg, seconds = 30) {
  for (let i = 0; i < seconds * 4; i++) {
    const value = await page.evaluate(test, arg);
    if (value) return value;
    await page.waitForTimeout(250);
  }
  throw new Error('timed out waiting for ' + test.toString().slice(0, 120));
}
// Holds the engagement at a moment with a torpedo, a pulse and a beam in flight between its ships, and returns it.
const holdBusy = page => page.evaluate(() => {
  const t = DemoBattle.busyMoment(['torpedo', 'pulse', 'beam'], Math.floor(Date.now() / 1000));
  DemoBattle.hold(t);
  return t;
});
async function demoButton(page, selector) {
  await page.locator('#menuBtn').click();
  await page.locator('#openDemoControls').click();
  await page.locator(`#menuDialog ${selector}`).click();
  await page.locator('#menuDialog [data-close]').last().click();
  await expect(page.locator('#menuDialog')).toHaveJSProperty('open', false);
}
// Every beam drawn runs from a drawn ship (the shooter) to near a drawn ship (the target's shield).
function beamsJoinShips(drawn, what, slack = 8) {
  const beams = drawn.marks.filter(m => m.kind === 'beam' && m.fromShip !== 'us' && m.toShip !== 'us');
  for (const beam of beams) {
    const from = drawn.ships.find(s => s.id === beam.fromShip), to = drawn.ships.find(s => s.id === beam.toShip);
    if (!from || !to) continue;
    near({ x: beam.fromX, y: beam.fromY }, from, 1.5, `${what}: beam ${beam.id} starts at ${beam.fromShip}`);
    near(beam, to, slack, `${what}: beam ${beam.id} ends at ${beam.toShip}`);
  }
  return beams.length;
}

run({
  'The engagement: four ships from load, moving, firing by the weapon consoles\' rules from shooter to target': async ({ open }) => {
    const page = await open('/PhaseCannon/?models=0');
    await page.waitForFunction(() => typeof EnergyWeapon === 'object');
    const first = await page.evaluate(() => DemoBattle.ships().map(s => ({ name: s.name, x: s.x, y: s.y, d: Math.hypot(s.x, s.y) })));
    assert.deepEqual(first.map(s => s.name), ['Corsair Vex', 'Corsair Mako', 'TSC Valiant', 'TSC Ardent']);
    for (const s of first) assert.ok(s.d > 20000 && s.d < 60000, `${s.name} is within short range (${s.d.toFixed(0)} m)`);
    await page.waitForTimeout(1000);
    const second = await page.evaluate(() => DemoBattle.ships().map(s => ({ x: s.x, y: s.y })));
    first.forEach((s, i) => assert.ok(Math.hypot(second[i].x - s.x, second[i].y - s.y) > 100, `${s.name} moved`));
    // Every shot fired over two minutes obeys the rules, starts at its shooter and ends at what it hit.
    const report = await page.evaluate(() => {
      const t0 = Math.floor(Date.now() / 1000), seen = new Map(), problems = [];
      DemoBattle.hold(t0);
      for (let t = t0; t < t0 + 120; t += 0.25) for (const shot of DemoBattle.shots(t)) if (shot.fromShip !== 'us' && shot.toShip !== 'us') seen.set(shot.id, shot);
      const at = (id, t) => DemoBattle.ships(t, []).find(s => s.id === id);
      const wrap = d => ((d % 360) + 540) % 360 - 180;
      for (const shot of seen.values()) {
        const me = at(shot.fromShip, shot.t0), target = at(shot.toShip, shot.t0), rule = DemoBattle.RULES[shot.key];
        if (Math.hypot(shot.from.x - me.x, shot.from.y - me.y) > 1) problems.push(`${shot.id} does not start at its shooter`);
        if (Math.hypot(target.x - me.x, target.y - me.y) > rule.range * 1.01) problems.push(`${shot.id} fired beyond range`);
        const weapon = DemoBattle.RAIDER_WEAPONS.find(w => w.key === shot.key), aim = shot.dir ? (Math.atan2(shot.dir.x, shot.dir.y) * 180) / Math.PI : null;
        if (aim !== null && Math.abs(wrap(aim - me.heading)) > weapon.arc + 0.01) problems.push(`${shot.id} fired outside its arc`);
        if (shot.hit && shot.kind !== 'beam') {
          const end = { x: shot.from.x + shot.dir.x * shot.speed * (shot.tEnd - shot.t0), y: shot.from.y + shot.dir.y * shot.speed * (shot.tEnd - shot.t0) }, hit = at(shot.hitShip, shot.tEnd);
          if (Math.hypot(end.x - hit.x, end.y - hit.y) > hit.shieldRadius + 1) problems.push(`${shot.id} does not end on ${shot.hitShip}'s shield`);
        }
        if (!shot.hit && shot.kind === 'pulse' && Math.abs((shot.tEnd - shot.t0) * shot.speed - 90000) > 1) problems.push(`${shot.id} missed but did not fly to its 90 km`);
      }
      DemoBattle.release();
      const kinds = [...new Set([...seen.values()].map(s => s.kind))].sort();
      return { count: seen.size, kinds, problems, hits: [...seen.values()].filter(s => s.hit).length };
    });
    assert.deepEqual(report.problems, []);
    assert.deepEqual(report.kinds, ['beam', 'pulse', 'torpedo']);
    assert.ok(report.count >= 20 && report.count <= 160, `a shot every few seconds (${report.count} in two minutes)`);
    assert.ok(report.hits > report.count / 2, 'most shots hit');
  },
  'EPW and Torpedo Launch: the engagement\'s ships are targets on the scope, and their fire is drawn ship to ship': async ({ open }) => {
    for (const [route, hook] of [['/PhaseCannon/?models=0', 'EnergyWeapon'], ['/TorpedoLaunch/?models=0', 'TorpedoLaunch']]) {
      const page = await open(route);
      await page.waitForFunction(name => typeof window[name] === 'object' || typeof eval(name) === 'object', hook);
      await holdBusy(page);
      await page.waitForTimeout(300);
      const drawn = await page.evaluate(() => DemoBattle.drawn.scope);
      assert.ok(drawn.ships.length >= 3, `${route}: the ships are on the scope`);
      assert.ok(drawn.marks.length >= 2, `${route}: their fire is drawn`);
      beamsJoinShips(drawn, route, 10);
      const names = await page.evaluate(h => eval(h).state().contacts.map(c => c.name), hook);
      assert.ok(names.includes('Training ship A') && names.includes('Corsair Vex'), `${route}: training ship and the engagement's ships are contacts`);
      // Tap a raider: it is the target, with a firing solution.
      const point = await page.evaluate(h => eval(h).tapPoint('ship:Corsair Mako') || eval(h).tapPoint('ship:Corsair Vex'), hook);
      assert.ok(point, `${route}: a raider can be tapped`);
      await page.mouse.click(point.x, point.y);
      const state = await page.evaluate(h => eval(h).state(), hook);
      assert.match(state.selected, /^ship:Corsair /, `${route}: the raider is selected`);
      assert.ok(state.lead, `${route}: with a firing solution`);
      await page.close();
    }
  },
  'View Screen: the scope shows the ships and their fire; the SRS panel shows the fight heading up; the LRS none of it': async ({ open }) => {
    const page = await open('/ViewScreen/?models=0');
    await page.waitForFunction(() => typeof ViewScreen === 'object');
    await page.evaluate(() => ViewScreenSettings.write({ srs: '100-km', mode: 'dual' }));
    await holdBusy(page);
    await page.waitForTimeout(400);
    const scope = await page.evaluate(() => DemoBattle.drawn['view-scope']);
    assert.ok(scope.ships.length >= 3 && scope.marks.length >= 2, 'ships and fire on the scope');
    beamsJoinShips(scope, 'scope', 10);
    const srs = await page.evaluate(() => DemoBattle.drawn['view-srs']);
    assert.ok(srs.ships.length === 4 && srs.marks.length >= 2, 'the SRS panel draws the fight');
    beamsJoinShips(srs, 'SRS panel', 3);
    const lrs = await page.evaluate(() => DemoBattle.drawn['view-lrs']);
    assert.deepEqual(lrs, { ships: [], marks: [] }, 'nothing of it on the LRS panel');
    // Heading up: every contact sits at its bearing relative to the bow (0° up, starboard right) on both panels.
    for (const [id, range] of [['srs', '100-km'], ['srs', '1-mkm'], ['lrs', '1-bkm'], ['lrs', '30-ly']]) {
      await page.evaluate(([key, value]) => ViewScreenSettings.write({ [key]: value }), [id, range]);
      await page.waitForTimeout(200);
      const result = await page.evaluate(scannerId => {
        const drawn = ViewScreen.scanner(scannerId), pose = ViewScreen.state().pose, objects = NavWorld.worldObjects();
        return drawn.contacts.map(c => {
          const o = objects.find(x => x.key === c.key) || NavWorld.earthSettlements.map(NavWorld.settlementPosition).find(x => x.name === c.name);
          const bearing = (Math.atan2(o.x - pose.x, o.y - pose.y) * 180) / Math.PI;
          return { name: c.name, relative: bearing - pose.heading, dx: c.x - drawn.cx, dy: c.y - drawn.cy };
        });
      }, id);
      const placed = result.filter(c => Math.hypot(c.dx, c.dy) > 4);
      assert.ok(placed.length, `${id} ${range}: contacts drawn`);
      for (const c of placed) assert.ok(Math.abs(wrap((Math.atan2(c.dx, -c.dy) * 180) / Math.PI - c.relative)) < 1, `${id} ${range}: ${c.name} at ${c.relative.toFixed(1)}° relative`);
      const ahead = placed.find(c => Math.abs(wrap(c.relative)) < 0.5), bow = placed.find(c => wrap(c.relative) > 5 && wrap(c.relative) < 85);
      if (ahead) assert.ok(Math.abs(ahead.dx) < 1.5 && ahead.dy < 0, `${id} ${range}: ${ahead.name}, dead ahead, is straight above our ship`);
      if (bow) assert.ok(bow.dx > 0 && bow.dy < 0, `${id} ${range}: ${bow.name}, off the starboard bow, is up and to the right`);
      if (range === '1-mkm') assert.ok(ahead?.name === 'Earth', `${id} ${range}: Earth, which the stand-in faces, is dead ahead`);
    }
  },
  'Helm: an added enemy fires at us, we fire back in arc, Track follows it, nothing shows on the LRS or far out, and Navigation sees it too': async ({ open }) => {
    const page = await open('/Helm/index.html');
    const navigation = await open('/Navigation/index.html');
    await navigation.waitForFunction(() => typeof NavigationControl === 'object');
    await demoButton(page, '[data-demo-enemy]');
    await expect(page.locator('#menuDialog [data-demo-enemy]')).toHaveText('REMOVE ENEMY SHIP');
    await page.evaluate(() => (setMode('SRS'), setZoom(zoomFor(rangeScales.SRS, 25))));
    // The enemy is a contact on the scan, 14 km ahead.
    const enemy = await until(page, () => mapContacts.find(c => c.name === 'Black Pearl'));
    assert.ok(Math.abs(enemy.distanceKm - 14) < 10, `14 km ahead, give or take its weave (${enemy.distanceKm.toFixed(1)} km)`);
    // It fires at us, and we fire back, each shot inside its weapon's range and arc.
    const shots = await until(page, () => {
      const list = DemoBattle.shots();
      return list.some(s => s.fromShip === 'black-pearl') && list.some(s => s.fromShip === 'us') && list.filter(s => s.inFlight || s.kind === 'beam');
    }, null, 60);
    const ours = await page.evaluate(() => {
      const shot = DemoBattle.shots().find(s => s.fromShip === 'us');
      return shot && { weapon: DemoBattle.OUR_WEAPONS.find(w => w.id === shot.weapon), dir: shot.dir, from: shot.from, heading: heading, kind: shot.kind };
    });
    if (ours?.dir) assert.ok(Math.abs(wrap((Math.atan2(ours.dir.x, ours.dir.y) * 180) / Math.PI - ours.heading - ours.weapon.facing)) <= ours.weapon.arc + 0.01, 'our shot left inside its weapon\'s arc');
    assert.ok(shots.length >= 1);
    // The fire on the scan starts at a ship and ends at the other.
    const drawn = await until(page, () => {
      const d = DemoBattle.drawn.helm;
      return d.marks.some(m => m.kind === 'beam') && d;
    }, null, 60);
    const ship = drawn.ships[0], centre = await page.evaluate(() => ({ x: projection.cx, y: projection.cy }));
    for (const beam of drawn.marks.filter(m => m.kind === 'beam')) {
      const [from, to] = beam.fromShip === 'us' ? [centre, ship] : [ship, centre];
      near({ x: beam.fromX, y: beam.fromY }, from, 2, 'beam starts at its shooter');
      near(beam, to, 12, 'beam ends at its target');
    }
    // Navigation, in another tab, has it as a sensor contact.
    await navigation.locator('#openKnown').click().catch(() => {});
    await until(navigation, () => NavWorld.knownObjects(NavWorld.ownShipStart).some(e => e.object.name === 'Black Pearl' && e.sources.includes('SRS')));
    // Track follows it.
    const point = await page.evaluate(() => mapContacts.find(c => c.name === 'Black Pearl'));
    await page.mouse.click(point.x, point.y);
    await page.locator('#trackBtn').click();
    await expect(page.locator('#trackBtn')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#contactChip')).toContainText('TRACKING · Black Pearl');
    await page.waitForTimeout(2500);
    const steer = await page.evaluate(() => {
      const place = trackedPlace();
      return { goal: goal ?? heading, bearing: NavWorld.bearingTo(ship, place) };
    });
    assert.ok(Math.abs(wrap(steer.goal - steer.bearing)) < 3, `the course follows the enemy (${steer.goal.toFixed(1)}° for ${steer.bearing.toFixed(1)}°)`);
    // Far out the fire is too small to see; on the LRS there is none, and no enemy.
    await page.evaluate(() => setZoom(zoomFor(rangeScales.SRS, 1e6)));
    await page.waitForTimeout(300);
    assert.deepEqual((await page.evaluate(() => DemoBattle.drawn.helm)).marks, [], 'no fire drawn at 1 MKM');
    await page.evaluate(() => setMode('LRS'));
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(() => DemoBattle.drawn.helm), { ships: [], marks: [] }, 'no fire on the LRS');
    assert.ok(!(await page.evaluate(() => mapContacts.some(c => c.world.battle))), 'no enemy on the LRS');
    // Removed: gone everywhere.
    await demoButton(page, '[data-demo-enemy]');
    assert.deepEqual(await page.evaluate(() => DemoBattle.ships()), []);
    await until(navigation, () => !NavWorld.worldObjects().some(o => o.battle));
  },
  'Navigation: the enemy and its fight close in, none far out, and a reported raider where it was reported, with no fire': async ({ open }) => {
    const page = await open('/Navigation/index.html');
    await page.waitForFunction(() => typeof NavigationControl === 'object');
    await demoButton(page, '[data-demo-enemy]');
    const known = await page.evaluate(() => NavWorld.knownObjects(NavWorld.ownShipStart).filter(e => e.object.kind === 'ship').map(e => ({ name: e.object.name, sources: e.sources, report: e.object.report })));
    assert.deepEqual(known.find(k => k.name === 'Black Pearl').sources, ['SRS'], 'the enemy is a sensor contact');
    const reported = known.find(k => k.name === 'Corsair Scythe');
    assert.deepEqual(reported.sources, ['REPORT'], 'the raider is known by report');
    assert.equal(reported.report.by, 'Earth Orbital Station');
    await page.locator('#centerShip').click();
    await page.evaluate(() => NavigationControl.setRadius(25));
    const drawn = await until(page, () => {
      const d = DemoBattle.drawn.navigation;
      return d && d.ships.length && d.marks.some(m => m.kind !== 'shield') && d;
    }, null, 60);
    assert.deepEqual(drawn.ships.map(s => s.id), ['black-pearl'], 'only the enemy fights: the reported raider has no fire');
    await page.evaluate(() => NavigationControl.setRadius(1e6));
    await page.waitForTimeout(400);
    assert.deepEqual((await page.evaluate(() => DemoBattle.drawn.navigation)).marks, [], 'no fire drawn at 1 MKM');
    // The reported raider is drawn where it was reported, labelled with the report's age.
    await page.evaluate(() => NavigationControl.setRadius(2e9));
    await page.waitForTimeout(400);
    const scythe = await page.evaluate(() => NavigationControl.contacts().find(c => c.name === 'Corsair Scythe'));
    const expected = await page.evaluate(() => NavWorld.worldObjects().find(o => o.name === 'Corsair Scythe'));
    assert.ok(scythe, 'the reported raider is on the map');
    assert.ok(expected.report && !expected.speedKmS, 'it stays at its reported position');
    await demoButton(page, '[data-demo-enemy]');
  },
  'Fighter: the engagement\'s ships and fire on its scan and scope': async ({ open }) => {
    const page = await open('/Fighter/?models=0');
    await page.waitForFunction(() => typeof FighterControl === 'object');
    await holdBusy(page);
    await page.waitForTimeout(400);
    const srs = await page.evaluate(() => DemoBattle.drawn['fighter-srs']);
    assert.ok(srs.ships.length >= 3, 'the ships are on the scan');
    assert.ok(srs.marks.length >= 1, 'their fire is on the scan');
    beamsJoinShips(srs, 'Fighter scan', 3);
    const scope = await page.evaluate(() => DemoBattle.drawn.scope);
    assert.ok(scope.ships.length >= 1, 'and on the scope');
  },
});
