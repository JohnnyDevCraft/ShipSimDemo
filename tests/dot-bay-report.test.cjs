// DOT Bay Control's report, read by Command Control. When DOT Bay Control closes (or its report simply stops arriving)
// the last report is continued: repairs go on only for the DOTs that were repairing, at DOT Bay's own rate, until their
// batteries run out, so the continued figures may understate a repair but never overstate it (R11, ANALYSIS-010).
const test = require('node:test');
const assert = require('node:assert/strict');

function memoryStorage() {
  const items = new Map();
  return { getItem: key => (items.has(key) ? items.get(key) : null), setItem: (key, value) => items.set(key, String(value)), removeItem: key => items.delete(key), clear: () => items.clear() };
}
globalThis.localStorage = memoryStorage();
const DotBayReport = require('../demo-app/static-src/Shared/dot-bay-report.js');

const BATTERY_S = 300;
const T0 = 1_000_000;
const dot = (id, values) => ({ id, state: 'ready', battery: 1, assignment: '', location: 'bay', beamTo: '', beamLeft: 0, outOfAction: false, ...values });
const component = (key, integrity, seconds) => ({ key, name: key, integrity, seconds, left: null });

// DOT Bay Control's own repair rule (DotBay/dotbay.js step): every repairing DOT adds 100 / seconds percent a second to
// the component it is at and drains dt / BATTERY_S of battery; the station's drones add their own rate.
function dotBayItself(report, seconds, { withDrones }) {
  const integrity = Object.fromEntries(report.components.map(c => [c.key, c.integrity]));
  const dots = report.dots.map(d => ({ ...d }));
  const DT = 0.1;
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    for (const d of dots) {
      if (d.state !== 'repairing' || d.outOfAction || d.battery <= 0) continue;
      const c = report.components.find(x => x.key === d.location);
      d.battery = Math.max(0, d.battery - DT / BATTERY_S);
      integrity[c.key] = Math.min(100, integrity[c.key] + (100 / c.seconds) * DT);
    }
    for (const s of withDrones ? report.stationRepair?.systems ?? [] : []) integrity[s.key] = Math.min(100, integrity[s.key] + s.percentPerSecond * DT);
  }
  return integrity;
}

function report(values = {}) {
  return {
    version: 1, at: T0, online: true, batterySeconds: BATTERY_S,
    dots: [
      dot(1, { state: 'repairing', battery: 0.5, assignment: 'reactor', location: 'reactor' }),
      dot(2, { state: 'repairing', battery: 0.2, assignment: 'reactor', location: 'reactor' }),
      dot(3, { state: 'repairing', battery: 1, assignment: 'warp', location: 'warp', outOfAction: true }),
      dot(4, { state: 'charging', battery: 0.4, assignment: 'warp' }),
    ],
    components: [component('reactor', 30, 2400), component('warp', 40, 1800), component('sensors', 80, 600)],
    stationRepair: { stationName: 'Earth Orbital Station', multiplier: 2, systems: [{ key: 'reactor', name: 'Reactor', units: 2, percentPerSecond: (2 * 2 * 100) / 2400 }, { key: 'warp', name: 'Warp', units: 1, percentPerSecond: (2 * 100) / 1800 }] },
    ...values,
  };
}

test('a DOT Bay report that has stopped arriving continues each repair only while its repairing DOTs have battery, never past 100%, and never faster than DOT Bay itself would', () => {
  const last = report();
  for (const seconds of [10, 45, 60, 150, 400]) {
    const continued = DotBayReport.continueReport(last, T0 + seconds * 1000);
    const integrity = key => continued.components.find(c => c.key === key).integrity;
    const dotsOnly = dotBayItself(last, seconds, { withDrones: false });
    const withDrones = dotBayItself(last, seconds, { withDrones: true });
    assert.equal(continued.continued, true);
    for (const c of last.components) {
      // Never more than DOT Bay itself would have repaired (with or without the station's drones) …
      assert.ok(integrity(c.key) <= dotsOnly[c.key] + 0.02, `${c.key} after ${seconds}s: ${integrity(c.key)} > ${dotsOnly[c.key]}`);
      assert.ok(integrity(c.key) <= withDrones[c.key] + 0.02);
      assert.ok(integrity(c.key) <= 100);
      // … and the DOTs' own share is counted, so it is not frozen either.
      assert.ok(Math.abs(integrity(c.key) - dotsOnly[c.key]) < 0.05, `${c.key} after ${seconds}s: ${integrity(c.key)} vs ${dotsOnly[c.key]}`);
    }
  }
  // The two DOTs on the reactor: DOT 2's battery (60 s) runs out first, then DOT 1's (150 s); after that nothing repairs it.
  const late = DotBayReport.continueReport(last, T0 + 3600 * 1000);
  const reactor = late.components.find(c => c.key === 'reactor');
  assert.ok(Math.abs(reactor.integrity - (30 + (100 / 2400) * (150 + 60))) < 1e-6);
  assert.equal(late.dots[0].battery, 0);
  assert.equal(late.dots[1].battery, 0);
  // The out-of-action DOT and the charging DOT are held as reported; the warp is not repaired by them.
  assert.equal(late.components.find(c => c.key === 'warp').integrity, 40);
  assert.equal(late.dots[2].battery, 1);
  assert.deepEqual(late.dots[3], last.dots[3]);
  // No DOT still repairing: no time left to show.
  assert.equal(reactor.left, null);
});

test('a continued repair stops at 100% and drains only the battery it used', () => {
  const last = report({ dots: [dot(1, { state: 'repairing', battery: 1, assignment: 'sensors', location: 'sensors' })] });
  // Sensors need 20% at 100/600 % a second: 120 s, then full.
  const continued = DotBayReport.continueReport(last, T0 + 200 * 1000);
  assert.equal(continued.components.find(c => c.key === 'sensors').integrity, 100);
  assert.ok(Math.abs(continued.dots[0].battery - (1 - 120 / BATTERY_S)) < 1e-9);
  const midway = DotBayReport.continueReport(last, T0 + 60 * 1000);
  assert.ok(Math.abs(midway.components.find(c => c.key === 'sensors').integrity - 90) < 1e-9);
  assert.ok(Math.abs(midway.components.find(c => c.key === 'sensors').left - 60) < 1e-9);
});

test('an older report without the battery length is shown as it was, never guessed forward', () => {
  const { batterySeconds, ...old } = report();
  const continued = DotBayReport.continueReport(old, T0 + 120 * 1000);
  assert.deepEqual(continued.components.map(c => c.integrity), old.components.map(c => c.integrity));
  assert.equal(continued.continued, true);
});

test('read gives the live report while DOT Bay Control reports, the continued one once it closed or went quiet, and nothing without a report', () => {
  localStorage.clear();
  assert.equal(DotBayReport.read(T0), null);
  const { version, at, ...body } = report();
  const realNow = Date.now;
  try {
    Date.now = () => T0;
    DotBayReport.write(body);
    assert.equal(DotBayReport.read(T0 + 1000).continued, undefined, 'fresh: live');
    assert.equal(DotBayReport.read(T0 + DotBayReport.STALE_MS + 1000).continued, true, 'quiet: continued');
    DotBayReport.writeClosed(body);
    const closed = DotBayReport.read(T0 + 1000);
    assert.equal(closed.continued, true, 'closed: continued at once');
    assert.equal(closed.closed, true);
    assert.ok(closed.components.find(c => c.key === 'reactor').integrity > 30);
  } finally {
    Date.now = realNow;
  }
});
