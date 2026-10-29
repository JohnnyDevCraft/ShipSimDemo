// View Screen: the forward scope fills the window and nothing on the screen takes input. Communications Control
// sets it up (view type, ranges, filters, scope zoom); it follows the Helm and plays ahead between reports; at
// warp the stars stream past and the bodies ahead grow; the tactical target, docking, the reactor and the bus
// show on its panels and gauges; the demo stand-ins live in the menu.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const state = page => page.evaluate(() => ViewScreen.state());
const visible = (page, name) => page.evaluate(n => ViewScreen.visible().find(v => v.name === n) || null, name);
async function demo(page, act) {
  if (!(await page.locator('#menuDialog').isVisible())) {
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
  }
  await act();
  await page.locator('#menuDialog [data-close]').last().click();
}
async function setField(page, key, text) {
  await page.locator(`#menuDialog [data-field="${key}"] [data-edit]`).click();
  const pad = page.locator('#menuDialog .keypad');
  await pad.getByRole('button', { name: 'Clear' }).click();
  for (const key of text) await pad.getByRole('button', { name: key, exact: true }).click();
  await page.locator('#menuDialog [data-save]').click();
}
// A second page writes the Helm's reports, as the Helm page does; the View Screen hears them through storage.
const report = (page, values) => page.evaluate(v => {
  const computer = NavComputer.connect({ ownRegistry: NavWorld.ownShip.registry });
  computer.reportOwnShip(v && { registry: NavWorld.ownShip.registry, x: NavWorld.ownShipStart.x, y: NavWorld.ownShipStart.y, bearing: 0, course: 0, speedKmS: 0, atWarp: false, turnRate: 0, ...v });
  return JSON.parse(localStorage.getItem('xmps-demo-navigation')).ownShip;
}, values);

run({
  'the forward scope fills the window; the panels, scanners and gauges sit over it and nothing takes input': async ({ open }) => {
    const page = await open('/ViewScreen/?models=0');
    const hud = await page.locator('#hud').boundingBox();
    assert.deepEqual([hud.x, hud.y, hud.width, hud.height], [0, 0, 1500, 1000]);
    await expect(page.locator('.title-pill')).toHaveText('VIEW SCREEN');
    await expect(page.locator('#caption')).toHaveText('FORWARD VIEW · ZOOM 1× · SRS 1 BKM · LRS 30 LY');
    // The only things that respond are the way back to the demos and the menu with the demo controls.
    const controls = await page.evaluate(() => [...document.querySelectorAll('button, a, input, select, [tabindex]')].filter(e => !e.closest('dialog') && e.getClientRects().length).map(e => e.id || e.className));
    assert.deepEqual(controls, ['brand', 'menuBtn']);
    for (const id of ['#srsPanel', '#lrsPanel', '#noTarget', '#dockPanel', '#navPanel', '#advisory', '#gauges']) await expect(page.locator(id)).toBeVisible();
    await expect(page.locator('#gauges .gauge small')).toHaveText(['BUS LOAD', 'REACTOR OUTPUT', 'REACTOR TEMP', 'SPEED']);
    await expect(page.locator('#busGauge')).toContainText('112.0');
    await expect(page.locator('#outputGauge')).toContainText('EFFICIENCY 94.9%');
    await expect(page.locator('#tempGauge')).toContainText('220.0');
    await expect(page.locator('#state')).toHaveText('HOLDING');
    await expect(page.locator('#heading')).toHaveText('180.0°');
    await expect(page.locator('#advisory')).toHaveText('Holding position · heading 180.0°.');
    // Earth is dead ahead of the stand-in ship, and the world is refreshed twenty times a second.
    const earth = await visible(page, 'Earth');
    assert.ok(Math.abs(earth.angle) < 0.01 && earth.r > 20, `Earth ahead (${JSON.stringify(earth)})`);
    assert.equal(await page.evaluate(() => ViewScreen.refreshRateHz), 20);
    // A tap on the scope does nothing.
    const before = await state(page);
    await page.mouse.click(750, 500);
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    assert.equal((await state(page)).settings.zoom, before.settings.zoom);
  },
  'Communications sets up the screen: view type, ranges, filters and scope zoom reach it at once': async ({ open }) => {
    const page = await open('/ViewScreen/?models=0');
    const comms = await open('/Communications/');
    await comms.locator('#viewScreenBtn').click();
    await comms.locator('[data-view-mode="none"]').click();
    await expect(page.locator('#srsPanel')).toBeHidden();
    await expect(page.locator('#lrsPanel')).toBeHidden();
    await expect(page.locator('#caption')).toHaveText('FORWARD VIEW · ZOOM 1× · SCANNERS OFF');
    await comms.locator('[data-view-mode="srs"]').click();
    await expect(page.locator('#srsPanel')).toBeVisible();
    await expect(page.locator('#lrsPanel')).toBeHidden();
    await comms.locator('[data-view-mode="lrs"]').click();
    await expect(page.locator('#srsPanel')).toBeHidden();
    await expect(page.locator('#lrsPanel')).toBeVisible();
    await comms.locator('[data-view-mode="dual"]').click();
    await expect(page.locator('#srsPanel')).toBeVisible();
    await comms.locator('#srsRanges button', { hasText: '100 km' }).click();
    await comms.locator('#lrsRanges button', { hasText: '5 LY' }).click();
    await expect(page.locator('#srsRange')).toHaveText('100 km');
    await expect(page.locator('#lrsRange')).toHaveText('5 LY');
    // The scope zooms to the setting: Earth grows four times.
    const r1 = (await visible(page, 'Earth')).r;
    await comms.locator('#scopeZooms button', { hasText: /^4×$/ }).click();
    await expect(page.locator('#caption')).toHaveText('FORWARD VIEW · ZOOM 4× · SRS 100 km · LRS 5 LY');
    await expect.poll(async () => (await state(page)).zoom).toBe(4);
    const r4 = (await visible(page, 'Earth')).r;
    assert.ok(Math.abs(r4 / r1 - 4) < 0.05, `Earth four times bigger (${r1} → ${r4})`);
    // Objects switched off are not drawn.
    await comms.locator('#objectsFilters button', { hasText: 'Planets' }).click();
    await expect.poll(() => visible(page, 'Earth')).toBe(null);
    assert.equal((await state(page)).settings.objects.planets, false);
  },
  'the tactical officer points the camera: aft, abeam or any bearing, and zooms to any value': async ({ open }) => {
    const page = await open('/ViewScreen/?models=0');
    const tactical = await open('/ViewScreen/?models=0');
    await tactical.evaluate(() => ViewScreenSettings.write({ camera: 180 }));
    await expect(page.locator('#caption')).toHaveText('AFT VIEW · ZOOM 1× · SRS 1 BKM · LRS 30 LY');
    await expect.poll(async () => (await state(page)).camera).toBe(180);
    // Earth is dead ahead, so it is behind the aft view; the heading scale reads the bearing looked along.
    assert.equal(await visible(page, 'Earth'), null);
    await tactical.evaluate(() => ViewScreenSettings.write({ camera: 0, zoom: 3.5 }));
    await expect(page.locator('#caption')).toHaveText('FORWARD VIEW · ZOOM 3.5× · SRS 1 BKM · LRS 30 LY');
    await expect.poll(async () => (await state(page)).zoom).toBe(3.5);
    assert.ok(Math.abs((await visible(page, 'Earth')).angle) < 0.01, 'Earth ahead again');
    // A small turn glides; the view follows any bearing.
    await tactical.evaluate(() => ViewScreenSettings.write({ camera: 12 }));
    await expect(page.locator('#caption')).toHaveText('VIEW 012° REL · ZOOM 3.5× · SRS 1 BKM · LRS 30 LY');
    await expect.poll(async () => Math.round((await state(page)).camera * 100) / 100).toBe(12);
    assert.ok(Math.abs((await visible(page, 'Earth')).angle + 12) < 0.01, 'Earth 12° to the left');
  },
  'the screen follows the Helm and plays ahead between its reports': async ({ open }) => {
    const page = await open('/ViewScreen/?models=0');
    const helm = await open('/ViewScreen/?models=0');
    const r = await report(helm, { bearing: 90, course: 90, speedKmS: 1000 });
    await expect.poll(async () => (await state(page)).following).toBe(true);
    await expect(page.locator('#heading')).toHaveText('090.0°');
    await expect(page.locator('#state')).toHaveText('IMPULSE');
    // Two seconds after the report, the ship is 2,000 km further east.
    let pose = await page.evaluate(ms => ViewScreen.poseAt(ms), r.at + 2000);
    assert.ok(Math.abs(pose.x - (r.x + 2000)) < 1e-6 && Math.abs(pose.y - r.y) < 1e-6, 'moved along its course');
    // A turn plays ahead for up to two seconds.
    const turning = await report(helm, { bearing: 90, course: 90, speedKmS: 0, turnRate: 3 });
    await expect.poll(async () => (await state(page)).followedAt).toBe(turning.at);
    assert.ok(Math.abs((await page.evaluate(ms => ViewScreen.poseAt(ms), turning.at + 1000)).heading - 93) < 1e-6);
    assert.ok(Math.abs((await page.evaluate(ms => ViewScreen.poseAt(ms), turning.at + 5000)).heading - 96) < 1e-6);
    // A warp jump plays ahead no further than where it ends, and then the ship is out of warp.
    const jump = await report(helm, { bearing: 0, course: 0, speedKmS: 299792.458, atWarp: true, warpFactor: 1, arrival: { x: r.x, y: r.y + 1e6 } });
    await expect.poll(async () => (await state(page)).followedAt).toBe(jump.at);
    await expect(page.locator('#state')).toHaveText('AT WARP');
    pose = await page.evaluate(ms => ViewScreen.poseAt(ms), jump.at + 10000);
    assert.ok(Math.abs(pose.y - (r.y + 1e6)) < 1e-6 && !pose.atWarp && pose.speedKmS === 0, 'stopped where the jump ends');
    // A report that disagrees a little with the play-ahead is eased in, not jumped to.
    const steady = await report(helm, { bearing: 90, course: 90, speedKmS: 1000 });
    await expect.poll(async () => (await state(page)).followedAt).toBe(steady.at);
    await page.waitForTimeout(500);
    const off = await report(helm, { bearing: 90, course: 90, speedKmS: 1000, x: steady.x + 500 + 50 });
    await expect.poll(async () => (await state(page)).followedAt).toBe(off.at);
    const eased = await page.evaluate(() => { const now = Date.now(); return { now, pose: ViewScreen.poseAt(now) }; });
    const target = off.x + (eased.now - off.at);
    assert.ok(target - eased.pose.x > 10, `still easing toward the new report (${target - eased.pose.x} km behind)`);
    await page.waitForTimeout(1500);
    const settled = await page.evaluate(() => { const now = Date.now(); return { now, pose: ViewScreen.poseAt(now) }; });
    assert.ok(Math.abs(off.x + (settled.now - off.at) - settled.pose.x) < 1, 'settled on the new report');
    // While the Helm flies, the stand-in flight is off; when the Helm closes, the stand-in takes over.
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await expect(page.locator('#demoSource')).toHaveText('Following the Helm: the stand-in flight is off.');
    await expect(page.locator('#demoWarp')).toBeDisabled();
    await report(helm, null);
    await expect(page.locator('#demoWarp')).toBeEnabled();
    await expect(page.locator('#demoSource')).toHaveText('The Helm is closed: a stand-in ship flies this screen.');
    await expect(page.locator('#heading')).toHaveText('180.0°');
  },
  'at warp the stars stream past and the bodies ahead grow as they come closer': async ({ open }) => {
    const page = await open('/ViewScreen/?models=0');
    await demo(page, () => page.locator('#demoWarp').click());
    await expect(page.locator('#notice')).toHaveText('Warp 1.20 toward Earth.');
    await expect(page.locator('#state')).toHaveText('AT WARP');
    await expect(page.locator('#advisory')).toHaveText(/^At warp 1\.20 toward Earth · \d+ sec to go\.$/);
    await expect(page.locator('#speedGauge')).toContainText('W 1.20');
    await expect(page.locator('#warpDrive small')).toHaveText('W 1.20');
    await expect.poll(async () => (await state(page)).warpLevel).toBe(1);
    const far = await visible(page, 'Earth');
    assert.ok(far.distance > 19e6, `starts 20 MKM out (${far.distance})`);
    await page.evaluate(() => ViewScreen.advance(20));
    const near = await visible(page, 'Earth');
    assert.ok(near.distance < far.distance / 1.8 && near.r > far.r * 1.8, `Earth grows as we close (${far.r} → ${near.r})`);
    await page.evaluate(() => ViewScreen.advance(25));
    await expect(page.locator('#notice')).toHaveText('Dropped out of warp at Earth.');
    await expect(page.locator('#state')).toHaveText('HOLDING');
    const arrived = await visible(page, 'Earth');
    assert.ok(Math.abs(arrived.distance - 44597 * 1.01) < 5, `stops at Earth's safe distance (${arrived.distance})`);
    await expect.poll(async () => (await state(page)).warpLevel).toBe(0);
  },
  'a tactical target is bracketed and described; one off the screen is marked at its edge': async ({ open }) => {
    const page = await open('/ViewScreen/?models=0');
    await demo(page, () => page.locator('#demoTarget').selectOption('Sol|Earth Orbital Station'));
    await expect(page.locator('#targetPanel')).toBeVisible();
    await expect(page.locator('#noTarget')).toBeHidden();
    await expect(page.locator('#targetName')).toHaveText('Earth Orbital Station');
    await expect(page.locator('#targetKind')).toHaveText('STATION');
    await expect(page.locator('#targetView')).toHaveText('Ahead');
    await expect(page.locator('#targetBearing')).toHaveText('180.0° · 0.0°');
    await expect(page.locator('#advisory')).toHaveText(/^Tactical target Earth Orbital Station · 93,229 KM · ahead\.$/);
    await demo(page, () => page.locator('#demoTarget').selectOption('Sol|TNS Endeavor'));
    await expect(page.locator('#targetSub')).toHaveText('Terran Navy · TN-0388');
    await expect(page.locator('#targetView')).toHaveText('Off screen to the left');
    await demo(page, () => page.locator('#demoTarget').selectOption(''));
    await expect(page.locator('#noTarget')).toBeVisible();
  },
  'docking, the reactor and the bus show on the panels and gauges': async ({ open }) => {
    const page = await open('/ViewScreen/?models=0');
    await demo(page, async () => {
      await page.locator('#demoDock').selectOption('connected');
      await page.locator('#demoSync').check({ force: true });
    });
    await expect(page.locator('#dockState')).toHaveText('CONNECTED');
    await expect(page.locator('#lights .light[data-state="on"]')).toHaveCount(5);
    await expect(page.locator('#state')).toHaveText('DOCKED');
    await demo(page, () => page.locator('#demoDock').selectOption('moorings'));
    await expect(page.locator('#lights .light[data-state="on"]')).toHaveCount(2);
    await demo(page, async () => {
      await setField(page, 'busLoad', '140');
      await setField(page, 'temperature', '500');
    });
    await expect(page.locator('#busGauge .g-value')).toHaveAttribute('data-level', 'warn');
    await expect(page.locator('#tempGauge .g-sub')).toHaveText('CRITICAL');
    await expect(page.locator('#advisory')).toHaveText('Reactor temperature critical · 500.0 K of 530 K breach.');
    await expect(page.locator('#advisory')).toHaveAttribute('data-level', 'bad');
  },
  'the navigation panel shows the destination the navigation computer holds': async ({ open }) => {
    const page = await open('/ViewScreen/?models=0');
    await expect(page.locator('#destName')).toHaveText('Gliese 1061');
    await expect(page.locator('#navSource')).toHaveText('PLOTTED');
    await expect(page.locator('#destDistance')).toHaveText(/ LR$/);
    await expect(page.locator('#destEta')).toHaveText('Holding');
    await page.evaluate(() => NavComputer.connect({ ownRegistry: NavWorld.ownShip.registry }).clear(NavWorld.ownShip.registry));
    await page.reload();
    await expect(page.locator('#destName')).toHaveText('No destination');
    await expect(page.locator('#navSource')).toHaveText('NO COURSE');
  },
});
