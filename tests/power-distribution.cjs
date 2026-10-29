// Power Distribution: the subsystem cards and their overlay (relay, regulator, gauges), the quick relay commands
// in the bottom bar, the bus gauges overlay with battery draw, the hull bus temperature, and the demo controls.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const state = page => page.evaluate(() => PowerDistribution.state());
const steps = (page, n) => page.evaluate(count => PowerDistribution.step(count), n);
const card = (page, slot) => page.locator('.subsystem', { has: page.locator('b', { hasText: new RegExp(`^${slot}$`) }) });
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

run({
  'the subsystems fill the screen and the hull bus temperature is always shown; the battery panel is gone': async ({ open }) => {
    const page = await open('/PowerDistribution/');
    await expect(page.locator('.subsystem')).toHaveCount(14);
    await expect(page.locator('#onCount')).toHaveText('14 / 14 ON');
    await expect(page.locator('#thermalPanel')).toBeVisible();
    await expect(page.locator('#busTemperature')).toHaveText(/^\d+\.\d K$/);
    await expect(page.locator('#busLoad')).toHaveText('83.0 PU');
    await expect(page.locator('#state')).toHaveText('LOAD 83.0 / 180.0 PU');
    await expect(page.locator('text=SUPPORT BATTERY')).toHaveCount(0);
    await expect(page.locator('text=BATTERY ENGAGED')).toHaveCount(0);
    await expect(card(page, 'Shields')).toContainText('15.5');
  },
  'tapping a subsystem opens its overlay: relay, regulator and gauges': async ({ open }) => {
    const page = await open('/PowerDistribution/');
    await card(page, 'Shields').click();
    await expect(page.locator('#subsystemDialog')).toBeVisible();
    await expect(page.locator('#detailTitle')).toHaveText('SHIELDS');
    await expect(page.locator('#detailGauges .gauge')).toHaveCount(4);
    await expect(page.locator('#detailGauges')).toContainText('15.5');
    // What production will have: the relay, the regulator bar and the gauges; no demo controls.
    await expect(page.locator('#subsystemDialog')).not.toContainText(/demo|operating setting/i);
    await expect(page.locator('#subsystemDialog input[type="range"]')).toHaveCount(1);
    await page.locator('#regulatorInput').evaluate(input => {
      input.value = '40';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#regValue')).toHaveText('40%');
    await expect(card(page, 'Shields')).toContainText('40%');
    await page.locator('#regulatorInput').evaluate(input => {
      input.value = '0';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#regValue')).toHaveText('0%');
    await expect(page.locator('#detailNotice')).toHaveText(/Underpowered/);
    await expect(card(page, 'Shields')).toHaveAttribute('data-state', 'under');
    await page.locator('#relayBtn').click();
    await expect(page.locator('#relayLabel')).toHaveText('RELAY OFF');
    await expect(page.locator('#detailNotice')).toHaveText('Relay open: subsystem offline.');
    await page.locator('#subsystemDialog [data-close]').click();
    await expect(card(page, 'Shields')).toHaveAttribute('data-state', 'off');
    await expect(page.locator('#shieldsBtn')).toHaveAttribute('data-state', 'off');
    await card(page, 'Comms Array').click();
    await expect(page.locator('#fixedNote')).toBeVisible();
    await expect(page.locator('#regulation')).toBeHidden();
  },
  'the quick relay commands are in the bottom bar and light up with their relays': async ({ open }) => {
    const page = await open('/PowerDistribution/');
    await page.locator('#warpBtn').click();
    await expect(page.locator('#warpBtn')).toHaveAttribute('data-state', 'on');
    await expect(page.locator('#impulseBtn')).toHaveAttribute('data-state', 'off');
    await page.locator('#impulseBtn').click();
    await expect(page.locator('#impulseBtn')).toHaveAttribute('data-state', 'on');
    await expect(page.locator('#warpBtn')).toHaveAttribute('data-state', 'off');
    await page.locator('#weaponsBtn').click();
    for (const slot of ['Port Phase Cannon', 'Starboard Phase Cannon', 'Torpedo Launcher']) await expect(card(page, slot)).toHaveAttribute('data-state', 'off');
    await card(page, 'Port Phase Cannon').click();
    await page.locator('#relayBtn').click();
    await page.locator('#subsystemDialog [data-close]').click();
    await expect(page.locator('#weaponsBtn')).toHaveAttribute('data-state', 'part');
    await page.locator('#weaponsBtn').click();
    await expect(page.locator('#weaponsBtn')).toHaveAttribute('data-state', 'on');
    await page.locator('#allOffBtn').click();
    await expect(page.locator('#onCount')).toHaveText('1 / 14 ON');
    await expect(page.locator('#lifeBtn')).toHaveAttribute('data-state', 'on');
    // Life support off starts its outage clock.
    await page.locator('#lifeBtn').click();
    await steps(page, 50);
    await expect(page.locator('#advisory')).toHaveText(/^LIFE SUPPORT OFF · 0:05 · RESIDUAL LIFE SUPPORT$/);
  },
  'docked with the umbilical attached, the station provides life support and the ship’s is redundant': async ({ open }) => {
    const page = await open('/PowerDistribution/');
    await demo(page, async () => {
      await page.locator('#demoDocked').check({ force: true });
      await page.locator('#demoUmbilical').check({ force: true });
    });
    await expect(card(page, 'Life Support')).toContainText('ON · REDUNDANT');
    await card(page, 'Life Support').click();
    await expect(page.locator('#detailNotice')).toHaveText(/redundant while docked/);
    await page.locator('#relayBtn').click();
    await expect(page.locator('#detailNotice')).toHaveText('Life support provided by the station over the umbilical.');
    await page.locator('#subsystemDialog [data-close]').click();
    await expect(card(page, 'Life Support')).toHaveAttribute('data-state', 'station');
    await expect(page.locator('#lifeBtn')).toHaveAttribute('data-state', 'station');
    await steps(page, 600);
    await expect(page.locator('#advisory')).toHaveText('Life support provided by the station over the umbilical.');
    assert.equal((await state(page)).modules.find(m => m.type === 'life').outage, 0, 'no outage while the station provides it');
    // Detached from the umbilical, the ship is without life support and the outage clock starts.
    await demo(page, () => page.locator('#demoUmbilical').uncheck({ force: true }));
    await steps(page, 30);
    await expect(page.locator('#advisory')).toHaveText('LIFE SUPPORT OFF · 0:03 · RESIDUAL LIFE SUPPORT');
    await expect(page.locator('#lifeBtn')).toHaveAttribute('data-state', 'off');
  },
  'the gauges overlay shows the bus, the loads and the battery draw': async ({ open }) => {
    const page = await open('/PowerDistribution/');
    await page.locator('#gaugesBtn').click();
    await expect(page.locator('#gaugeGrid .gauge')).toHaveCount(6);
    await expect(page.locator('#gaugeGrid')).toContainText('REACTOR BUS');
    await expect(page.locator('#gaugeGrid')).toContainText('180.0');
    await expect(page.locator('#gaugeGrid')).toContainText('BATTERY DRAW');
    await page.locator('#gaugesDialog [data-close]').click();
    await demo(page, () => setField(page, 'reactorSupply', '50'));
    await page.locator('#gaugesBtn').click();
    const b = (await state(page)).budget;
    assert.ok(Math.abs(b.batteryDraw - 33) < 0.01, `the battery covers the 33 PU the reactor cannot (${b.batteryDraw})`);
    await expect(page.locator('#gaugeGrid .gauge').nth(4)).toContainText('33.0');
    await expect(page.locator('#gaugeUnmet')).toHaveText('Load supplied');
    await page.locator('#gaugesDialog [data-close]').click();
    await expect(page.locator('#advisory')).toHaveText('The battery is covering 33.0 PU the bus cannot supply.');
    // The battery's bus switch is Battery Control's; the demo stands in for it.
    await demo(page, () => page.locator('#demoBatteryBus').uncheck({ force: true }));
    await expect(page.locator('#state')).toHaveText(/^UNMET /);
    await expect(page.locator('#advisory')).toHaveText(/^Unmet load/);
  },
  'station power over power sync adds 40 PU to the bus': async ({ open }) => {
    const page = await open('/PowerDistribution/');
    await demo(page, async () => {
      await expect(page.locator('#demoUmbilical')).toBeDisabled();
      await page.locator('#demoDocked').check({ force: true });
      await page.locator('#demoUmbilical').check({ force: true });
      await page.locator('#demoSync').check({ force: true });
    });
    assert.equal((await state(page)).budget.bus, 220);
    await expect(page.locator('#state')).toHaveText('LOAD 83.0 / 220.0 PU');
  },
  'the hull bus heats above 150 PU, warns, and breaches above 200 PU': async ({ open }) => {
    const page = await open('/PowerDistribution/');
    await steps(page, 120);
    await expect(page.locator('#busTemperature')).toHaveText('89.0 K');
    await expect(page.locator('#thermalStatus')).toHaveText('NORMAL TEMPERATURE RANGE');
    await demo(page, async () => {
      await page.locator('#demoOverride').check({ force: true });
      await setField(page, 'overrideLoad', '170');
    });
    await expect(page.locator('#thermalTrend')).toHaveText('Heating · +0.40 K/s');
    await expect(page.locator('#busLoadFill')).toHaveAttribute('data-level', 'bad');
    await demo(page, () => page.locator('#demoHot').click());
    await expect(page.locator('#thermalStatus')).toHaveText('CRITICAL · APPROACHING BREACH');
    await expect(page.locator('#thermalPanel')).toHaveAttribute('data-level', 'bad');
    await demo(page, () => setField(page, 'overrideLoad', '210'));
    await steps(page, 1);
    await expect(page.locator('#thermalStatus')).toHaveText('REACTOR BREACH · SHIP LOST');
    await expect(page.locator('#advisory')).toHaveText(/Hull bus breached/);
  },
  'subsystem demand and warp charging are demo controls in the menu, not on the console': async ({ open }) => {
    const page = await open('/PowerDistribution/');
    await card(page, 'Warp Drive').click();
    await expect(page.locator('#detailCapability')).toHaveText('Warp factor cap 6.00');
    await expect(page.locator('#subsystemDialog button', { hasText: /charge|engage/i })).toHaveCount(0);
    await page.locator('#subsystemDialog [data-close]').click();
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('#demoSubsystem').selectOption({ label: 'Long-range Sensors' });
    await expect(page.locator('#warpDemo')).toBeHidden();
    await page.locator('#settingInput').evaluate(input => {
      input.value = '100';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.equal((await state(page)).modules.find(m => m.slot === 'Long-range Sensors').actual, 6, 'the sensors ask for their maximum');
    await page.locator('#demoSubsystem').selectOption({ label: 'Warp Drive' });
    await expect(page.locator('#warpDemo')).toBeVisible();
    await page.locator('#chargeBtn').click();
    await steps(page, 50);
    await expect(page.locator('#coilValue')).toHaveText('50%');
    await steps(page, 60);
    await expect(page.locator('#coilValue')).toHaveText('100%');
    await page.locator('#engageBtn').click();
    await expect(page.locator('#engageBtn')).toHaveText('EXIT WARP');
    assert.ok((await state(page)).modules[1].warping);
  },
});
