// One console at a time (R11): in the installed tablet app the host switches stations in one window. The ship the
// Helm was flying carries on when the host leaves Helm for View Screen, and Helm picks it up again on return.
// With Helm open in a second tab, View Screen still follows it live as before.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const viewState = page => page.evaluate(() => ViewScreen.state());
const storedReport = page => page.evaluate(() => JSON.parse(localStorage.getItem('xmps-demo-navigation')).ownShip);
const headingText = bearing => (((bearing % 360) + 360) % 360).toFixed(1).padStart(5, '0') + '°';

// The View Screen says in its demo controls whether it follows the Helm or flies its stand-in.
async function openDemoControls(page) {
  await page.locator('#menuBtn').click();
  await page.locator('#openDemoControls').click();
}

// Full impulse and a short turn to starboard, flown with the Helm's own keyboard commands.
async function flyHelm(page) {
  await page.locator('#map').click({ position: { x: 600, y: 120 }, force: true });
  await page.locator('#impulse').focus();
  await page.keyboard.press('End');
  await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '100');
  await page.locator('#map').click({ position: { x: 600, y: 120 }, force: true });
  await page.keyboard.down('d');
  await page.waitForTimeout(1000);
  await page.keyboard.up('d');
  await expect(page.locator('#state')).toHaveText('IMPULSE');
  await page.waitForTimeout(1500);
}

run({
  'after flying Helm and switching to View Screen in the same window, View Screen shows the Helm-controlled ship, and returning to Helm resumes it where View Screen showed it': async ({ open, base, context }) => {
    const page = await open('/Helm/');
    await flyHelm(page);
    const flown = await page.evaluate(() => ({ x: ship.x, y: ship.y, heading, speed: Math.hypot(velocity.x, velocity.y) }));
    assert.ok(flown.speed > 0, 'the Helm is moving');

    // Same window: the Helm page is left for View Screen.
    await page.goto(base + '/ViewScreen/?models=0');
    const closed = await storedReport(page);
    assert.equal(closed.closed, true, 'the Helm left its last report marked closed');
    await expect.poll(async () => (await viewState(page)).following).toBe(true);
    await openDemoControls(page);
    await expect(page.locator('#demoSource')).toHaveText('Following the Helm: the stand-in flight is off.');
    await page.locator('#menuDialog [data-close]').last().click();
    await expect(page.locator('#heading')).toHaveText(headingText(closed.bearing));
    await expect(page.locator('#state')).toHaveText('IMPULSE');
    // The ship is where the Helm's last heading and speed have taken it since.
    const seen = await page.evaluate(() => { const now = Date.now(); return { now, pose: ViewScreen.poseAt(now) }; });
    const dt = (seen.now - closed.at) / 1000, along = (closed.course * Math.PI) / 180;
    const expected = { x: closed.x + Math.sin(along) * closed.speedKmS * dt, y: closed.y + Math.cos(along) * closed.speedKmS * dt };
    assert.ok(Math.hypot(seen.pose.x - expected.x, seen.pose.y - expected.y) < closed.speedKmS * 0.25 + 1, `flown on from the Helm's report (${JSON.stringify({ seen: seen.pose, expected })})`);
    await page.waitForTimeout(1000);

    // Back to Helm in the same window: it resumes the ship where View Screen showed it.
    const before = await page.evaluate(() => { const now = Date.now(); return { now, pose: ViewScreen.poseAt(now) }; });
    await page.goto(base + '/Helm/');
    await expect(page.locator('#notice')).toHaveText('Resumed from the last Helm report');
    const resumed = await page.evaluate(() => ({ now: Date.now(), x: ship.x, y: ship.y, heading, speed: Math.hypot(velocity.x, velocity.y), impulse }));
    const gap = (resumed.now - before.now) / 1000;
    const ahead = { x: before.pose.x + Math.sin(along) * closed.speedKmS * gap, y: before.pose.y + Math.cos(along) * closed.speedKmS * gap };
    assert.ok(Math.hypot(resumed.x - ahead.x, resumed.y - ahead.y) < closed.speedKmS * 0.5 + 1, `resumed where View Screen showed it (${JSON.stringify({ resumed, ahead })})`);
    assert.ok(Math.abs(resumed.heading - closed.bearing) < 0.05, 'same heading');
    assert.ok(Math.abs(resumed.speed - closed.speedKmS) < closed.speedKmS * 0.01, 'still moving at its speed');
    assert.equal(resumed.impulse, 0, 'the throttle starts at its default');
    assert.equal(context.pages().length, 1, 'one window throughout');
  },
  'with Helm open in a second tab, View Screen follows it live as before': async ({ open }) => {
    const helm = await open('/Helm/');
    await flyHelm(helm);
    const view = await open('/ViewScreen/?models=0');
    await expect.poll(async () => (await viewState(view)).following).toBe(true);
    // Live: View Screen follows each new report the open Helm writes, not a carried-on copy.
    const first = (await viewState(view)).followedAt;
    await expect.poll(async () => (await viewState(view)).followedAt, { timeout: 5000 }).not.toBe(first);
    const followed = (await viewState(view)).followedAt, stored = await storedReport(view);
    assert.ok(!stored.closed, 'the Helm is open');
    assert.ok(Math.abs(followed - stored.at) <= 1500, 'following the stored live report');
    await openDemoControls(view);
    await expect(view.locator('#demoSource')).toHaveText('Following the Helm: the stand-in flight is off.');
  },
});
