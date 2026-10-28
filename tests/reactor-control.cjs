// Reactor Control: the schematic readouts, the controls, damage as an indicator, maintenance and the demo controls.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

async function demoControls(page, act) {
  await page.locator('#menuBtn').click();
  await page.locator('#openDemoControls').click();
  await act();
  if (await page.locator('#menuDialog').isVisible()) await page.locator('#menuDialog [data-close]').last().click();
}
const coldStart = page => demoControls(page, () => page.locator('#coldStart').click());
const state = page => page.evaluate(() => ReactorControl.state());

run({
  'the schematic shows fuel flow in the injection pipe, reaction power in the core and bus output in the collector pipe': async ({ open }) => {
    const page = await open('/Reactor/');
    await expect(page.locator('#state')).toHaveText('ONLINE');
    const now = await state(page);
    await expect(page.locator('#pipeFlow')).toHaveText(/^0\.\d{3} u\/s$/);
    await expect(page.locator('#reactionValue')).toHaveText(/^\d+\.\d PU$/);
    await expect(page.locator('#pipeOutput')).toHaveText(/^\d+\.\d PU$/);
    await expect(page.locator('#busLoad')).toHaveText(String(now.load));
    await expect(page.locator('#tankUnits')).toHaveText(/^10,\d{3}$/);
    await expect(page.locator('#tankTime')).toHaveText(/^\d\d:\d\d:\d\d$/);
    await expect(page.locator('#stabilityGauge')).toHaveAttribute('aria-valuenow', /\d/);
  },
  'reactor damage is an indicator, not a field': async ({ open }) => {
    const page = await open('/Reactor/');
    await expect(page.locator('#damage, input[aria-label*="damage" i]')).toHaveCount(0);
    await expect(page.locator('#damageGauge')).toHaveAttribute('aria-valuenow', '0.0');
    await demoControls(page, () => page.locator('#takeDamage').click());
    await expect(page.locator('#damageGauge')).toHaveAttribute('aria-valuenow', '10.0');
  },
  'a cold start, then Initialize runs the startup sequence with the controls locked': async ({ open }) => {
    const page = await open('/Reactor/');
    await coldStart(page);
    await expect(page.locator('#state')).toHaveText('OFFLINE');
    await expect(page.locator('#advisory')).toHaveText(/Reactor cold/);
    await expect(page.locator('#stop')).toBeDisabled();
    await page.locator('#start').click();
    await expect(page.locator('#state')).toHaveText('INITIALIZING');
    await expect(page.locator('#sequenceNote')).toHaveText('AUTO · STARTUP');
    await expect(page.locator('#flowSlider')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#coolantSlider')).toHaveAttribute('aria-disabled', 'false');
    await page.evaluate(() => ReactorControl.step(1000));
    await expect(page.locator('#state')).toHaveText('ONLINE');
    await expect(page.locator('#flowSlider')).toHaveAttribute('aria-disabled', 'false');
  },
  'the sliders set the controls, and the confinement slider marks the beam the reactor needs': async ({ open }) => {
    const page = await open('/Reactor/');
    await expect(page.locator('#beamSlider .vs-target')).toBeVisible();
    const slider = page.locator('#flowSlider');
    await slider.focus();
    await page.keyboard.press('End');
    await expect(page.locator('#flowValue')).toHaveText('1.000');
    await page.keyboard.press('Home');
    await expect(page.locator('#flowValue')).toHaveText('0.000');
    const box = await page.locator('#coolantSlider .vs-body').boundingBox();
    await page.mouse.click(box.x + box.width / 4, box.y + box.height * 0.5);
    const coolant = (await state(page)).controls.coolant;
    assert.ok(Math.abs(coolant - 50) < 3, `coolant valve near 50% (${coolant})`);
  },
  'damage breaks subsystems, which show on the schematic and in Maintenance': async ({ open }) => {
    const page = await open('/Reactor/');
    await page.evaluate(() => ReactorControl.setDamage(55));
    const { faults } = await state(page);
    assert.ok(faults.length >= 2, `faults after 55% damage (${faults})`);
    await expect(page.locator('#schematic .s-label.fault')).toHaveCount(faults.length);
    await expect(page.locator('#maintenanceBtn')).toHaveAttribute('data-alert', 'true');
    await page.locator('#maintenanceBtn').click();
    await expect(page.locator('#faultCount')).toHaveText(`${faults.length} FAULTS`);
    await expect(page.locator('.component[data-state="fault"]')).toHaveCount(faults.length);
    // Replacing a part needs a cold reactor.
    await expect(page.locator('.component[data-state="fault"] button').first()).toBeDisabled();
    await page.locator('#repair').click();
    await expect(page.locator('#repair')).toHaveText('PAUSE REPAIRS');
  },
  'a faulty part can be replaced once the reactor is cold': async ({ open }) => {
    const page = await open('/Reactor/');
    await coldStart(page);
    await page.evaluate(() => ReactorControl.setDamage(35));
    await page.locator('#maintenanceBtn').click();
    const faulty = page.locator('.component[data-state="fault"]');
    await expect(faulty).toHaveCount(1);
    await faulty.locator('button').click();
    await expect(page.locator('.component[data-state="working"] span')).toHaveText(/^DOT 1 replacing/);
    await page.evaluate(() => ReactorControl.step(6100));
    await expect(page.locator('.component[data-state="fault"], .component[data-state="working"]')).toHaveCount(0);
    assert.equal((await state(page)).damage, 25);
  },
  'ejecting the core asks first, then empties the chamber': async ({ open }) => {
    const page = await open('/Reactor/');
    await page.locator('#eject').click();
    await expect(page.locator('#ejectDialog')).toBeVisible();
    await page.locator('#confirmEject').click();
    await expect(page.locator('#state')).toHaveText('CORE EJECTED');
    await expect(page.locator('#chamberOut')).toHaveText('CORE EJECTED');
    await expect(page.locator('#reactionGlow')).toBeHidden();
    await expect(page.locator('#eject')).toBeDisabled();
    await demoControls(page, async () => {
      await expect(page.locator('#installCore')).toBeDisabled();
      await page.locator('#stationPower').check({ force: true });
      await page.locator('#installCore').click();
    });
    await expect(page.locator('#state')).toHaveText('OFFLINE');
  },
  'the demo controls set the ship load and the fuel on the keypad': async ({ open }) => {
    const page = await open('/Reactor/');
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('[data-field="load"] [data-edit]').click();
    for (const key of ['1', '2', '0']) await page.locator('#menuDialog .keypad-keys button', { hasText: new RegExp(`^${key}$`) }).click();
    await page.locator('#menuDialog [data-save]').click();
    await page.locator('[data-field="fuel"] [data-edit]').click();
    for (const key of ['5', '0', '0']) await page.locator('#menuDialog .keypad-keys button', { hasText: new RegExp(`^${key}$`) }).click();
    await page.locator('#menuDialog [data-save]').click();
    await page.locator('#menuDialog [data-close]').last().click();
    await expect(page.locator('#busLoad')).toHaveText('120');
    await expect(page.locator('#tankUnits')).toHaveText(/^(500|499)$/);
  },
  'diagnostics lists every reading': async ({ open }) => {
    const page = await open('/Reactor/');
    await page.locator('.dock [data-open="diagnosticsDialog"]').click();
    const labels = await page.locator('#diagnostics dt').allInnerTexts();
    for (const label of ['GROSS ELECTRICAL OUTPUT', 'SUPPORT BATTERY', 'YIELD PER FUEL UNIT', 'SUBSYSTEM FAULTS']) assert.ok(labels.includes(label), `${label} is listed`);
  },
});
