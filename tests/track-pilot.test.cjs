// Track autopilot (MissionProtocol "Helm Track Autopilot"): the helm's rule, flown on a simple ship — a turn rate, an
// acceleration limit and braking — against a moving target, near a planet and a station.
const test = require('node:test');
const assert = require('node:assert/strict');
const TrackPilot = require('../demo-app/static-src/Shared/track-pilot.js');

const rad = d => (d * Math.PI) / 180;
const delta = (a, b) => ((a - b + 540) % 360) - 180;

// Flies `seconds` at 10 Hz: the pilot plans each step; the ship turns at most `turn` °/s and changes speed at most `accel`
// km/s² (it moves along its heading). `target(t)` gives the target's place and velocity; `obstacles(t)` the bodies.
function fly({ seconds, target, obstacles = () => [], start = { x: 0, y: 0 }, heading = 0, speed = 0, max = 20, accel = 2, turn = 3, onStep }) {
  const ship = { ...start };
  let t = 0;
  for (; t < seconds; t += 0.1) {
    const velocity = { x: Math.sin(rad(heading)) * speed, y: Math.cos(rad(heading)) * speed };
    const answer = TrackPilot.plan({ ship, velocity, heading, target: target(t), obstacles: obstacles(t), maxSpeed: max, decel: accel / 2, shipLengthKm: 0.3 });
    heading = (heading + Math.max(-turn * 0.1, Math.min(turn * 0.1, delta(answer.course, heading))) + 360) % 360;
    speed += Math.max(-accel * 0.1, Math.min(accel * 0.1, answer.speed - speed));
    ship.x += Math.sin(rad(heading)) * speed * 0.1;
    ship.y += Math.cos(rad(heading)) * speed * 0.1;
    onStep?.({ t, ship, speed, answer });
  }
  return { ship, speed, heading };
}

test('tracking a ship closes on it without overshooting and holds 10 km while it runs', () => {
  const target = t => ({ key: 'ship:B', ship: true, x: 0, y: 200 + 5 * t, vx: 0, vy: 5 });
  let closest = Infinity;
  const end = fly({ seconds: 400, target, onStep: ({ t, ship }) => { if (t > 5) closest = Math.min(closest, Math.hypot(ship.x, ship.y - (200 + 5 * t))); } });
  const range = Math.hypot(end.ship.x, end.ship.y - (200 + 5 * 400));
  assert.ok(Math.abs(range - 10) < 1, `holds 10 km (range ${range.toFixed(2)} km)`);
  assert.ok(Math.abs(end.speed - 5) < 0.3, `matches the target's 5 km/s (${end.speed.toFixed(2)})`);
  assert.ok(closest > 8, `never closer than 8 km on the way in (closest ${closest.toFixed(2)} km)`);
});

test('a ship that comes closer than the standoff is opened to 10 km again', () => {
  const target = () => ({ key: 'ship:B', ship: true, x: 0, y: 3, vx: 0, vy: 0 });
  const end = fly({ seconds: 300, target });
  assert.ok(Math.abs(Math.hypot(end.ship.x, end.ship.y - 3) - 10) < 1);
});

test('chasing a ship past a planet never enters the planet\'s clearance', () => {
  // The target runs past a planet of 6,000 km radius whose surface is 50 km off its line; we follow from far behind at speed.
  const planet = { key: 'planet', name: 'Kestrel', x: 6050, y: 2000, radius: 6000 };
  const target = t => {
    const y = 1000 + 4 * t;
    return { key: 'ship:B', ship: true, x: y < 3000 ? 0 : (y - 3000) * 0.9, y, vx: y < 3000 ? 0 : 3.6, vy: 4 };
  };
  let worst = Infinity;
  fly({ seconds: 1500, target, obstacles: () => [planet], start: { x: 0, y: 0 }, speed: 20, max: 20, onStep: ({ ship }) => { worst = Math.min(worst, Math.hypot(ship.x - planet.x, ship.y - planet.y) - planet.radius); } });
  assert.ok(worst >= TrackPilot.BODY_CLEARANCE_KM - 0.5, `stayed out of the 10 km clearance (closest ${worst.toFixed(2)} km from the surface)`);
});

test('a target sitting inside a planet\'s clearance is held at the clearance\'s edge', () => {
  const planet = { key: 'planet', name: 'Kestrel', x: 0, y: 3000, radius: 2990 };   // surface 10 km in front of the target's spot
  const target = () => ({ key: 'ship:B', ship: true, x: 0, y: 8, vx: 0, vy: 0 });     // 2 km from the surface: inside the clearance
  let worst = Infinity;
  fly({ seconds: 300, target, obstacles: () => [planet], start: { x: 0, y: -400 }, speed: 15, onStep: ({ ship }) => { worst = Math.min(worst, Math.hypot(ship.x - planet.x, ship.y - planet.y) - planet.radius); } });
  assert.ok(worst >= TrackPilot.BODY_CLEARANCE_KM - 0.5, `closest ${worst.toFixed(2)} km from the surface`);
});

test('tracking a station stops at its clearance', () => {
  const station = { key: 'station', name: 'Kestrel Orbital Station', x: 0, y: 500, radius: 1 };
  const end = fly({ seconds: 400, target: () => ({ ...station, ship: false }), obstacles: () => [station] });
  const surface = Math.hypot(end.ship.x - station.x, end.ship.y - station.y) - station.radius;
  assert.ok(surface >= 10 && surface < 12, `stopped ${surface.toFixed(2)} km from the station's surface`);
  assert.ok(end.speed < 0.05);
});

test('other ships on the way are passed 2 km clear', () => {
  const bystander = { key: 'ship:C', name: 'TCS Swift', ship: true, x: 0, y: 100, radius: 0 };
  let worst = Infinity;
  fly({ seconds: 200, target: () => ({ key: 'ship:B', ship: true, x: 0, y: 300, vx: 0, vy: 0 }), obstacles: () => [bystander], onStep: ({ ship }) => { worst = Math.min(worst, Math.hypot(ship.x - bystander.x, ship.y - bystander.y)); } });
  assert.ok(worst >= 2, `passed ${worst.toFixed(2)} km from the other ship`);
});
