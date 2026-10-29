// Torpedo Assembly Control: the head gallery, the configuration pages, assembly into the ready rack, the rules
// that stop an assembly, the details overlay and the demo controls.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const state = page => page.evaluate(() => TorpedoAssembly.state());
const onHull = page => page.locator('.head-slide[data-pos="0"]');
async function configure(page, type) {
  await page.locator(`.dock [data-type="${type}"]`).click();
  await page.locator('#configureBtn').click();
  await expect(page.locator('#track')).toHaveAttribute('data-page', 'configure');
}
async function keypadEnter(page, text) {
  const pad = page.locator('#keypadDialog');
  await expect(pad).toBeVisible();
  await pad.getByRole('button', { name: 'Clear' }).click();
  for (const key of text) await pad.getByRole('button', { name: key === '-' ? 'Change sign' : key, exact: true }).click();
  await pad.locator('[data-save]').click();
}
async function demoView(page, view, act) {
  await page.locator('#menuBtn').click();
  await page.locator(`[data-menu="${view}"]`).click();
  await act();
  if (await page.locator('#menuDialog').isVisible()) await page.locator('#menuDialog [data-close]').last().click();
}
async function setField(page, key, text) {
  await page.locator(`#menuDialog [data-field="${key}"] [data-edit]`).click();
  await page.locator('#menuDialog .keypad').waitFor();
  await page.locator('#menuDialog .keypad').getByRole('button', { name: 'Clear' }).click();
  for (const key of text) await page.locator('#menuDialog .keypad').getByRole('button', { name: key, exact: true }).click();
  await page.locator('#menuDialog [data-save]').click();
}

run({
  'the heads turn across the hull like a gallery: arrows, swipe and the dock all choose one': async ({ open }) => {
    const page = await open('/TorpedoAssembly/');
    await expect(onHull(page)).toHaveAttribute('data-type', 'Warhead');
    await expect(page.locator('#headName')).toHaveText('WARHEAD');
    await expect(page.locator('#headStock')).toHaveText('8');
    await page.locator('#nextHead').click();
    await expect(onHull(page)).toHaveAttribute('data-type', 'Probe');
    await expect(page.locator('#headStock')).toHaveText('3');
    await expect(page.locator('.dock [data-type="Probe"]')).toHaveClass(/active/);
    // A swipe to the left brings the next head round.
    const box = await page.locator('#carousel').boundingBox();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(onHull(page)).toHaveAttribute('data-type', 'Beacon');
    // A tap on a side head brings that one onto the hull; a tap on the head on the hull opens its page.
    await page.locator('.head-slide[data-type="Warhead"]').click();
    await expect(onHull(page)).toHaveAttribute('data-type', 'Warhead');
    await onHull(page).click();
    await expect(page.locator('#track')).toHaveAttribute('data-page', 'configure');
    await expect(page.locator('#configTitle')).toHaveText('CONFIGURE WARHEAD');
    await page.locator('#backToHeads').click();
    await expect(page.locator('#track')).toHaveAttribute('data-page', 'gallery');
  },
  'a warhead: yield sets the damage, proximity uses the keypad, and it assembles into the ready rack': async ({ open }) => {
    const page = await open('/TorpedoAssembly/');
    await configure(page, 'Warhead');
    await page.locator('#yieldSlider').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#yieldValue')).toHaveText('100%');
    await expect(page.locator('#wedValue')).toHaveText('30.0');
    await expect(page.locator('#wkdValue')).toHaveText('150.0');
    await page.locator('[data-seg="warhead.trigger"] [data-val="Proximity"]').click();
    await page.locator('[data-num="warhead.proximity"]').click();
    await keypadEnter(page, '0');
    await expect(page.locator('#keypadDialog .keypad-error')).toHaveText('Enter a distance above 0 m.');
    await keypadEnter(page, '40');
    await expect(page.locator('[data-show="warhead.proximity"]')).toHaveText('40 m');
    await page.locator('#assembleBtn').click();
    await expect(page.locator('#track')).toHaveAttribute('data-page', 'gallery');
    await expect(page.locator('.slot.assembling')).toContainText('#1 WARHEAD');
    await expect(page.locator('#state')).toHaveText('ASSEMBLING');
    await expect(page.locator('.stock-row[data-key="Hulls"] b')).toHaveText('11');
    await expect(page.locator('.stock-row[data-key="Warhead"] b')).toHaveText('7');
    await page.evaluate(() => TorpedoAssembly.advance(30000));
    await expect(page.locator('.slot.ready')).toHaveCount(1);
    await expect(page.locator('#rackCount')).toHaveText('1 / 6 READY');
    await page.locator('.slot.ready').click();
    await expect(page.locator('#detailsTitle')).toHaveText('TORPEDO #1 · WARHEAD');
    await expect(page.locator('#detailsRows')).toContainText('Proximity · 40 m');
    await expect(page.locator('#detailsRows')).toContainText('150.0');
  },
  'one assembly at a time, and the cycle time follows the available power': async ({ open }) => {
    const page = await open('/TorpedoAssembly/');
    assert.equal((await state(page)).cycleMs, 30000 + (10000 - 30000) * (10 / 14));
    await page.locator('#assembleBtn').click();
    await expect(page.locator('#assembleBtn')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('#assembleBtn').click({ force: true });
    await expect(page.locator('#notice')).toHaveText(/One assembly at a time/);
    assert.equal((await state(page)).stock.Hulls, 11, 'the second press took nothing');
    // Below minimum power the bay pauses and so does the assembly.
    await demoView(page, 'power', () => setField(page, 'availablePower', '5'));
    await expect(page.locator('#state')).toHaveText('PAUSED');
    await expect(page.locator('#cycleTime')).toHaveText('OFFLINE');
    const before = (await state(page)).progress;
    await page.evaluate(() => TorpedoAssembly.advance(60000));
    assert.equal((await state(page)).progress, before, 'no progress without power');
    await demoView(page, 'power', () => setField(page, 'availablePower', '24'));
    await expect(page.locator('#cycleTime')).toHaveText('10.0 s');
    await page.evaluate(() => TorpedoAssembly.advance(10000));
    await expect(page.locator('#state')).toHaveText('BAY READY');
  },
  'a probe carries at most three sensors, and warp and self-destruct open their own settings': async ({ open }) => {
    const page = await open('/TorpedoAssembly/');
    await configure(page, 'Probe');
    for (const sensor of ['Bio', 'Weather', 'Scan']) await page.locator(`[data-sensor="${sensor}"]`).click();
    await expect(page.locator('#sensorCount')).toHaveText('3');
    await page.locator('[data-sensor="Molecular"]').click();
    await expect(page.locator('[data-sensor="Molecular"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#notice')).toHaveText(/at most three sensors/);
    await expect(page.locator('[data-num="probe.warpFactor"]')).toBeHidden();
    await page.locator('[data-check="probe.warpEnabled"]').check({ force: true });
    await expect(page.locator('[data-num="probe.warpFactor"]')).toBeVisible();
    await page.locator('[data-num="probe.warpFactor"]').click();
    await keypadEnter(page, '7');
    await expect(page.locator('#keypadDialog .keypad-error')).toHaveText('Enter a warp factor from 1 to 6.');
    await keypadEnter(page, '6');
    await expect(page.locator('[data-show="probe.warpFactor"]')).toHaveText('Warp 6.0');
    // The distance is shown in the chosen unit and kept in light years.
    await page.locator('[data-seg="probe.warpDistanceUnit"] [data-val="BKM"]').click();
    await expect(page.locator('[data-show="probe.warpDistance"]')).toHaveText(/^9,460\.73\d* BKM$/);
    await page.locator('[data-check="probe.selfDestructEnabled"]').check({ force: true });
    await page.locator('[data-seg="probe.selfDestructUnit"] [data-val="minutes"]').click();
    await expect(page.locator('[data-show="probe.selfDestruct"]')).toHaveText('60 min');
    await expect(page.locator('#previewRows')).toContainText('MAX DISTANCE');
    await page.locator('#assembleBtn').click();
    await page.evaluate(() => TorpedoAssembly.advance(30000));
    const probe = (await state(page)).ready[0].probe;
    assert.deepEqual(probe.sensors, ['Bio', 'Weather', 'Scan']);
    assert.equal(probe.sensorPowerDraw, 2);
    assert.equal(probe.transmitterPowerDraw, 1);
    assert.equal(probe.warpPowerDraw, 40);
    assert.equal(probe.selfDestructSeconds, 3600);
    await page.locator('.slot.ready').click();
    await expect(page.locator('#detailsRows')).toContainText('Warp 6.0');
    await expect(page.locator('#detailsRows')).toContainText('60 min after launch');
  },
  'a warning beacon needs its message, typed in capitals on the console keyboard': async ({ open }) => {
    const page = await open('/TorpedoAssembly/');
    await configure(page, 'Beacon');
    await expect(page.locator('#advisory')).toHaveText('Write the warning message.');
    await page.locator('#assembleBtn').click({ force: true });
    await expect(page.locator('#notice')).toHaveText('Write the warning message.');
    await page.locator('#messageField').click();
    for (const key of ['M', 'I', 'N', 'E', 'S']) await page.locator(`.search-keys [data-key="${key}"]`).click();
    await expect(page.locator('#messageInput')).toHaveValue('MINES');
    await page.locator('.search-keys [data-key="DONE"]').click();
    await expect(page.locator('#messageDialog')).toBeHidden();
    await expect(page.locator('#messageValue')).toHaveText('MINES');
    await expect(page.locator('#assembleBtn')).toHaveAttribute('aria-disabled', 'false');
    // A comms relay instead: frequencies, media and a signed destination.
    await page.locator('[data-seg="beacon.kind"] [data-val="Comms"]').click();
    await expect(page.locator('#messageField')).toBeHidden();
    await page.locator('[data-num="beacon.x"]').click();
    await keypadEnter(page, '-12.5');
    await expect(page.locator('[data-show="beacon.x"]')).toHaveText('-12.5 LY');
    await page.locator('[data-seg="beacon.sendMedium"] [data-val="RF"]').click();
    await expect(page.locator('#previewRows')).toContainText('0.1 PU/s');
    await page.locator('#assembleBtn').click();
    await page.evaluate(() => TorpedoAssembly.advance(30000));
    await expect(page.locator('.slot.ready')).toContainText('COMMS RELAY · SSC → RF');
  },
  'the rack fills to its capacity, and the launcher taking a torpedo frees a slot': async ({ open }) => {
    const page = await open('/TorpedoAssembly/');
    await demoView(page, 'magazine', () => setField(page, 'rtlMax', '2'));
    await expect(page.locator('.rack-list > .slot')).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await page.locator('#assembleBtn').click();
      await page.evaluate(() => TorpedoAssembly.advance(30000));
    }
    await expect(page.locator('#state')).toHaveText('RACK FULL');
    await expect(page.locator('#advisory')).toHaveText(/Ready rack full/);
    await demoView(page, 'magazine', async () => {
      await page.locator('#takeNext').click();
      await expect(page.locator('#notice')).toHaveText('Torpedo #1 taken by the launcher.');
    });
    await expect(page.locator('.slot.ready')).toHaveCount(1);
    await expect(page.locator('#state')).toHaveText('BAY READY');
  },
  'an empty magazine stops assembly until the station resupplies it': async ({ open }) => {
    const page = await open('/TorpedoAssembly/');
    await demoView(page, 'magazine', () => setField(page, 'Probe', '0'));
    await page.locator('.dock [data-type="Probe"]').click();
    await expect(page.locator('#advisory')).toHaveText('No probe heads in the magazine.');
    await expect(page.locator('.stock-row[data-key="Probe"]')).toHaveClass(/out/);
    await demoView(page, 'magazine', () => setField(page, 'Hulls', '0'));
    await expect(page.locator('#state')).toHaveText('NO HULLS');
    await demoView(page, 'magazine', () => page.locator('#refill').click());
    await expect(page.locator('.stock-row[data-key="Hulls"] b')).toHaveText('12');
    await expect(page.locator('.stock-row[data-key="Probe"] b')).toHaveText('3');
    await expect(page.locator('#assembleBtn')).toHaveAttribute('aria-disabled', 'false');
  },
  'power draw rates set in the demo controls are saved into each torpedo': async ({ open }) => {
    const page = await open('/TorpedoAssembly/');
    await demoView(page, 'rates', () => setField(page, 'sscDraw', '2'));
    await configure(page, 'Beacon');
    await page.locator('#messageField').click();
    await page.locator('.search-keys [data-key="A"]').click();
    await page.locator('.search-keys [data-key="DONE"]').click();
    await page.locator('#assembleBtn').click();
    await page.evaluate(() => TorpedoAssembly.advance(30000));
    await demoView(page, 'rates', () => setField(page, 'sscDraw', '1'));
    assert.equal((await state(page)).ready[0].beacon.powerDraw, 2, 'the beacon keeps the draw it was assembled with');
    await page.locator('.slot.ready').click();
    await expect(page.locator('#detailsRows')).toContainText('1 h 23 min 20 s');
  },
});
