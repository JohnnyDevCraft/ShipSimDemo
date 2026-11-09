// Command Control: the captain's phone console. A stand-in ship until DOT Bay Control reports, then the live bay
// (damage and DOTs) and back to the stand-in when the report goes stale; the camera stick turns and zooms the main
// view screen, the four views jump, the scanners switch between SRS, LRS, DUAL and NONE, and the labels toggle,
// all reaching an open View Screen; changes from Communications show here; the tabs and the status strip; touch
// on a phone; and the demo controls.
const assert = require('node:assert/strict');
const path = require('node:path');
const { run, expect } = require('./browser-harness.cjs');
const playwright = require(process.env.PLAYWRIGHT_MODULE || path.resolve(__dirname, '../../ng-app/node_modules/@playwright/test'));

const state = page => page.evaluate(() => CommandControl.state());
const settings = page => page.evaluate(() => ViewScreenSettings.read());
// Hold a finger or the mouse on the stick, pushed by (x, y) of its travel, for `ms`.
async function holdStick(page, x, y, ms) {
  const b = await page.locator('#cameraStick').boundingBox(), travel = b.width * 0.27;
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + x * travel, cy - y * travel, { steps: 4 });
  await page.waitForTimeout(ms);
  await page.mouse.up();
}
// A phone: a touch screen with a mobile browser.
async function phone(context, engine, base) {
  const device = engine === 'webkit' ? playwright.devices['iPhone 13'] : playwright.devices['Pixel 7'];
  const mobile = await context.browser().newContext({ ...device }), errors = [];
  const page = await mobile.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/Command/');
  return { mobile, page, errors };
}

run({
  'a stand-in ship until DOT Bay Control reports: four damaged, two DOTs out, damaged components first': async ({ open }) => {
    const page = await open('/Command/');
    await expect(page.locator('.title-pill')).toHaveText('COMMAND CONTROL');
    await expect(page.locator('#damageCount')).toHaveText('4');
    await expect(page.locator('#deployedCount')).toHaveText('2 of 4');
    await expect(page.locator('#worstName')).toHaveText('Phaser array 20%');
    await expect(page.locator('#statusStrip')).toHaveAttribute('data-level', 'bad');
    await expect(page.locator('#sourceLight')).toHaveAttribute('data-level', 'stand-in');
    await expect(page.locator('#statusBadge')).toHaveText('4');
    await expect(page.locator('#sourceNote')).toContainText('Stand-in');
    await expect(page.locator('.dot-card')).toHaveCount(4);
    await expect(page.locator('.dot-card').nth(0)).toContainText('REPAIRING');
    await expect(page.locator('.dot-card').nth(0)).toContainText('At Phaser array');
    await expect(page.locator('.dot-card').nth(1)).toContainText('BEAMING OUT');
    await expect(page.locator('.dot-card').nth(2)).toContainText('CHARGING');
    await expect(page.locator('#componentList li')).toHaveCount(12);
    const names = await page.locator('#componentList .cname').allTextContents();
    assert.deepEqual(names.slice(0, 4), ['Phaser array', 'Warp drive', 'Shield generator', 'Sensors']);
    // Two DOTs on the warp drive share its repair: 60% of 30 minutes over two is 9 minutes.
    await expect(page.locator('#componentList li[data-component="warp"]')).toContainText('9m 00s left');
    await expect(page.locator('#componentList li[data-component="warp"] .cdots i')).toHaveCount(2);
  },

  'the live bay from DOT Bay Control, and the stand-in again once its report is stale': async ({ open }) => {
    const bay = await open('/DotBay/');
    await bay.evaluate(() => DotBay.set({ integrity: { ...DotBay.state().integrity, reactor: 30 } }));
    // DOT 1 to the reactor, beaming there.
    await bay.locator('#assignBtn').click();
    await bay.locator('#assignGrid [data-component="reactor"]').click();
    await bay.evaluate(() => DotBay.step(12));
    const page = await open('/Command/');
    await expect(page.locator('#sourceLight')).toHaveAttribute('data-level', 'live');
    await expect(page.locator('#damageCount')).toHaveText('5');
    await expect(page.locator('#worstName')).toHaveText(/Phaser array 20%/);
    await expect(page.locator('.dot-card').nth(0)).toContainText('REPAIRING');
    await expect(page.locator('.dot-card').nth(0)).toContainText('At Reactor');
    await expect(page.locator('#deployedCount')).toHaveText('1 of 4');
    await expect(page.locator('#componentList li[data-component="reactor"] .cdots i')).toHaveText('1');
    // Changes in the bay arrive within a second.
    await bay.locator('#recallAllBtn').click();
    await expect(page.locator('.dot-card').nth(0)).toContainText('BEAMING HOME');
    // DOT Bay Control closed: its last report goes stale and the stand-in returns.
    await bay.close();
    await page.evaluate(() => {
      const report = JSON.parse(localStorage.getItem(DotBayReport.KEY));
      localStorage.setItem(DotBayReport.KEY, JSON.stringify({ ...report, at: Date.now() - DotBayReport.STALE_MS - 1 }));
      CommandControl.refresh();
    });
    await expect(page.locator('#sourceLight')).toHaveAttribute('data-level', 'stand-in');
    await expect(page.locator('#damageCount')).toHaveText('4');
  },

  'DOT Bay Control reports every component and DOT': async ({ open }) => {
    const bay = await open('/DotBay/');
    await bay.waitForTimeout(700);
    const report = await bay.evaluate(() => DotBayReport.read());
    assert.ok(report, 'a fresh report');
    assert.equal(report.components.length, 12);
    assert.equal(report.dots.length, 4);
    assert.equal(report.components.find(c => c.key === 'warp').integrity, 40);
    assert.equal(report.online, true);
  },

  'the camera stick turns and zooms the main view screen, and the open View Screen follows': async ({ open }) => {
    const screen = await open('/ViewScreen/');
    const page = await open('/Command/');
    await page.locator('#viewTabBtn').click();
    await holdStick(page, 1, 0, 1000);
    const turned = (await settings(page)).camera;
    assert.ok(turned > 30 && turned < 120, `the camera swung to starboard (${turned})`);
    await expect(page.locator('#cameraBearing')).not.toHaveText('000.0°');
    await expect(page.locator('#cameraView')).toHaveText('FROM THE BOW');
    // Let go: the knob springs back and the camera holds.
    await page.waitForTimeout(200);
    assert.equal((await settings(page)).camera, (await settings(page)).camera);
    assert.ok(Math.abs((await settings(page)).camera - turned) < 0.01, 'the camera holds after letting go');
    await holdStick(page, 0, 1, 800);
    const zoom = (await settings(page)).zoom;
    assert.ok(zoom > 1.3, `pushed up zooms in (${zoom})`);
    await holdStick(page, 0, -1, 1500);
    assert.ok((await settings(page)).zoom < zoom, 'pulled down zooms out');
    await holdStick(page, -1, 0, 1000);
    const back = (((await settings(page)).camera - turned + 540) % 360) - 180;
    assert.ok(back < -20, `pushed left swings back to port (${back})`);
    // The four views
    for (const [key, bearing, label] of [['starboard', 90, 'STARBOARD'], ['aft', 180, 'AFT'], ['port', 270, 'PORT'], ['forward', 0, 'FORWARD']]) {
      await page.locator(`[data-camera-view="${key}"]`).click();
      assert.equal((await settings(page)).camera, bearing);
      await expect(page.locator(`[data-camera-view="${key}"]`)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#cameraView')).toHaveText(`${label} VIEW`);
      await expect(screen.locator('#caption')).toContainText(`${label} VIEW`);
    }
  },

  'the scanners switch between SRS, LRS, DUAL and NONE, and Communications changes show here': async ({ open }) => {
    const screen = await open('/ViewScreen/');
    const page = await open('/Command/');
    await page.locator('#viewTabBtn').click();
    await expect(page.locator('[data-view-mode="dual"]')).toHaveAttribute('aria-pressed', 'true');
    for (const [mode, chip] of [['srs', 'SHORT RANGE'], ['lrs', 'LONG RANGE'], ['none', 'SCOPE ONLY'], ['dual', 'BOTH']]) {
      await page.locator(`[data-view-mode="${mode}"]`).click();
      assert.equal((await settings(page)).mode, mode);
      await expect(page.locator('#modeChip')).toHaveText(chip);
    }
    await page.locator('[data-view-mode="srs"]').click();
    await expect(screen.locator('#lrsPanel')).toBeHidden();
    const comms = await open('/Communications/');
    await comms.evaluate(() => ViewScreenSettings.write({ mode: 'lrs', camera: 180 }));
    await expect(page.locator('[data-view-mode="lrs"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#cameraView')).toHaveText('AFT VIEW');
  },

  'the labels switch on and off one at a time or all together': async ({ open }) => {
    const page = await open('/Command/');
    await page.locator('#labelsTabBtn').click();
    await expect(page.locator('#labelGrid .toggle')).toHaveCount(6);
    await expect(page.locator('#labelsChip')).toHaveText('ALL ON');
    await expect(page.locator('#labelsOn')).toBeDisabled();
    await page.locator('[data-label="ships"]').click();
    assert.equal((await settings(page)).labels.ships, false);
    assert.equal((await settings(page)).objects.ships, true, 'the objects stay');
    await expect(page.locator('[data-label="ships"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#labelsChip')).toHaveText('5 OF 6 ON');
    await page.locator('#labelsOff').click();
    assert.ok(Object.values((await settings(page)).labels).every(v => !v));
    await expect(page.locator('#labelsChip')).toHaveText('ALL OFF');
    await expect(page.locator('#labelsOff')).toBeDisabled();
    await page.locator('#labelsOn').click();
    assert.ok(Object.values((await settings(page)).labels).every(v => v));
  },

  'the tab bar, the remembered tab, arrow keys and the status strip': async ({ open }) => {
    const page = await open('/Command/');
    assert.equal((await state(page)).tab, 'status');
    await expect(page.locator('#statusTabBtn')).toHaveAttribute('aria-selected', 'true');
    await page.locator('#viewTabBtn').click();
    await expect(page.locator('#viewTab')).toBeVisible();
    await expect(page.locator('#statusTab')).toBeHidden();
    await page.reload();
    assert.equal((await state(page)).tab, 'view', 'the tab is remembered');
    await page.locator('#viewTabBtn').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal((await state(page)).tab, 'range');
    await page.keyboard.press('ArrowRight');
    assert.equal((await state(page)).tab, 'labels');
    await page.keyboard.press('ArrowRight');
    assert.equal((await state(page)).tab, 'status');
    await page.locator('#labelsTabBtn').click();
    // The strip is on every tab; a tap goes to the status.
    await expect(page.locator('#statusStrip')).toBeVisible();
    await page.locator('#statusStrip').click();
    assert.equal((await state(page)).tab, 'status');
  },

  'on a phone: taps switch tabs and views, and a finger on the stick turns the camera': async ({ context, engine, base }) => {
    const { mobile, page, errors } = await phone(context, engine, base);
    try {
      await page.locator('#viewTabBtn').tap();
      await expect(page.locator('#viewTab')).toBeVisible();
      await page.locator('[data-camera-view="aft"]').tap();
      assert.equal((await settings(page)).camera, 180);
      await page.locator('[data-view-mode="none"]').tap();
      assert.equal((await settings(page)).mode, 'none');
      await page.locator('#labelsTabBtn').tap();
      await page.locator('[data-label="stars"]').tap();
      assert.equal((await settings(page)).labels.stars, false);
      if (engine === 'chromium') {
        // A real touch drag on the stick (the CDP touch events Chromium understands).
        await page.locator('#viewTabBtn').tap();
        const b = await page.locator('#cameraStick').boundingBox(), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
        const cdp = await mobile.newCDPSession(page);
        const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
        await touch('touchStart', cx, cy);
        for (let i = 1; i <= 4; i++) await touch('touchMove', cx - (b.width * 0.27 * i) / 4, cy);
        await page.waitForTimeout(800);
        await touch('touchEnd');
        const camera = (await settings(page)).camera;
        assert.ok(camera < 175 && camera > 90, `a finger dragged left swung the camera to port of aft (${camera})`);
      }
      assert.deepEqual(errors, []);
    } finally {
      await mobile.close();
    }
  },

  'demo controls damage and repair the stand-in, and stand aside while DOT Bay Control reports': async ({ open }) => {
    const page = await open('/Command/');
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('#demoRepair').click();
    await expect(page.locator('#damageCount')).toHaveText('0');
    await expect(page.locator('#worstName')).toHaveText('All OK');
    await expect(page.locator('#statusStrip')).toHaveAttribute('data-level', 'ok');
    await expect(page.locator('#statusBadge')).toBeHidden();
    await page.locator('#demoDamage').click();
    await expect(page.locator('#damageCount')).toHaveText('1');
    await page.locator('#demoReset').click();
    await expect(page.locator('#damageCount')).toHaveText('4');
    const bay = await open('/DotBay/');
    await bay.waitForTimeout(600);
    await expect(page.locator('#demoDamage')).toBeDisabled();
    await expect(page.locator('#demoSource')).toContainText('DOT Bay Control is open');
  },

  'the hull panel: integrity, a hit from a hostile with what it struck, the panel flashing, and the hostiles row': async ({ open }) => {
    const page = await open('/Command/');
    await expect(page.locator('#hullValue')).toHaveText('100%');
    await expect(page.locator('#hullPoints')).toHaveText('2400 of 2400');
    await expect(page.locator('#hullChip')).toHaveText('SOUND');
    await expect(page.locator('#lastHitRows')).toHaveText('No hits taken.');
    await expect(page.locator('#hostileRow')).toBeHidden();
    await page.evaluate(() => CommandControl.takeHit({ by: 'ZLX01A', byName: 'Black Pearl', kind: 'pulse', side: 'starboard', shieldStopped: 42, hullDamage: 900, component: 'warp', componentDamage: 12.5, critical: null }));
    await expect(page.locator('#hullValue')).toHaveText('62%');
    await expect(page.locator('#hullChip')).toHaveText('DAMAGED');
    await expect(page.locator('#hullPanel')).toHaveAttribute('data-level', 'warn');
    await expect(page.locator('#lastHitRows')).toContainText('STARBOARD');
    await expect(page.locator('#lastHitRows')).toContainText('Black Pearl · PULSE');
    await expect(page.locator('#lastHitRows')).toContainText('42.0 KD');
    await expect(page.locator('#lastHitRows')).toContainText('900.0 KD');
    await expect(page.locator('#lastHitRows')).toContainText('Warp drive −12.5');
    await expect(page.locator('#lastHitAgo')).toHaveText(/AGO$/);
    await expect(page.locator('#lastHitShake')).toBeHidden();
    // The stand-in's struck component loses the damage: 40% − 12.5.
    await expect(page.locator('#componentList li[data-component="warp"] b')).toHaveText('27%');
    await expect(page.locator('#hostileRow')).toBeVisible();
    await expect(page.locator('#hostileCount')).toHaveText('1');
    await expect(page.locator('#hostileNames')).toHaveText('Black Pearl');
    // A second hit flashes the panel; a torpedo shakes the ship; the hull at 0 is destroyed.
    await page.evaluate(() => CommandControl.takeHit({ by: 'ASH-07', byName: 'Ash Corsair Viper', kind: 'torpedo', hullDamage: 1600, component: null }));
    await expect(page.locator('#hullPanel')).toHaveClass(/hit/);
    await expect(page.locator('#lastHitShake')).toBeVisible();
    await expect(page.locator('#lastHitShake')).toHaveText('TORPEDO SHOOK THE SHIP');
    await expect(page.locator('#hullChip')).toHaveText('DESTROYED');
    await expect(page.locator('#hostileNames')).toHaveText('Black Pearl, Ash Corsair Viper');
    await expect(page.locator('#lastHitRows')).toContainText('None');
    // Demo controls repair the hull.
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('#demoHullRepair').click();
    await expect(page.locator('#hullChip')).toHaveText('SOUND');
    await expect(page.locator('#hostileRow')).toBeHidden();
  },

  'critical damage: a badge under the component, its name in red, the CRITICAL row of the last hit, and repaired from the menu': async ({ open }) => {
    const page = await open('/Command/');
    await page.evaluate(() => CommandControl.takeHit({ by: 'ZLX01A', byName: 'Black Pearl', kind: 'beam', side: 'forward', hullDamage: 50, component: 'shields', componentDamage: 5, critical: 'seo-halved' }));
    const row = page.locator('#componentList li[data-component="shields"]');
    await expect(row).toHaveAttribute('data-critical', 'true');
    await expect(row.locator('.crit')).toHaveText('Shield SEO halved');
    await expect(page.locator('#lastHitRows .hit-critical')).toContainText('CRITICAL');
    await expect(page.locator('#lastHitRows .hit-critical .crit')).toHaveText('Shield SEO halved');
    // Any console's Critical damage menu reaches this one: the reactor's words before the dash on the badge.
    await page.evaluate(() => DemoCombat.set('reactor', ['confinement-locked']));
    await expect(page.locator('#componentList li[data-component="reactor"] .crit')).toHaveText('Confinement locked below 50 %');
    await page.evaluate(() => DemoCombat.clearCritical());
    await expect(page.locator('#componentList .crit')).toHaveCount(0);
  },

  'the repair bay: OUT OF ACTION under bay critical damage, NO POWER and STANDING BY without power, MAINTAINING a whole component': async ({ open }) => {
    const page = await open('/Command/');
    await page.evaluate(() => DemoCombat.set('repair', ['dot-count-halved']));
    await expect(page.locator('.dot-card[data-state="disabled"]')).toHaveCount(2);
    await expect(page.locator('.dot-card').nth(3)).toContainText('OUT OF ACTION');
    await expect(page.locator('.dot-card').nth(3)).toContainText('Bay critical damage');
    await page.evaluate(() => DemoCombat.set('repair', []));
    await page.evaluate(() => CommandControl.bayPower(false));
    await expect(page.locator('#dotsChip')).toHaveText('NO POWER');
    await expect(page.locator('.dot-card').nth(0)).toContainText('STANDING BY');
    await expect(page.locator('.dot-card').nth(3)).toContainText('NO POWER');
    await page.evaluate(() => CommandControl.bayPower(true));
    await expect(page.locator('#dotsChip')).toHaveText('2 DEPLOYED');
    // DOT 1 stays on the phaser array once it is whole: maintaining; on a destroyed one it stands by.
    await page.evaluate(() => CommandControl.setIntegrity('array', 100));
    await expect(page.locator('.dot-card').nth(0)).toContainText('MAINTAINING');
    await page.evaluate(() => CommandControl.setIntegrity('array', 0));
    await expect(page.locator('.dot-card').nth(0)).toContainText('STANDING BY');
  },

  'docked at a station: STATION DRONES lists what its drones repair, an S chip on each component, and they repair the ship': async ({ open }) => {
    const page = await open('/Command/');
    await expect(page.locator('#stationPanel')).toBeHidden();
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('#demoDock').click();
    await expect(page.locator('#demoDock')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('#stationPanel')).toBeVisible();
    await expect(page.locator('#stationChip')).toHaveText('×2');
    await expect(page.locator('#stationNote')).toHaveText('Earth Orbital Station — not under crew control');
    await expect(page.locator('#stationList li')).toHaveCount(4);
    await expect(page.locator('#stationList li[data-station-slot="sensors"]')).toContainText('2 units');
    await expect(page.locator('#stationList li[data-station-slot="sensors"]')).toContainText('0.20%/s');
    await expect(page.locator('#componentList li[data-component="sensors"] .station-chip')).toHaveText('S2');
    const before = await page.evaluate(() => CommandControl.state().ship.components.find(c => c.key === 'array').integrity);
    await page.waitForTimeout(2300);
    const after = await page.evaluate(() => CommandControl.state().ship.components.find(c => c.key === 'array').integrity);
    assert.ok(after > before, `the drones repair the phaser array (${before} → ${after})`);
    await page.evaluate(() => CommandControl.dock(false));
    await expect(page.locator('#stationPanel')).toBeHidden();
  },

  'the RANGE tab sets the view screen scanners\' ranges, shared with Communications and the View Screen': async ({ open }) => {
    const page = await open('/Command/');
    await page.locator('#rangeTabBtn').click();
    await expect(page.locator('#rangeTab')).toBeVisible();
    await expect(page.locator('#srsRanges button')).toHaveCount(10);
    await expect(page.locator('#lrsRanges button')).toHaveCount(6);
    await expect(page.locator('#srsRangeChip')).toHaveText('1 BKM');
    await page.locator('#srsRanges [data-range="100-km"]').click();
    await expect(page.locator('#srsRangeChip')).toHaveText('100 km');
    await expect(page.locator('#srsRanges [data-range="100-km"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#lrsRanges [data-range="5-ly"]').click();
    const s = await settings(page);
    assert.equal(s.srs, '100-km');
    assert.equal(s.lrs, '5-ly');
    // A change from another page (Communications) shows here.
    await page.evaluate(() => ViewScreenSettings.write({ lrs: '1-ly' }));
    await expect(page.locator('#lrsRangeChip')).toHaveText('1 LY');
  },
});
