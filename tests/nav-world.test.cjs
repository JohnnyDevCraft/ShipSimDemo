// The demo's stand-in world: what the navigation computer knows, and its plotting maths.
const test = require('node:test');
const assert = require('node:assert/strict');
const world = require('../demo-app/static-src/Shared/nav-world.js');

const own = () => ({ ...world.ownShip, ...world.ownShipStart });
const named = name => world.worldObjects().find(object => object.name === name);
const near = (actual, expected, tolerance) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

test('the computer knows SRS contacts, reachable fleet ships and public objects, and nothing else', () => {
  const known = new Map(world.knownObjects(own()).map(entry => [entry.object.name, entry.sources]));
  assert.deepEqual(known.get('TNS Endeavor'), ['SRS', 'FLEET']);          // close by, ours
  assert.deepEqual(known.get('Wasp One'), ['FLEET']);                      // beyond SRS, ours, in reach
  assert.deepEqual(known.get('Survey Buoy 7'), ['SRS']);                   // not public, but in SRS range
  assert.deepEqual(known.get('Neptune'), ['PUBLIC']);                      // far away, public
  assert.equal(known.has('TNS Meridian'), false);                          // ours, beyond communications reach
  assert.equal(known.has('TNS Horizon'), false);                           // ours, another system
  assert.equal(known.has('MV Corbin Trader'), false);                      // not ours, beyond SRS
  assert.equal(known.has('Listening Post Argus'), false);                  // not public, beyond SRS
  assert.equal(known.has('Alpha Centauri I'), false);                      // generated planet, not public
});

test('systems and stars are public; generated planets are not', () => {
  for (const system of Object.keys(world.systemMaps)) assert.equal(named(system).public, true, system);
  for (const object of world.worldObjects()) assert.equal(typeof object.public, 'boolean', object.name);
  assert.equal(named('Alpha Centauri I').public, false);
  assert.equal(named('Alpha Centauri II').public, false);
});

test('a plot for another ship gives course, turn and jump distance', () => {
  const fighter = { x: 0, y: 0, bearing: 350 };
  const plot = world.plotCourse(fighter, { x: 30000, y: 40000, safeKm: 0 });
  near(plot.course, 36.8699, 1e-3);
  near(plot.turn, 46.8699, 1e-3);          // starboard is positive
  near(plot.distanceKm, 50000, 1e-6);
  near(Math.abs(world.plotCourse({ x: 0, y: 0, bearing: 90 }, { x: -10, y: 0, safeKm: 0 }).turn), 180, 1e-9);   // dead astern: either way round
  near(world.plotCourse({ x: 0, y: 0, bearing: 10 }, { x: -10, y: 10, safeKm: 0 }).turn, -55, 1e-9);
});

test("arrival stops outside a body's safety boundary", () => {
  const mars = named('Mars');
  const safe = world.safetyFor('Mars').safe;
  const from = { x: mars.x, y: mars.y - 1e6, bearing: 0 };
  const plot = world.plotCourse(from, world.resolve(world.destinationForObject(mars)));
  near(plot.distanceKm, 1e6 - safe * 1.01, 1e-3);
  near(plot.centerDistanceKm, 1e6, 1e-6);
  const ringEdge = world.plotCourse(from, { x: mars.x, y: mars.y, safeKm: 5000, exactEdge: true });
  near(ringEdge.distanceKm, 1e6 - 5000, 1e-6);
  near(world.plotCourse({ x: mars.x, y: mars.y - 10, bearing: 0 }, world.resolve(world.destinationForObject(mars))).distanceKm, 0, 0);
});

test('the free locator reads distance and bearing from the nearest object and back', () => {
  const mars = named('Mars'), bodies = world.worldObjects().filter(object => object.system === 'Sol' && object.kind !== 'ship');
  const offset = world.polar(38200, 41);
  const reading = world.locate({ x: mars.x + offset.x, y: mars.y + offset.y }, bodies);
  assert.equal(reading.object.name, 'Mars');
  near(reading.distanceKm, 38200, 1e-3);
  near(reading.bearing, 41, 1e-6);
  const moved = world.pointFrom(mars, 52000, 270);
  const again = world.locate(moved, bodies);
  near(again.distanceKm, 52000, 1e-3);
  near(again.bearing, 270, 1e-6);
});

test('the free locator warns inside or too close to a body', () => {
  const mars = named('Mars'), bodies = [mars];
  const at = distance => world.locate(world.pointFrom(mars, distance, 90), bodies).warning;
  assert.equal(at(1000), 'inside');
  assert.equal(at(world.safetyFor('Mars').safe - 1), 'close');
  assert.equal(at(world.safetyFor('Mars').safe + 1), null);
});
