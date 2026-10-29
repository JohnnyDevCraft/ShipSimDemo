// Life Support Control: the station feeds life support over the umbilical and the ship plant is redundant; with
// the umbilical gone the plant must be on, or the air fails and the ship becomes NON-HABITABLE (on every console
// that watches it); damage lowers the plant's effectiveness until it cannot keep up; the power feeding it; the
// cabin temperature, the thermostat and gravity; and the demo controls in the menu.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const state = page => page.evaluate(() => LifeSupport.state());
const step = (page, seconds) => page.evaluate(s => LifeSupport.step(s), seconds);
async function demo(page, act) {
  await page.locator('#menuBtn').click();
  await page.locator('#openDemoControls').click();
  await act();
  if (await page.locator('#menuDialog').isVisible()) await page.locator('#menuDialog [data-close]').last().click();
}
async function setField(page, key, text) {
  await page.locator(`#menuDialog [data-field="${key}"] [data-edit]`).click();
  const pad = page.locator('#menuDialog .keypad');
  await pad.getByRole('button', { name: 'Clear' }).click();
  for (const key of text) await pad.getByRole('button', { name: key, exact: true }).click();
  await page.locator('#menuDialog [data-save]').click();
}
const undock = page => demo(page, () => page.locator('#demoFeed').uncheck({ force: true }));

run({
  'docked with the umbilical connected, the station feeds life support and the ship plant is redundant': async ({ open }) => {
    const page = await open('/LifeSupport/');
    await expect(page.locator('.title-pill')).toHaveText('LIFE SUPPORT CONTROL');
    await expect(page.locator('#state')).toHaveText('HABITABLE');
    await expect(page.locator('#sourceChip')).toHaveText('STATION');
    await expect(page.locator('#sourceRow')).toHaveText('Station · over the umbilical');
    await expect(page.locator('#plantRow')).toHaveText('On · redundant');
    await expect(page.locator('#gasO2 [data-value]')).toHaveText('21.0%');
    await expect(page.locator('#gasCO2 [data-value]')).toHaveText('0.40%');
    await expect(page.locator('#gasCO [data-value]')).toHaveText('2 ppm');
    await expect(page.locator('#timeLeft')).toHaveText('Air holding');
    await expect(page.locator('#gravityRow')).toHaveText('ON · 1.00 g');
    await expect(page.locator('#gravityNote')).toHaveText('Plating powered by the station');
    await expect(page.locator('#effectRow')).toHaveText('100%');
    await expect(page.locator('#outsideRow')).toHaveText('Station bay · 12 °C');
    // The schematic: no ship picture, just what feeds life support and what it supplies.
    await expect(page.locator('#schematic .room, #hull')).toHaveCount(0);
    await expect(page.locator('#feedState')).toHaveText('CONNECTED');
    await expect(page.locator('#feedPower')).toHaveText('5.0 PU');
    await expect(page.locator('#shipPower')).toHaveText('0.0 PU');
    await expect(page.locator('#drawRow')).toHaveText('5.0 PU · station');
    await expect(page.locator('#plantState')).toHaveText('ON · REDUNDANT');
    await expect(page.locator('#cabinTempValue')).toHaveText('21.0 °C');
    await expect(page.locator('#gravityValue')).toHaveText('1.00 g');
    await expect(page.locator('#stationStream')).not.toHaveClass(/idle/);
    await expect(page.locator('#shipStream')).toHaveClass(/idle/);
    await expect(page.locator('.dock button')).toHaveText(['LIFE SUPPORT ON', 'GRAVITY ON', 'THERMOSTAT', 'DIAGNOSTICS']);
    await expect(page.locator('#advisory')).toHaveText('The station feeds life support over the umbilical; the ship plant is redundant.');
    // The ship plant can stand by while the station feeds us; the air holds.
    await page.locator('#lifeBtn').click();
    await expect(page.locator('#plantRow')).toHaveText('Standby');
    await expect(page.locator('#lifeBtn')).toHaveAttribute('data-level', 'station');
    await step(page, 300);
    await expect(page.locator('#gasO2 [data-value]')).toHaveText('21.0%');
    await expect(page.locator('#advisory')).toHaveText('Life support provided by the station over the umbilical.');
  },
  'with the umbilical gone and the plant off, the air fails in ten minutes and the ship is non-habitable everywhere': async ({ open }) => {
    const page = await open('/LifeSupport/');
    await page.locator('#lifeBtn').click();
    await undock(page);
    await expect(page.locator('#sourceChip')).toHaveText('NONE');
    await expect(page.locator('#lifeBtn')).toHaveAttribute('data-level', 'off');
    await expect(page.locator('#advisory')).toHaveText(/^LIFE SUPPORT OFF with no station feed · non-habitable in (9m 5\ds|10m 00s)\. Turn it on\.$/);
    await step(page, 240);
    await expect(page.locator('#state')).toHaveText('DANGEROUS');
    await expect(page.locator('#gasCO2')).toHaveAttribute('data-level', 'danger');
    await expect(page.locator('#gasO2')).toHaveAttribute('data-level', 'degraded');
    await expect(page.locator('#cabinState')).toHaveText('DANGEROUS');
    const mid = await state(page);
    assert.ok(Math.abs(mid.secondsLeft - 360) < 5, `six minutes left (${mid.secondsLeft})`);
    assert.ok(mid.cabin < 15, `the cabins are cooling (${mid.cabin})`);
    await step(page, 370);
    await expect(page.locator('#nonHabitable')).toBeVisible();
    await expect(page.locator('#nonHabitable')).toContainText('NON-HABITABLE');
    await expect(page.locator('#nonHabitableCause')).toHaveText('OXYGEN EXHAUSTED');
    await expect(page.locator('#state')).toHaveText('NON-HABITABLE');
    await expect(page.locator('#lifeBtn')).toBeDisabled();
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('xmps-demo-habitability')))).habitable, false);
    // Any other console that watches the ship shows it too.
    const other = await open('/LifeSupport/');
    await expect(other.locator('#nonHabitable')).toBeVisible();
    await page.locator('#restartDemo').click();
    await expect(page.locator('#nonHabitable')).toBeHidden();
    await expect(page.locator('#state')).toHaveText('HABITABLE');
    await expect(other.locator('#nonHabitable')).toBeHidden();
  },
  'turning the plant on after the umbilical goes recovers the air': async ({ open }) => {
    const page = await open('/LifeSupport/');
    await page.locator('#lifeBtn').click();
    await undock(page);
    await step(page, 120);
    await expect(page.locator('#state')).toHaveText('DEGRADED');
    await page.locator('#lifeBtn').click();
    await expect(page.locator('#sourceRow')).toHaveText('Ship plant');
    // Undocked, the ship bus powers the plant and the gravity generator.
    await expect(page.locator('#shipPower')).toHaveText('5.0 PU');
    await expect(page.locator('#drawRow')).toHaveText('5.0 PU · ship bus');
    await expect(page.locator('#feedState')).toHaveText('NOT CONNECTED');
    await expect(page.locator('#shipStream')).not.toHaveClass(/idle/);
    await expect(page.locator('#stationStream')).toHaveClass(/idle/);
    await expect(page.locator('#timeLeft')).toHaveText('Air holding');
    await expect(page.locator('#advisory')).toHaveText(/^Recovering · oxygen /);
    const before = (await state(page)).o2;
    await step(page, 60);
    assert.ok((await state(page)).o2 > before, 'oxygen is coming back');
    await step(page, 900);
    await expect(page.locator('#state')).toHaveText('HABITABLE');
    await expect(page.locator('#gasO2 [data-value]')).toHaveText('21.0%');
  },
  'damage wears down the plant: below 80% it cannot keep up and the air slowly fails': async ({ open }) => {
    const page = await open('/LifeSupport/');
    await undock(page);
    await demo(page, () => setField(page, 'damage', '50'));
    await expect(page.locator('#effectRow')).toHaveText('50%');
    await expect(page.locator('#effectNote')).toHaveText('50% damage · cannot keep up with the crew');
    // 125% capacity at half effectiveness leaves a 37.5% shortfall: 600 s / 0.375.
    await expect(page.locator('#timeLeft')).toHaveText('26m 40s');
    await expect(page.locator('#advisory')).toHaveText('The plant at 50% cannot keep up · non-habitable in 26m 40s.');
    await demo(page, () => setField(page, 'damage', '10'));
    await expect(page.locator('#timeLeft')).toHaveText('Air holding');
    await expect(page.locator('#effectNote')).toHaveText('10% damage · keeping up with the crew');
  },
  'the cabin temperature, the thermostat and gravity': async ({ open }) => {
    const page = await open('/LifeSupport/');
    await page.locator('#thermostatBtn').click();
    await expect(page.locator('#setpointValue')).toHaveText('21 °C');
    await page.locator('#setUp').click();
    await page.locator('#setUp').click();
    await expect(page.locator('#setpointValue')).toHaveText('23 °C');
    await page.locator('#thermostatDialog [data-close]').click();
    await step(page, 60);
    await expect(page.locator('#cabinTempValue')).toHaveText('23.0 °C');
    await expect(page.locator('#cabinTemp')).toHaveText('23.0 °C');
    await page.locator('#diagnosticsBtn').click();
    await expect(page.locator('#diagnostics')).toContainText('23.0 °C · setpoint 23 °C');
    await page.locator('#diagnosticsDialog [data-close]').click();
    await page.locator('#gravityBtn').click();
    await expect(page.locator('#gravityLabel')).toHaveText('GRAVITY OFF');
    await step(page, 5.1);
    await expect(page.locator('#gravityRow')).toHaveText('OFF · 0.00 g');
    await expect(page.locator('#advisory')).toHaveText('Gravity off · 0.00 g.');
    await expect(page.locator('#gravityState')).toHaveText('ZERO G');
    await expect(page.locator('#drawRow')).toHaveText('2.0 PU · station');
    await page.locator('#gravityBtn').click();
    await step(page, 5.1);
    await expect(page.locator('#gravityRow')).toHaveText('ON · 1.00 g');
  },
  'the demo controls live in the menu: the station feed, damage and the demo clock': async ({ open }) => {
    const page = await open('/LifeSupport/');
    await expect(page.locator('#demoControls')).toBeHidden();
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await expect(page.locator('#demoFeed')).toBeChecked();
    await page.locator('[data-speed="60"]').click();
    await expect(page.locator('[data-speed="60"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#menuDialog [data-close]').last().click();
    await expect(page.locator('#caption')).toHaveText('ATMOSPHERE · TEMPERATURE · GRAVITY · DEMO CLOCK ×60');
  },
});
