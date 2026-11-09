// Docking Control: the berth schematic with moorings and clamps; the umbilical extends and retracts; fuel and
// station power are requested over it from the dock master; the gangway pressurizes; the station's release (a demo
// stand-in for the comm officer's request) runs the clamps and moorings in reverse; and docking is a demo control.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const state = page => page.evaluate(() => DockingControl.state());
const step = (page, seconds) => page.evaluate(s => DockingControl.step(s), seconds);
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
async function connect(page) {
  await page.locator('#umbilicalBtn').click();
  await step(page, 10.1);
  await expect(page.locator('#umbilicalRow')).toHaveText('CONNECTED');
}

run({
  'secured at the berth: four moorings engaged and four clamps locked, the umbilical stowed': async ({ open }) => {
    const page = await open('/Docking/');
    await expect(page.locator('.title-pill')).toHaveText('DOCKING CONTROL');
    await expect(page.locator('#schematic')).toBeVisible();
    await expect(page.locator('#state')).toHaveText('SECURED');
    await expect(page.locator('#mooringCount')).toHaveText('ENGAGED · 4 / 4');
    await expect(page.locator('#clampCount')).toHaveText('LOCKED · 4 / 4');
    await expect(page.locator('#mooringLamps .light[data-state="on"]')).toHaveCount(4);
    await expect(page.locator('#clampLamps .light[data-state="on"]')).toHaveCount(4);
    await expect(page.locator('#moorings path[data-state="engaged"]')).toHaveCount(4);
    await expect(page.locator('#moorings rect[data-state="locked"]')).toHaveCount(4);
    await expect(page.locator('#umbilicalRow')).toHaveText('RETRACTED');
    await expect(page.locator('#fuelRow')).toHaveText('35.0%');
    await expect(page.locator('#powerRow')).toHaveText('OFF');
    await expect(page.locator('#lifeRow')).toHaveText('Ship');
    // Release is the station's, after the comm officer asks: there is no release command on this console.
    await expect(page.locator('.dock button')).toHaveText(['EXTEND UMBILICAL', 'REQUEST FUEL', 'REQUEST POWER', 'PRESSURIZE GANGWAY', 'DOCK LOG']);
    await expect(page.locator('#releaseBtn')).toHaveCount(0);
    await expect(page.locator('#fuelBtn')).toBeDisabled();
    await expect(page.locator('#powerBtn')).toBeDisabled();
    await expect(page.locator('#advisory')).toHaveText('Secured at Berth 3. Extend the umbilical for station services.');
  },
  'the umbilical extends in ten seconds, brings the data link and station life support, and retracts': async ({ open }) => {
    const page = await open('/Docking/');
    await page.locator('#umbilicalBtn').click();
    await step(page, 5);
    await expect(page.locator('#umbilicalRow')).toHaveText('EXTENDING · 50%');
    await expect(page.locator('#umbilicalBtn')).toBeDisabled();
    await step(page, 5.1);
    await expect(page.locator('#umbilicalRow')).toHaveText('CONNECTED');
    await expect(page.locator('#umbilicalBtn')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#lifeRow')).toHaveText('Station · over the umbilical');
    await expect(page.locator('#dataRow')).toHaveText('Connected · station network');
    await expect(page.locator('#notice')).toHaveText('Umbilical connected to the station. Data link up; station life support available.');
    await page.locator('#umbilicalBtn').click();
    await step(page, 10.1);
    await expect(page.locator('#umbilicalRow')).toHaveText('RETRACTED');
    await expect(page.locator('#dataRow')).toHaveText('Offline');
  },
  'fuel is requested from the dock master and flows until the tank is full': async ({ open }) => {
    const page = await open('/Docking/');
    await connect(page);
    await page.locator('#fuelBtn').click();
    await expect(page.locator('#fuelLabel')).toHaveText('AWAITING STATION');
    await step(page, 3.1);
    await expect(page.locator('#notice')).toHaveText('Dock master: fuel approved. Transfer started.');
    await expect(page.locator('#fuelLabel')).toHaveText('STOP FUEL');
    await expect(page.locator('#fuelStream')).not.toHaveClass(/idle/);
    const before = (await state(page)).fuel;
    await step(page, 60);
    assert.ok(Math.abs((await state(page)).fuel - before - 1080) < 20, 'eighteen units a second');
    await expect(page.locator('#advisory')).toHaveText(/^Refuelling · 45\.\d% · full in /);
    // Retracting is refused while fuel flows.
    await page.locator('#umbilicalBtn').click();
    await expect(page.locator('#notice')).toHaveText('Stop the fuel transfer and station power before retracting the umbilical.');
    await page.locator('#fuelBtn').click();
    await expect(page.locator('#fuelLabel')).toHaveText('REQUEST FUEL');
    await demo(page, () => setField(page, 'fuel', '99.9'));
    await page.locator('#fuelBtn').click();
    await step(page, 5);
    await expect(page.locator('#notice')).toHaveText('Fuel tank full. Transfer complete.');
    await expect(page.locator('#fuelLabel')).toHaveText('TANK FULL');
    await expect(page.locator('#fuelBtn')).toBeDisabled();
    // A berth without fuel refuses.
    await demo(page, async () => {
      await setField(page, 'fuel', '50');
      await page.locator('#demoStationFuel').uncheck({ force: true });
    });
    await page.locator('#fuelBtn').click();
    await step(page, 3.1);
    await expect(page.locator('#notice')).toHaveText('Dock master: no fuel available at Berth 3.');
  },
  'station power comes over the umbilical and takes ten seconds to disconnect': async ({ open }) => {
    const page = await open('/Docking/');
    await connect(page);
    await page.locator('#powerBtn').click();
    await step(page, 3.1);
    await expect(page.locator('#powerRow')).toHaveText('ON · 40 PU');
    await expect(page.locator('#busPower')).toHaveText('+40 PU');
    await expect(page.locator('#powerBtn')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#powerBtn').click();
    await expect(page.locator('#powerRow')).toHaveText('DISCONNECTING');
    await expect(page.locator('#powerBtn')).toBeDisabled();
    await page.locator('#umbilicalBtn').click();
    await expect(page.locator('#notice')).toHaveText('Stop the fuel transfer and station power before retracting the umbilical.');
    await step(page, 10.1);
    await expect(page.locator('#powerRow')).toHaveText('OFF');
    await expect(page.locator('#busPower')).toHaveText('SHIP POWER');
  },
  'the station holds the release for the umbilical and gangway, then opens the clamps and reels in the moorings': async ({ open }) => {
    const page = await open('/Docking/');
    await connect(page);
    await page.locator('#gangwayBtn').click();
    await step(page, 8.1);
    await expect(page.locator('#gangwayRow')).toHaveText('Pressurized · hatches open');
    await demo(page, () => page.locator('#demoRelease').click());
    await expect(page.locator('#notice')).toHaveText('Dock master: release held. First retract the umbilical and seal the gangway.');
    await expect(page.locator('#state')).toHaveText('SECURED');
    await page.locator('#gangwayBtn').click();
    await page.locator('#umbilicalBtn').click();
    await step(page, 10.1);
    await demo(page, () => page.locator('#demoRelease').click());
    await expect(page.locator('#notice')).toHaveText('Dock master: releasing the ship. Clamps opening.');
    await expect(page.locator('#state')).toHaveText('RELEASING');
    await expect(page.locator('#advisory')).toHaveText('The station is releasing us: the clamps open, then the moorings reel in.');
    const opening = await page.evaluate(() => (DockingControl.step(1.1), DockingControl.state().clamps));
    assert.ok(opening.includes('open') && opening.includes('locked'), `the clamps open one after another (${opening})`);
    await step(page, 1);
    await expect(page.locator('#clampCount')).toHaveText('OPEN');
    await expect(page.locator('#moorings rect[data-state="open"]')).toHaveCount(4);
    await step(page, 3.1);
    await expect(page.locator('#state')).toHaveText('RELEASED');
    await expect(page.locator('#advisory')).toHaveText('Released by the station. Undock from the Helm to back clear.');
    await step(page, 5);
    await expect(page.locator('#state')).toHaveText('RELEASED', { timeout: 100 });
    await demo(page, async () => {
      await expect(page.locator('#demoUndock')).toHaveText('AUTO UNDOCK');
      await page.locator('#demoUndock').click();
    });
    await expect(page.locator('#state')).toHaveText('DEPARTING');
    await step(page, 4.1);
    await expect(page.locator('#state')).toHaveText('FREE FLIGHT');
    await expect(page.locator('#mooringCount')).toHaveText('STOWED');
    await expect(page.locator('#advisory')).toHaveText('Free flight. Hail a station from Communications for docking clearance, then dock from the Helm.');
    for (const id of ['#umbilicalBtn', '#gangwayBtn']) await expect(page.locator(id)).toBeDisabled();
  },
  'docking (a demo control) closes on the berth, then the moorings tension and the clamps lock': async ({ open }) => {
    const page = await open('/Docking/');
    await expect(page.locator('#demoControls')).toBeHidden();
    await demo(page, async () => {
      await page.locator('#demoUndock').click();
      await page.locator('#demoClearance').click();
      await page.locator('#demoDock').click();
    });
    await expect(page.locator('#state')).toHaveText('APPROACHING');
    await step(page, 4.1);
    await expect(page.locator('#state')).toHaveText('DOCKING');
    await step(page, 1.6);
    await expect(page.locator('#mooringCount')).toHaveText(/^TENSIONING · 2 \/ 4$/);
    await step(page, 1.6);
    await expect(page.locator('#clampCount')).toHaveText(/^LOCKING · 0 \/ 4$/);
    await step(page, 2.1);
    await expect(page.locator('#state')).toHaveText('SECURED');
    await expect(page.locator('#notice')).toHaveText('Clamps locked. Ship secured at Berth 3.');
    await page.locator('#logBtn').click();
    await expect(page.locator('#logList li').first()).toContainText('Clamps locked. Ship secured at Berth 3.');
    await expect(page.locator('#logList')).toContainText('Moorings engaged, four of four.');
    await expect(page.locator('#logList')).toContainText('Approaching Earth Orbital Station, Berth 3.');
  },
  'clearance: required in free flight, granted by the station, used up at the berth; Auto Dock is refused without it': async ({ open }) => {
    const page = await open('/Docking/');
    await expect(page.locator('#clearanceRow')).toHaveText('Used for this berth');
    await demo(page, async () => {
      await page.locator('#demoUndock').click();
      await page.locator('#demoDock').click();
    });
    await expect(page.locator('#notice')).toHaveText('Auto Dock refused: no docking clearance. Hail the station from Communications.');
    await expect(page.locator('#state')).toHaveText('FREE FLIGHT');
    await expect(page.locator('#clearanceRow')).toHaveText('Required · hail the station');
    await expect(page.locator('#clearanceRow')).toHaveAttribute('data-level', 'warn');
    await demo(page, () => page.locator('#demoClearance').click());
    await expect(page.locator('#clearanceRow')).toHaveText('Granted · Earth Orbital Station');
    await expect(page.locator('#advisory')).toHaveText('Docking clearance from Earth Orbital Station. Auto Dock from the Helm within 10 km.');
    await demo(page, () => page.locator('#demoDock').click());
    await step(page, 9);
    await expect(page.locator('#state')).toHaveText('SECURED');
    await expect(page.locator('#clearanceRow')).toHaveText('Used for this berth');
    await demo(page, () => page.locator('#demoClearanceRequired').uncheck({ force: true }));
    await expect(page.locator('#clearanceRow')).toHaveText('Not required');
  },
  'while secured, the station\'s repair drones show in the Berth panel, read-only; they leave with the ship': async ({ open }) => {
    const page = await open('/Docking/');
    const group = page.locator('[data-testid="station-repair"]');
    await expect(group).toBeVisible();
    await expect(page.locator('#stationRepairState')).toHaveText('×2');
    await expect(page.locator('#stationRepairNote')).toHaveText("Earth Orbital Station's repair drones · not under the crew's control");
    await expect(page.locator('#stationRepairList li')).toHaveCount(2);
    await expect(page.locator('#stationRepairList li').first()).toHaveText(/Warp drive · 2 units\s*\+0\.22 %\/s/);
    await expect(group.locator('button')).toHaveCount(0);
    await expect(page.locator('[data-testid="critical-banner"]')).toBeHidden();
    await demo(page, () => page.locator('#demoStationRepair').uncheck({ force: true }));
    await expect(group).toBeHidden();
    await demo(page, () => page.locator('#demoStationRepair').check({ force: true }));
    await expect(group).toBeVisible();
    await demo(page, () => page.locator('#demoUndock').click());
    await expect(group).toBeHidden();
  },
});
