// Transporter Control: scanning and locking, the two-stage transfer with its automatic lever handoff, mass
// limits, the shield and power interlocks, reachable locations, Clear Transport and the demo controls.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const state = page => page.evaluate(() => TransporterControl.state());
const step = (page, seconds) => page.evaluate(value => TransporterControl.step(value), seconds);
const configure = (page, values) => page.evaluate(value => TransporterControl.configure(value), values);
// Stepped demo time only: the page's own clock is paused so timings are exact.
async function openPaused(open) {
  const page = await open('/Transporter/');
  await page.evaluate(() => TransporterControl.pause(true));
  return page;
}
const pick = (page, name) => page.locator('.target-item', { hasText: name }).click();
async function lever(page, id, key) {
  await page.locator(id).focus();
  await page.keyboard.press(key);
}
async function scanPad(page, ...names) {
  await page.locator('#scan').click();
  for (const name of names) await pick(page, name);
}

run({
  'scanning the pad lists its personnel, and selected targets lock one after another': async ({ open }) => {
    const page = await openPaused(open);
    await expect(page.locator('#scanCount')).toHaveText('—');
    await expect(page.locator('#state')).toHaveText('STANDBY');
    await scanPad(page, 'Lt. Mara Venn', 'Ens. Keon Pell');
    await expect(page.locator('#scanCount')).toHaveText('3');
    await expect(page.locator('#state')).toHaveText('LOCKING');
    await step(page, 1.5);
    let now = await state(page);
    assert.equal(Math.round(now.targets.find(t => t.id === 'mara').lock), 50, 'the first target is half locked after 1.5 s of a 3 s lock');
    assert.equal(now.targets.find(t => t.id === 'keon').lock, 0, 'the second waits its turn');
    await step(page, 4.6);
    now = await state(page);
    assert.ok(now.targets.filter(t => ['mara', 'keon'].includes(t.id)).every(t => t.lock >= 100), 'both targets locked');
    await expect(page.locator('#state')).toHaveText('LOCKED');
    await expect(page.locator('.target-item', { hasText: 'Mara' }).locator('.tstate')).toHaveText('LOCKED');
    await expect(page.locator('#massGauge')).toHaveAttribute('aria-valuenow', '155');
  },

  'dematerialize fills the buffer, hands over to materialize, and delivers the targets': async ({ open }) => {
    const page = await openPaused(open);
    await expect(page.locator('#dematSlider')).toHaveAttribute('aria-disabled', 'true');
    await scanPad(page, 'Lt. Mara Venn', 'Ens. Keon Pell');
    await step(page, 6.2);
    await expect(page.locator('#dematSlider')).toHaveAttribute('aria-disabled', 'false');
    await expect(page.locator('#matSlider')).toHaveAttribute('aria-disabled', 'true');
    await lever(page, '#dematSlider', 'End');
    await expect(page.locator('#state')).toHaveText('DEMATERIALIZING');
    await expect(page.locator('#scan')).toBeDisabled();
    await expect(page.locator('#clearTransport')).toBeDisabled();
    await step(page, 4);
    // Halfway through the stage; 155 kg of a 160 kg buffer is loading, so the buffer is 48% full.
    await expect(page.locator('#dematReading')).toHaveText('50% COMPLETE');
    await expect(page.locator('#bufferPercent')).toHaveText('48%');
    await expect(page.locator('#bufferCount')).toHaveText('2 PATTERNS');
    await step(page, 4.1);
    let now = await state(page);
    assert.equal(now.phase, 'buffered');
    assert.equal(now.levers.demat, 0, 'the dematerialize lever dropped to zero on its own');
    await expect(page.locator('#dematSlider')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#matSlider')).toHaveAttribute('aria-disabled', 'false');
    await expect(page.locator('#state')).toHaveText('BUFFER HOLD');
    await lever(page, '#matSlider', 'End');
    await step(page, 8.1);
    now = await state(page);
    assert.equal(now.phase, 'complete');
    assert.equal(now.levers.mat, 0, 'the materialize lever dropped to zero on its own');
    assert.deepEqual(now.delivered, ['mara', 'keon']);
    assert.equal(now.targets.find(t => t.id === 'mara').place, 'cargo');
    await expect(page.locator('#advisory')).toHaveText(/Lt\. Mara Venn, Ens\. Keon Pell delivered to Cargo Bay/);
    await expect(page.locator('#deliveredCount')).toHaveText('2');
    // They are found at the cargo bay now.
    await page.locator('[data-source="cargo"]').click();
    await page.locator('#scan').click();
    await expect(page.locator('.target-item', { hasText: 'Mara Venn' })).toBeVisible();
  },

  'one light pattern runs the stage to 100% but fills the buffer only by its share of the mass limit': async ({ open }) => {
    const page = await openPaused(open);
    await scanPad(page, 'Dr. Ilyra Moss'); // 63 kg of the 160 kg pad limit
    await step(page, 3.1);
    await lever(page, '#dematSlider', 'End');
    await step(page, 8.1);
    let now = await state(page);
    assert.equal(now.phase, 'buffered');
    assert.equal(now.progress, 100, 'dematerialization ran to 100%');
    assert.equal(+now.occupancy.toFixed(2), +((63 / 160) * 100).toFixed(2), 'the buffer holds 63 of 160 kg');
    await expect(page.locator('#dematReading')).toHaveText('100% COMPLETE');
    await expect(page.locator('#bufferPercent')).toHaveText('39%');
    await expect(page.locator('#bufferGauge')).toHaveAttribute('aria-valuenow', '39%');
    await expect(page.locator('#massGauge')).toHaveAttribute('aria-valuenow', '63');
    const fill = await page.locator('#bufferFill').getAttribute('height');
    assert.ok(Math.abs(+fill - 296 * (63 / 160)) < 0.2, `buffer drawn ${fill} of 296 high`);
    // Materializing half of it leaves half the pattern in the buffer.
    await lever(page, '#matSlider', 'End');
    await step(page, 4);
    await expect(page.locator('#matReading')).toHaveText('50% COMPLETE');
    await expect(page.locator('#stageReading')).toHaveText('MAT 50%');
    await expect(page.locator('#bufferPercent')).toHaveText('19%');
  },

  'a half-raised lever transfers more slowly, and lowering it pauses': async ({ open }) => {
    const page = await openPaused(open);
    await scanPad(page, 'Dr. Ilyra Moss');
    await step(page, 3.1);
    await page.locator('#dematSlider').focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowUp');
    let now = await state(page);
    assert.equal(now.levers.demat, 50);
    assert.equal(+now.power.toFixed(1), 6.5, 'half lever asks for half way between idle and maximum');
    assert.equal(+now.speed.toFixed(4), +(12.5 * (0.1 + 0.9 * 0.5)).toFixed(4), 'speed rises linearly from 10% at idle');
    await page.keyboard.press('Home');
    await expect(page.locator('#state')).toHaveText('PAUSED');
    const before = (await state(page)).progress;
    await step(page, 2);
    assert.equal((await state(page)).progress, before, 'no progress at lever zero');
  },

  'the pad mass limit takes locks in order and the waiting target follows in the next batch': async ({ open }) => {
    const page = await openPaused(open);
    await scanPad(page, 'Lt. Mara Venn', 'Ens. Keon Pell', 'Dr. Ilyra Moss');
    await step(page, 10);
    let now = await state(page);
    assert.equal(now.limit, 160);
    assert.ok(now.targets.find(t => t.id === 'ilyra').lock === 0, 'the third target does not fit what is left of 160 kg');
    await expect(page.locator('.target-item', { hasText: 'Ilyra' }).locator('.tstate')).toHaveText('BUFFER FULL');
    await lever(page, '#dematSlider', 'End');
    await step(page, 8.1);
    await lever(page, '#matSlider', 'End');
    await step(page, 8.1);
    now = await state(page);
    assert.equal(now.phase, 'ready', 'one target is still selected');
    assert.deepEqual(now.selected, ['ilyra']);
    await step(page, 3.1);
    assert.ok((await state(page)).targets.find(t => t.id === 'ilyra').lock >= 100, 'the waiting target locks on its own');
  },

  'the cargo limit applies only to Non-bio with our Cargo Bay at one end': async ({ open }) => {
    const page = await openPaused(open);
    assert.equal((await state(page)).limit, 160, 'Bio to the cargo bay uses the pad limit');
    await page.locator('[data-kind="nonbio"]').click();
    assert.equal((await state(page)).limit, 320, 'Non-bio from the pad to the cargo bay uses the cargo limit');
    await page.locator('#destinationBtn').click();
    await page.locator('[data-destination="other"]').click();
    await page.locator('#destinationDialog [data-close]').click();
    assert.equal((await state(page)).limit, 160, 'Non-bio from the pad to a station uses the pad limit');
  },

  'shields: internal transfers work with shields up; external ones stop, zero the levers and hold the patterns': async ({ open }) => {
    const page = await openPaused(open);
    await configure(page, { shields: true });
    await expect(page.locator('#shieldState')).toHaveText('SHIELDS UP');
    await scanPad(page, 'Dr. Ilyra Moss');
    await step(page, 3.1);
    await expect(page.locator('#dematSlider')).toHaveAttribute('aria-disabled', 'false');
    await configure(page, { shields: false });
    // Beam to the station instead.
    await page.locator('#destinationBtn').click();
    await page.locator('[data-destination="other"]').click();
    await page.locator('#destinationList [data-place="station"]').click();
    await page.locator('#destinationDialog [data-close]').click();
    await step(page, 3.1);
    await lever(page, '#dematSlider', 'End');
    await step(page, 2);
    await configure(page, { shields: true });
    let now = await state(page);
    assert.equal(now.levers.demat, 0, 'raising shields zeroed the lever');
    assert.equal(now.phase, 'dematerializing', 'the cycle is held, not lost');
    const held = now.progress;
    await expect(page.locator('#state')).toHaveText('BLOCKED');
    await expect(page.locator('#advisory')).toHaveText(/TRANSPORT BLOCKED · Lower our shields/);
    await expect(page.locator('#dematSlider')).toHaveAttribute('aria-disabled', 'true');
    await step(page, 2);
    assert.equal((await state(page)).progress, held);
    await configure(page, { shields: false });
    await lever(page, '#dematSlider', 'End');
    await step(page, 1);
    assert.ok((await state(page)).progress > held, 'lowering shields lets the operator resume');
  },

  "a route to another ship also needs that ship's shields down": async ({ open }) => {
    const page = await openPaused(open);
    await page.locator('[data-source="other"]').click();
    await page.locator('#sourceOther').click();
    await page.locator('#sourceList [data-place="ship"]').click();
    await expect(page.locator('#sourceDialog')).not.toBeVisible();
    await page.locator('#scan').click();
    await pick(page, 'Rhea Tor');
    await configure(page, { remoteShields: true });
    await expect(page.locator('#sourceShield')).toHaveText('SHIELDS UP');
    await expect(page.locator('#advisory')).toHaveText(/The other ship must lower its shields/);
    await step(page, 3.1);
    await expect(page.locator('#dematSlider')).toHaveAttribute('aria-disabled', 'true');
    // Tapping the locked lever says why.
    await page.locator('#dematSlider').click({ force: true });
    await expect(page.locator('#notice')).toHaveText('The other ship must lower its shields.');
  },

  'below minimum power the workspace becomes a checkered "System not available" screen and comes back intact': async ({ open }) => {
    const page = await openPaused(open);
    await scanPad(page, 'Dr. Ilyra Moss');
    await step(page, 1);
    await configure(page, { bus: 0.5 });
    await expect(page.locator('#state')).toHaveText('NO POWER');
    await expect(page.locator('.offline-screen').first()).toBeVisible();
    await expect(page.locator('#sourceControls')).toBeHidden();
    await expect(page.locator('.slider-pair')).toBeHidden();
    await expect(page.locator('#offline')).toBeVisible();
    await expect(page.locator('#powerAvailable')).toHaveText('0.5 PU');
    await expect(page.locator('#advisory')).toHaveText(/INSUFFICIENT POWER/);
    await expect(page.locator('#destinationBtn')).toBeDisabled();
    const lock = (await state(page)).targets.find(t => t.id === 'ilyra').lock;
    await step(page, 2);
    assert.equal((await state(page)).targets.find(t => t.id === 'ilyra').lock, lock, 'no lock progress without power');
    await configure(page, { bus: 12 });
    await expect(page.locator('#sourceControls')).toBeVisible();
    await expect(page.locator('.target-item[aria-pressed="true"]')).toHaveCount(1);
  },

  'Other lists only reachable locations, and moving the ship changes them': async ({ open }) => {
    const page = await openPaused(open);
    assert.deepEqual((await state(page)).reachable, ['station', 'ship', 'earth-settlement-4']);
    await page.locator('#rangeBtn').click();
    await expect(page.locator('.range-row', { hasText: 'Delta Survey Outpost' }).locator('em')).toHaveText('BEHIND THE SURVEY MOON');
    await expect(page.locator('.range-row', { hasText: 'Port Canaveral' }).locator('em')).toHaveText('OUT OF RANGE');
    await page.locator('#rangeDialog [data-close]').click();
    await configure(page, { bearing: 150, altitude: 3000 });
    assert.ok((await state(page)).reachable.includes('outpost'), 'the outpost comes into view');
    await page.locator('#destinationBtn').click();
    await page.locator('[data-destination="other"]').click();
    await page.locator('#destinationList [data-place="outpost"]').click();
    await expect(page.locator('#breathability')).toHaveText('NOT BREATHABLE');
    await expect(page.locator('#atmosphere')).toContainText('CARBON DIOXIDE');
    await expect(page.locator('#atmosphere')).toContainText('243 K / -30 °C');
    await page.locator('#destinationDialog [data-close]').click();
    await expect(page.locator('#destinationAir')).toHaveText('NOT BREATHABLE · 243 K');
    await page.locator('#scan').click();
    await pick(page, 'Lt. Mara Venn');
    await expect(page.locator('#advisory')).toHaveText(/not breathable/);
  },

  'picking a location on the range map lights it up there, with an arrow at the edge for one off the map': async ({ open }) => {
    const page = await openPaused(open);
    await page.locator('#rangeBtn').click();
    await expect(page.locator('#rangePick')).toHaveCount(0);
    await page.locator('.range-row[data-place="outpost"]').click();
    await expect(page.locator('.range-row[data-place="outpost"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#rangePick .r-pick-label')).toHaveText('Delta Survey Outpost');
    await expect(page.locator('#rangePick .r-pick-ring')).toHaveCount(1);
    // The ring sits on the outpost's own dot.
    const [ring, dot] = await page.evaluate(() => [document.querySelector('#rangePick .r-pick-ring'), document.querySelector('.r-place[data-place="outpost"]')].map(n => [n.getAttribute('cx'), n.getAttribute('cy')].join(',')));
    assert.equal(ring, dot);
    // Paris is beyond the edge of the map.
    await page.locator('.range-row[data-place="earth-settlement-0"]').click();
    await expect(page.locator('#rangePick .r-pick-detail')).toHaveText('13,742 KM · OFF MAP');
    await expect(page.locator('#rangePick .r-pick-arrow')).toHaveCount(1);
    await expect(page.locator('.range-row[aria-pressed="true"]')).toHaveCount(1);
    // A tap on a dot picks it too, and a second tap on the same row clears it.
    await page.locator('.r-place[data-place="station"]').dispatchEvent('click');
    await expect(page.locator('#rangePick .r-pick-label')).toHaveText('Earth Orbital Station');
    await page.locator('.range-row[data-place="station"]').click();
    await expect(page.locator('#rangePick')).toHaveCount(0);
  },

  'Clear Transport resets the route and selections but leaves people where they are': async ({ open }) => {
    const page = await openPaused(open);
    await scanPad(page, 'Dr. Ilyra Moss');
    await step(page, 3.1);
    await lever(page, '#dematSlider', 'End');
    await step(page, 8.1);
    await lever(page, '#matSlider', 'End');
    await step(page, 8.1);
    await page.locator('[data-source="cargo"]').click();
    await page.locator('#clearTransport').click();
    const now = await state(page);
    assert.equal(now.source, 'pad');
    assert.equal(now.destination, 'cargo');
    assert.deepEqual(now.delivered, []);
    assert.equal(now.scanned, false);
    assert.equal(now.targets.find(t => t.id === 'ilyra').place, 'cargo', 'the delivered target stays delivered');
  },

  'demo controls: Mark presets set range and limits, and range must stay within 10,000–15,000 km': async ({ open }) => {
    const page = await openPaused(open);
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('[data-mark="2"]').click();
    let now = await state(page);
    assert.deepEqual([now.settings.range, now.settings.maxMass, now.settings.maxCargoMass], [12000, 320, 480]);
    await expect(page.locator('[data-field="range"] [data-value]')).toHaveText('12,000 km');
    await expect(page.locator('#caption')).toHaveText(/MARK II · RANGE 12,000 KM/);
    await page.locator('[data-field="range"] [data-edit]').click();
    await page.keyboard.type('16000');
    await page.locator('#menuDialog [data-save]').click();
    await expect(page.locator('#menuDialog .keypad-error')).toHaveText('Range must be 10,000 to 15,000 km.');
    await page.locator('#menuDialog [data-cancel]').click();
    // Lowest and fastest stage rates are linked 1:10.
    await page.locator('[data-field="slowest"] [data-edit]').click();
    await page.keyboard.type('2');
    await page.locator('#menuDialog [data-save]').click();
    await expect(page.locator('[data-field="fastest"] [data-value]')).toHaveText('20% / s');
    now = await state(page);
    assert.equal(now.settings.fastest, 20);
  },

  'Reset Demo returns everyone to their starting location': async ({ open }) => {
    const page = await openPaused(open);
    await scanPad(page, 'Dr. Ilyra Moss');
    await step(page, 3.1);
    await lever(page, '#dematSlider', 'End');
    await step(page, 8.1);
    await lever(page, '#matSlider', 'End');
    await step(page, 8.1);
    assert.equal((await state(page)).targets.find(t => t.id === 'ilyra').place, 'cargo');
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('#resetDemo').click();
    assert.equal((await state(page)).targets.find(t => t.id === 'ilyra').place, 'pad');
  },
});
