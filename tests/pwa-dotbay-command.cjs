// One window, one console at a time (R11): a repair started in DOT Bay Control carries on when the host switches to
// Command Control in the same window, and DOT Bay Control picks it up again with the same numbers.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

// Tap a cradle where it is on screen (WebKit's test driver misplaces clicks on SVG groups).
async function tapCradle(page, i) {
  const b = await page.locator(`#cradle${i}`).evaluate(g => { const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(b.x, b.y);
}
const sensorsOn = ship => ship.components.find(c => c.key === 'sensors').integrity;
const SENSORS_RATE = 100 / 600; // % a second for one DOT (Sensors: ten minutes)

run({
  'after assigning a DOT in DOT Bay and switching to Command in the same window, Command shows that repair progressing, and DOT Bay resumes it with the same numbers': async ({ open, base }) => {
    const page = await open('/DotBay/');
    await tapCradle(page, 0); // DOT 1
    await page.locator('#assignBtn').click();
    await page.locator('#assignGrid [data-component="sensors"]').click();
    await expect(page.locator('#assignDialog')).toBeHidden();
    // Ten seconds of beaming, then two of repair (the demo's test clock).
    await page.evaluate(() => DotBay.step(12));
    await page.waitForTimeout(600); // the next twice-a-second report

    await page.goto(base + '/Command/index.html');
    await expect(page.locator('#sourceNote')).toHaveText('DOT Bay closed · repairs continuing from its last report');
    await expect(page.locator('#sourceLight')).toHaveAttribute('data-level', 'continued');
    await expect(page.locator('.dot-card').nth(0)).toContainText('REPAIRING');
    await expect(page.locator('.dot-card').nth(0)).toContainText('At Sensors');
    await expect(page.locator('#componentList li[data-component="sensors"] .cdots i')).toHaveText('1');
    const first = sensorsOn((await page.evaluate(() => CommandControl.state())).ship);
    assert.ok(first > 80, `sensors repaired past the starting 80% (${first})`);
    await page.waitForTimeout(2500);
    await page.evaluate(() => CommandControl.refresh());
    const before = await page.evaluate(() => ({ ship: CommandControl.state().ship, at: Date.now() }));
    assert.ok(sensorsOn(before.ship) > first + 0.2, `the repair progresses on Command (${first} → ${sensorsOn(before.ship)})`);

    await page.goto(base + '/DotBay/index.html');
    const after = await page.evaluate(() => ({ state: DotBay.state(), at: Date.now() }));
    const elapsed = (after.at - before.at) / 1000;
    const bay = after.state.integrity.sensors, shown = sensorsOn(before.ship);
    assert.ok(bay >= shown - 1e-6 && bay <= shown + SENSORS_RATE * (elapsed + 0.5), `DOT Bay resumes where Command showed it (${shown} → ${bay} in ${elapsed}s)`);
    const dot1 = after.state.dots[0], shownDot = before.ship.dots[0];
    assert.equal(dot1.state, 'repairing');
    assert.equal(dot1.location, 'sensors');
    assert.equal(dot1.assignment, 'sensors');
    assert.ok(dot1.battery <= shownDot.battery + 1e-6 && dot1.battery >= shownDot.battery - (elapsed + 0.5) / 300, `the same battery (${shownDot.battery} → ${dot1.battery})`);
    await expect(page.locator('#advisory')).toContainText('DOT 1 repairing Sensors');
  },
});
