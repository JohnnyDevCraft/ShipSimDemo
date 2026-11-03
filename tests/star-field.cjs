// The background star field: on the map views its pin dots are fixed to the map's ground, so panning and zooming move
// them with everything else; on the View Screen's scope, stars more than 2 light years away are not drawn, and a
// destination that is not drawn gets a reticle where it lies.
const assert = require('node:assert/strict');
const { run } = require('./browser-harness.cjs');

// The dots the star field drew on a view in its latest frame, by cell.
const dotsOf = (page, name) => page.evaluate(view => StarField.frames[view]?.dots ?? [], name);
// A layer's pattern repeats every StarField.TILE (64) cells and a view numbers cells from the repeat it is in, so a cell is
// the same star when its numbers agree modulo 64; of its copies, the one nearest where it should be is taken.
const sameCell = (a, b) => a.layer === b.layer && ((a.i - b.i) & 63) === 0 && ((a.j - b.j) & 63) === 0;
const nearestCopy = (dots, dot, x, y) =>
  dots.filter(other => sameCell(dot, other)).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
// Navigation's map, recording the star field, at a radius; its canvas's centre and size.
async function navigationMap(page, radiusKm) {
  await page.waitForFunction(() => typeof NavigationControl === 'object');
  await page.evaluate(radius => ((StarField.record = true), NavigationControl.setRadius(radius)), radiusKm);
  await page.waitForTimeout(100);
  return page.locator('#map').evaluate(map => ({ cx: map.clientWidth / 2, cy: map.clientHeight / 2, width: map.clientWidth, height: map.clientHeight }));
}
// Dots well inside the map, away from the panels over its edges.
const central = (dots, map) => dots.filter(d => Math.abs(d.x - map.cx) < map.width * 0.2 && Math.abs(d.y - map.cy) < map.height * 0.2);

run({
  'dragging the navigation map moves the background stars with it': async ({ open }) => {
    const page = await open('/Navigation/');
    const map = await navigationMap(page, 200000);
    const before = central(await dotsOf(page, 'navigation'), map);
    assert.ok(before.length > 3, 'stars are drawn near the map centre');
    const box = await page.locator('#map').boundingBox(), start = { x: box.x + map.cx + 40, y: box.y + map.cy + 30 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let step = 1; step <= 6; step++) await page.mouse.move(start.x + 20 * step, start.y + 12 * step);
    await page.mouse.up();
    await page.waitForTimeout(100);
    const after = await dotsOf(page, 'navigation');
    let matched = 0;
    for (const dot of before) {
      const moved = nearestCopy(after, dot, dot.x + 120, dot.y + 72);
      if (!moved) continue;
      matched++;
      assert.ok(Math.abs(moved.x - dot.x - 120) < 1.5 && Math.abs(moved.y - dot.y - 72) < 1.5, `a star moved by ${moved.x - dot.x}, ${moved.y - dot.y} instead of 120, 72`);
    }
    assert.ok(matched > 3, `the same stars are drawn after the drag (${matched})`);
  },
  'zooming the navigation map spreads the background stars from its centre': async ({ open }) => {
    const page = await open('/Navigation/');
    const map = await navigationMap(page, 200000);
    const before = central(await dotsOf(page, 'navigation'), map);
    await navigationMap(page, 100000);
    const after = await dotsOf(page, 'navigation');
    let matched = 0;
    for (const dot of before) {
      const expected = { x: map.cx + 2 * (dot.x - map.cx), y: map.cy + 2 * (dot.y - map.cy) };
      const zoomed = nearestCopy(after, dot, expected.x, expected.y);
      if (!zoomed) continue;
      matched++;
      assert.ok(Math.hypot(zoomed.x - expected.x, zoomed.y - expected.y) < 1.5, `a star went to ${zoomed.x}, ${zoomed.y} instead of ${expected.x}, ${expected.y}`);
    }
    assert.ok(matched > 3, `the same stars are drawn after zooming in (${matched})`);
  },
  'the view screen hides stars beyond 2 light years and marks the destination there': async ({ open }) => {
    const page = await open('/ViewScreen/');
    await page.waitForFunction(() => window.ViewScreen?.state().destination);
    // Look straight at the destination, Gliese 1061 (12 light years off).
    const look = await page.evaluate(() => {
      const { pose, destination } = ViewScreen.state();
      return (((Math.atan2(destination.x - pose.x, destination.y - pose.y) * 180) / Math.PI - pose.heading) % 360 + 360) % 360;
    });
    await page.evaluate(camera => ViewScreenSettings.write({ camera, zoom: 1 }), look);
    await page.waitForTimeout(500);
    const seen = await page.evaluate(() => (ViewScreen.frame(), ViewScreen.visible()));
    assert.ok(!seen.some(v => v.kind === 'star' && v.distance > 2 * 9460730472580.8), 'no star beyond 2 light years is on the scope');
    assert.ok(!seen.some(v => v.name === 'Gliese 1061'), 'Gliese 1061 is not drawn');
    const reticle = await page.evaluate(() => ViewScreen.destinationReticle());
    assert.ok(reticle, 'the destination has a reticle');
    assert.equal(reticle.name, 'Gliese 1061');
    assert.ok(reticle.distanceKm > 11 * 9460730472580.8, 'the reticle is for the far star');
    // Sol, an astronomical unit away, is still drawn when we look at it.
    const sol = await page.evaluate(() => {
      const { pose } = ViewScreen.state(), sun = NavWorld.worldObjects().find(o => o.name === 'Sol');
      return (((Math.atan2(sun.x - pose.x, sun.y - pose.y) * 180) / Math.PI - pose.heading) % 360 + 360) % 360;
    });
    await page.evaluate(camera => ViewScreenSettings.write({ camera }), sol);
    await page.waitForTimeout(500);
    const near = await page.evaluate(() => (ViewScreen.frame(), ViewScreen.visible()));
    assert.ok(near.some(v => v.name === 'Sol'), 'Sol is drawn');
  },
});
