// Rules of the stand-in navigation computer shared by the Helm and Navigation demos.
const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../demo-app/static-src/Shared/nav-computer.js');

const OWN = 'TN-0417', FIGHTER = 'TF-101';
const mars = { kind: 'object', key: 'Sol|Mars', name: 'Mars', system: 'Sol', safeKm: 39390 };
const earth = { kind: 'object', key: 'Sol|Earth', name: 'Earth', system: 'Sol', safeKm: 44597 };

function memoryStorage() {
  const items = new Map();
  return { getItem: key => (items.has(key) ? items.get(key) : null), setItem: (key, value) => items.set(key, String(value)), removeItem: key => items.delete(key) };
}
function rig(options = {}) {
  const clock = { ms: 1_000_000 };
  const storage = options.storage ?? memoryStorage();
  const computer = create({ storage, now: () => clock.ms, ownRegistry: OWN, ...options });
  return { computer, clock, storage, advance: seconds => { clock.ms += seconds * 1000; computer.tick(); } };
}

test('holds one destination per ship, keyed by registry number', () => {
  const { computer, advance } = rig();
  computer.plot(OWN, mars); advance(10);
  computer.plot(FIGHTER, earth); advance(10);
  assert.equal(computer.destinationFor(OWN).name, 'Mars');
  assert.equal(computer.destinationFor(FIGHTER).name, 'Earth');
  assert.deepEqual(Object.keys(computer.state().destinations).sort(), [FIGHTER, OWN].sort());
});

test('a plot takes the calculation time before the destination appears', () => {
  const { computer, advance } = rig();
  computer.setCalculationSeconds(10);
  assert.deepEqual(computer.plot(OWN, mars), { ok: true });
  advance(9.9);
  assert.equal(computer.destinationFor(OWN), null);
  assert.equal(computer.calculation().registry, OWN);
  assert.ok(Math.abs(computer.calculation().fraction - 0.99) < 1e-9);
  advance(0.1);
  assert.equal(computer.destinationFor(OWN).name, 'Mars');
  assert.equal(computer.calculation(), null);
});

test('a new plot replaces the one still calculating', () => {
  const { computer, advance } = rig();
  computer.plot(OWN, mars); advance(4);
  computer.plot(FIGHTER, earth); advance(10);
  assert.equal(computer.destinationFor(OWN), null);
  assert.equal(computer.destinationFor(FIGHTER).name, 'Earth');
});

test('unpowered, the computer keeps its destinations and refuses changes', () => {
  const { computer, advance } = rig();
  computer.plot(OWN, mars); advance(10);
  computer.setPower(false);
  assert.deepEqual(computer.plot(OWN, earth), { ok: false, reason: 'unpowered' });
  assert.deepEqual(computer.plot(FIGHTER, earth), { ok: false, reason: 'unpowered' });
  assert.deepEqual(computer.clear(OWN), { ok: false, reason: 'unpowered' });
  advance(60);
  assert.equal(computer.destinationFor(OWN).name, 'Mars');
  assert.equal(computer.calculation(), null);
});

test("two consoles share our ship's destination", () => {
  const storage = memoryStorage();
  const navigation = rig({ storage }), helm = rig({ storage });
  let helmNotified = 0;
  helm.computer.subscribe(() => helmNotified++);
  navigation.computer.plot(OWN, mars); navigation.advance(10);
  helm.computer.sync();
  assert.equal(helm.computer.destinationFor(OWN).name, 'Mars');
  assert.ok(helmNotified > 0);
  navigation.computer.clear(OWN);
  helm.computer.sync();
  assert.equal(helm.computer.destinationFor(OWN), null);
});

test('a free point is a destination with no catalogue object', () => {
  const { computer, advance } = rig();
  const point = { kind: 'point', name: 'Free point', system: 'Sol', x: 1.5e8, y: -2.25e8 };
  assert.deepEqual(computer.plot(OWN, point), { ok: true });
  advance(10);
  const held = computer.destinationFor(OWN);
  assert.equal(held.kind, 'point');
  assert.equal(held.key, undefined);
  assert.deepEqual([held.x, held.y], [1.5e8, -2.25e8]);
  assert.deepEqual(computer.plot(OWN, { kind: 'point', name: 'Nowhere', x: NaN, y: 0 }), { ok: false, reason: 'invalid' });
});

test("our ship's destination is locked while it is at warp", () => {
  const { computer, advance } = rig();
  computer.plot(OWN, mars); advance(10);
  computer.reportOwnShip({ registry: OWN, x: 0, y: 0, bearing: 0, atWarp: true });
  assert.deepEqual(computer.plot(OWN, earth), { ok: false, reason: 'at-warp' });
  assert.deepEqual(computer.clear(OWN), { ok: false, reason: 'at-warp' });
  assert.deepEqual(computer.plot(FIGHTER, earth), { ok: true });
  assert.equal(computer.destinationFor(OWN).name, 'Mars');
});

test('stored state from another version is discarded', () => {
  const storage = memoryStorage();
  storage.setItem('xmps-demo-navigation', JSON.stringify({ version: -1, destinations: { [OWN]: mars }, power: false }));
  const { computer } = rig({ storage, defaults: () => ({ destinations: { [OWN]: earth } }) });
  assert.equal(computer.destinationFor(OWN).name, 'Earth');
  assert.equal(computer.state().power, true);
});

// One window, one console at a time (R11): the Helm's last report is carried on when the Helm page is not open.
test('a Helm report that has stopped arriving keeps flying the ship on its last heading and speed, and a warp stops at its arrival', () => {
  const { computer, clock } = rig();
  const { OWN_SHIP_FRESH_MS } = require('../demo-app/static-src/Shared/nav-computer.js');
  // Closed (the page said so): flown on at once, heading held, the turn dropped.
  computer.reportOwnShip({ registry: OWN, x: 0, y: 0, bearing: 90, course: 90, speedKmS: 100, atWarp: false, turnRate: 3, warpFactor: 0, arrival: null, dock: 'undocked', closed: true });
  clock.ms += 10_000;
  let ship = computer.ownShip();
  assert.equal(ship.continued, true);
  assert.ok(Math.abs(ship.x - 1000) < 1e-6 && Math.abs(ship.y) < 1e-6, `1,000 km east (${ship.x}, ${ship.y})`);
  assert.equal(ship.bearing, 90);
  assert.equal(ship.turnRate, 0);
  assert.equal(ship.at, clock.ms);
  // Not closed, but silent past the freshness limit (a tablet does not always say a page closed): flown on the same way.
  computer.reportOwnShip({ registry: OWN, x: 0, y: 0, bearing: 0, course: 0, speedKmS: 10, atWarp: false, turnRate: 0, warpFactor: 0, arrival: null, dock: 'undocked' });
  clock.ms += 30_000;
  assert.equal(computer.ownShip().continued, undefined, 'a fresh live report is returned as reported');
  clock.ms += OWN_SHIP_FRESH_MS;
  ship = computer.ownShip();
  assert.equal(ship.continued, true);
  assert.ok(Math.abs(ship.y - 10 * (30 + OWN_SHIP_FRESH_MS / 1000)) < 1e-6, `flown north since the report (${ship.y})`);
  // A warp jump ends at its arrival and the ship is then out of warp and stopped.
  computer.reportOwnShip({ registry: OWN, x: 0, y: 0, bearing: 0, course: 0, speedKmS: 299792.458, atWarp: true, turnRate: 0, warpFactor: 1, arrival: { x: 0, y: 1e6 }, dock: 'undocked', closed: true });
  clock.ms += 60_000;
  ship = computer.ownShip();
  assert.deepEqual([ship.x, ship.y, ship.atWarp, ship.speedKmS, ship.warpFactor, ship.arrival], [0, 1e6, false, 0, 0, null]);
  // Docked stays docked.
  computer.reportOwnShip({ registry: OWN, x: 5, y: 6, bearing: 0, course: 0, speedKmS: 0, atWarp: false, turnRate: 0, warpFactor: 0, arrival: null, dock: 'clamps', closed: true });
  clock.ms += 600_000;
  ship = computer.ownShip();
  assert.deepEqual([ship.x, ship.y, ship.dock], [5, 6, 'clamps']);
});

test('a Helm report older than the session limit is forgotten', () => {
  const { computer, clock } = rig();
  const { OWN_SHIP_SESSION_MS } = require('../demo-app/static-src/Shared/nav-computer.js');
  assert.equal(OWN_SHIP_SESSION_MS, 4 * 3600 * 1000);
  computer.reportOwnShip({ registry: OWN, x: 0, y: 0, bearing: 0, course: 0, speedKmS: 10, atWarp: false, turnRate: 0, closed: true });
  clock.ms += OWN_SHIP_SESSION_MS;
  assert.ok(computer.ownShip(), 'still carried on at the limit');
  clock.ms += 1;
  assert.equal(computer.ownShip(), null);
  assert.equal(computer.resumeOwnShip(), null);
  // A null report (Reset demo, or a test) still means no ship at all.
  computer.reportOwnShip(null);
  assert.equal(computer.ownShip(), null);
});
