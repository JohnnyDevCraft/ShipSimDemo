// Battery Control: the battery's charge and flows, its two controls (Recharge and Bus Power), the reserve, power
// sync monitoring (shown, not controlled), the reactor monitor, diagnostics and the demo controls.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const state = page => page.evaluate(() => BatteryControl.state());
const steps = (page, n) => page.evaluate(count => BatteryControl.step(count), n);
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
  'the battery covers what the reactor cannot, and the schematic shows each flow': async ({ open }) => {
    const page = await open('/Battery/');
    await expect(page.locator('#reactorOut')).toHaveText('67.6 PU');
    await expect(page.locator('#busLoad')).toHaveText('86.0');
    await expect(page.locator('#directFlow')).toHaveText('67.6 PU');
    await expect(page.locator('#busFlow')).toHaveText('18.4 PU');
    await expect(page.locator('#outToBus')).toHaveText('18.4 PU');
    await expect(page.locator('#busUnmet')).toHaveText('0.0');
    await expect(page.locator('#state')).toHaveText('SUPPORTING BUS');
    await expect(page.locator('#netRate')).toHaveText('−18.4 PU');
    await expect(page.locator('#timeLabel')).toHaveText('TIME TO RESERVE');
    await expect(page.locator('#advisory')).toHaveText(/supporting the bus with 18\.4 PU/);
    const before = (await state(page)).battery;
    await steps(page, 10);
    assert.ok(Math.abs(before - (await state(page)).battery - 18.4) < 0.01, 'a second of support takes 18.4 PU·s');
    await expect(page.locator('#busStream')).not.toHaveClass(/idle/);
  },
  'Bus Power off opens the breaker: the battery stops supplying and the load goes short': async ({ open }) => {
    const page = await open('/Battery/');
    await expect(page.locator('#busBtn')).toHaveClass(/active/);
    await page.locator('#busBtn').click();
    await expect(page.locator('#busBtn')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#busBtnLabel')).toHaveText('BUS POWER OFF');
    await expect(page.locator('#busBreaker')).toHaveAttribute('data-closed', 'false');
    await expect(page.locator('#busUnmet')).toHaveText('18.4');
    await expect(page.locator('#advisory')).toHaveText('Ship load not met: 18.4 PU short. Bus power from the battery is off.');
    const before = (await state(page)).battery;
    await steps(page, 50);
    assert.equal((await state(page)).battery, before, 'the battery holds its charge');
    await expect(page.locator('#busStream')).toHaveClass(/idle/);
  },
  'Recharge takes the reactor surplus; with Recharge off the surplus goes unused': async ({ open }) => {
    const page = await open('/Battery/');
    await demo(page, () => setField(page, 'load', '40'));
    await expect(page.locator('#surplusFlow')).toHaveText('27.6 PU');
    await expect(page.locator('#fromReactor')).toHaveText('27.6 PU');
    await expect(page.locator('#state')).toHaveText('CHARGING');
    await expect(page.locator('#timeLabel')).toHaveText('TIME TO FULL');
    await page.locator('#rechargeBtn').click();
    await expect(page.locator('#chargeBreaker')).toHaveAttribute('data-closed', 'false');
    await expect(page.locator('#chargingIn')).toHaveText('0.0 PU');
    await expect(page.locator('#advisory')).toHaveText('Recharge is off: 27.6 PU of reactor surplus is not charging the battery.');
    const before = (await state(page)).battery;
    await steps(page, 20);
    assert.equal((await state(page)).battery, before);
    await page.locator('#rechargeBtn').click();
    await steps(page, 1000);
    await expect(page.locator('#state')).toHaveText('FULL');
    await expect(page.locator('#batteryPercent')).toHaveText('100.0%');
  },
  'the battery stops supporting the bus at its reserve, kept for reactor startup and shutdown': async ({ open }) => {
    const page = await open('/Battery/');
    await demo(page, () => setField(page, 'battery', '21'));
    await steps(page, 100);
    const s = await state(page);
    assert.ok(Math.abs(s.battery - 2000) < 0.01, `stopped at the reserve (${s.battery})`);
    await expect(page.locator('#state')).toHaveText('AT RESERVE');
    await expect(page.locator('#busUnmet')).toHaveText('18.4');
    await expect(page.locator('#advisory')).toHaveText(/reserve, kept for reactor startup and shutdown/);
    await expect(page.locator('#cellFill')).toHaveAttribute('data-level', 'reserve');
  },
  'power sync is monitored, not controlled: docking, the umbilical, sync and the station charge': async ({ open }) => {
    const page = await open('/Battery/');
    // The console itself has no power sync control.
    await expect(page.locator('.dock, .panel, .topbar').locator('button', { hasText: /sync/i })).toHaveCount(0);
    await expect(page.locator('.dock button')).toHaveText([/RECHARGE/, /BUS POWER/, /DIAGNOSTICS/]);
    await expect(page.locator('#dockState')).toHaveText('Undocked');
    await expect(page.locator('#syncState')).toHaveText('Not docked');
    await expect(page.locator('#stationCharge')).toHaveText('No');
    await demo(page, () => page.locator('#demoDock').click());
    await expect(page.locator('#umbilicalState')).toHaveText(/^Attaching · \d+ s$/);
    await steps(page, 101);
    await expect(page.locator('#umbilicalState')).toHaveText('Attached');
    await expect(page.locator('#syncState')).toHaveText('Off');
    await demo(page, () => page.locator('#demoSync').click());
    await expect(page.locator('#syncState')).toHaveText('On');
    await expect(page.locator('#syncLight')).toHaveAttribute('data-state', 'on');
    await expect(page.locator('#stationCharge')).toHaveText('Yes · 3.3 PU');
    await expect(page.locator('#chargeStage')).toHaveText('Stage 2 of 5 · to 90% · 3.3 PU/s');
    await expect(page.locator('#stationFlow')).toHaveText('3.3 PU');
    await expect(page.locator('#stationBox')).toHaveAttribute('data-state', 'power');
    await page.locator('#rechargeBtn').click();
    await expect(page.locator('#stationCharge')).toHaveText('No · recharge off');
    await page.locator('#rechargeBtn').click();
    await demo(page, async () => {
      await expect(page.locator('#demoUndock')).toHaveAttribute('title', 'Stop power sync before undocking.');
      await page.locator('#demoSync').click();
    });
    await expect(page.locator('#syncState')).toHaveText(/^Disconnecting · \d+ s$/);
    await expect(page.locator('#stationCharge')).toHaveText(/^Yes/);
    await steps(page, 101);
    await expect(page.locator('#syncState')).toHaveText('Off');
    await expect(page.locator('#stationCharge')).toHaveText('No');
    await demo(page, () => page.locator('#demoUndock').click());
    await expect(page.locator('#dockState')).toHaveText('Undocked');
  },
  'with the reactor offline the battery carries the whole load': async ({ open }) => {
    const page = await open('/Battery/');
    await demo(page, () => page.locator('#demoReactor').uncheck({ force: true }));
    await expect(page.locator('#reactorStatus')).toHaveText('Offline');
    await expect(page.locator('#reactorState')).toHaveText('OFFLINE');
    await expect(page.locator('#reactorOutput')).toHaveText('0.0 PU');
    await expect(page.locator('#busFlow')).toHaveText('86.0 PU');
    await expect(page.locator('#directStream')).toHaveClass(/idle/);
  },
  'diagnostics lists every reading': async ({ open }) => {
    const page = await open('/Battery/');
    await page.locator('[data-open="diagnosticsDialog"]').click();
    await expect(page.locator('#diagnostics > div')).toHaveCount(16);
    await expect(page.locator('#diagnostics')).toContainText('BATTERY TO BUS');
    await expect(page.locator('#diagnostics')).toContainText('18.4 PU');
  },
});
