// Cargo Bay: four crates aboard against orders for four; the compare view highlights what differs; inspecting a crate counts what
// is inside and finds what its manifest gets wrong; discrepancies are logged (all findings, or by hand) and struck out; the
// receiver refuses a request with a crate not inventoried, a discrepancy not logged, the wrong receiver or the ship out of reach,
// and approves one that is right; the approved cargo is sent by transporter; and the communications array must be powered.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const GRAIN = '4f2a91c0d35e4b7a9c21e08f6b14d2a7', WINE = '7c13e5b2a9f04d61b8e37c50d2a96f18', ORE = '9a8d0f47c26b4e15a3d98b71e4c05f2d';
const bay = page => page.evaluate(() => CargoBay.state().bay);
async function inspect(page, id) {
  await page.locator(`#crateList [data-crate="${id}"]`).click();
  await page.locator('#viewBody [data-action="inspect"]').click();
}
async function demo(page, act) {
  await page.locator('#menuBtn').click();
  await page.locator('#openDemoControls').click();
  await act();
  await page.locator('#menuDialog [data-close]').last().click();
}
// A switch is tapped on its label, as a person does (the checkbox itself is drawn by the label).
const flip = (page, id) => page.locator('label.switch', { has: page.locator('#' + id) }).click();
async function prepareFor(page, receiver) {
  await page.locator('#prepareBtn').click();
  if (receiver) await page.locator(`#receiverList [data-receiver="${receiver}"]`).click();
  await page.locator('#prepareSave').click();
  await expect(page.locator('#prepareDialog')).toBeHidden();
}
async function transmitAndWait(page) {
  await page.locator('#transmitBtn').click();
  await expect(page.locator('#approvalState')).toHaveText('AWAITING APPROVAL');
  await expect(page.locator('#approvalState')).not.toHaveText('AWAITING APPROVAL', { timeout: 6000 });
}

run({
  'the hold, the orders and the compare view show what differs': async ({ open }) => {
    const page = await open('/CargoBay/');
    await expect(page.locator('.title-pill')).toHaveText('CARGO BAY');
    await expect(page.locator('#crateList .crate')).toHaveCount(4);
    await expect(page.locator('#crateCount')).toHaveText('4');
    await expect(page.locator('#ordersState')).toHaveText('ORDERS · 4 CRATES');
    await expect(page.locator('#viewBody .orders-head h3')).toHaveText('Deliver cargo');
    await expect(page.locator('#viewBody .mcard[data-level="warn"]')).toContainText('Consumer goods');   // ordered, not aboard
    await page.locator('[data-view="compare"]').click();
    await expect(page.locator('#viewNote')).toHaveText('3 DIFFERENCES');
    await expect(page.locator('.compare-summary')).toHaveText(/1 not aboard · 1 not ordered · 1 counts differ/);
    await expect(page.locator(`[data-compare="${GRAIN}"] tr.diff`)).toContainText('Wheat sacks');
    await expect(page.locator(`[data-compare="${GRAIN}"] tr.diff`)).toContainText('40');
    await expect(page.locator(`[data-compare="${GRAIN}"] tr.diff`)).toContainText('42');
    await expect(page.locator('#crateList .crate', { hasText: 'Medical supplies' })).toContainText('NOT ORDERED');
  },
  'inspecting a crate finds what its manifest gets wrong, and the findings are logged and struck out': async ({ open }) => {
    const page = await open('/CargoBay/');
    await inspect(page, WINE);
    await expect(page.locator('#viewBody .compare-summary')).toHaveText(/1 discrepancy found · 1 not logged: Wine cases 12 → 10/);
    await expect(page.locator('#crateList [data-crate="' + WINE + '"]')).toContainText('1 FINDING');
    await page.locator('#viewBody [data-action="log-findings"]').click();
    await expect(page.locator('#logCount')).toHaveText('1');
    await expect(page.locator('#logList .log-entry')).toContainText('Wine cases: 12 → 10');
    await expect(page.locator('#viewBody [data-action="log-findings"]')).toBeDisabled();
    await page.locator('#logList [data-unlog]').click();
    await expect(page.locator('#logCount')).toHaveText('0');
  },
  'a discrepancy of the crew\'s own is logged by hand with a note': async ({ open }) => {
    const page = await open('/CargoBay/');
    await inspect(page, ORE);
    await expect(page.locator('#viewBody .compare-summary')).toHaveText(/matches the crate's manifest/);
    await page.locator('#logBtn').click();
    await page.locator('#logItem').fill('Titanium ingots');
    await page.locator('#logItem').dispatchEvent('input');
    await expect(page.locator('#logStated')).toHaveValue('60');
    await page.locator('#logActual').fill('59');
    await page.locator('#logNote').fill('One ingot cracked');
    await page.locator('#logSave').click();
    await expect(page.locator('#logDialog')).toBeHidden();
    await expect(page.locator('#logList .log-entry')).toContainText('Titanium ingots: 60 → 59');
    await expect(page.locator('#logList .log-entry em')).toHaveText('One ingot cracked');
  },
  'the receiver refuses a crate not inventoried, then a discrepancy not logged, and approves the corrected request': async ({ open }) => {
    const page = await open('/CargoBay/');
    await prepareFor(page);
    await expect(page.locator('#receiverName')).toHaveText('Earth Orbital Station');
    await expect(page.locator('#requestCrates')).toHaveText('3');   // the crates on the orders, not the medical supplies
    await transmitAndWait(page);
    await expect(page.locator('#approvalState')).toHaveText('REQUEST REFUSED');
    await expect(page.locator('#answer')).toContainText('has not been inventoried');
    for (const id of [GRAIN, WINE, ORE]) await inspect(page, id);
    await prepareFor(page);
    await transmitAndWait(page);
    await expect(page.locator('#answer')).toContainText('the discrepancy in crate Luxury goods 7c13e5b2 (Wine cases: manifest 12, counted 10) is not logged');
    await page.locator(`#crateList [data-crate="${WINE}"]`).click();
    await page.locator('#viewBody [data-action="log-findings"]').click();
    await prepareFor(page);
    await expect(page.locator('#requestInventory')).toHaveText('3 OF 3');
    await expect(page.locator('#requestLog')).toHaveText('1');
    await transmitAndWait(page);
    await expect(page.locator('#approvalState')).toHaveText('DELIVERY APPROVED');
    await expect(page.locator('#answer')).toContainText('delivery request approved — 3 crates, 1 discrepancy noted');
    await expect(page.locator('#steps [data-step="approved"]')).toHaveAttribute('data-current', 'true');
    // The approved cargo goes by transporter: the three crates leave and the request is delivered.
    await page.locator('#transporterLink').click();
    await expect(page.locator('#approvalState')).toHaveText('DELIVERED', { timeout: 6000 });
    await expect(page.locator('#crateList .crate')).toHaveCount(1);
    await expect(page.locator('#crateList .crate')).toContainText('Medical supplies');
    await expect(page.locator('#transporterLink')).toBeHidden();
  },
  'the wrong receiver, a ship out of reach and an unpowered array are refused': async ({ open }) => {
    const page = await open('/CargoBay/');
    await prepareFor(page, 'Settlement:terran-space-command');
    await transmitAndWait(page);
    await expect(page.locator('#answer')).toContainText('Terran Space Command to Merlin');
    await expect(page.locator('#answer')).toContainText('is consigned to Earth Orbital Station, not to us');
    await demo(page, () => flip(page, 'shipFar'));
    await prepareFor(page);
    await transmitAndWait(page);
    await expect(page.locator('#answer')).toContainText('not within reach of us; come within 100,000 km');
    await demo(page, () => flip(page, 'commsPowered'));
    await page.locator('#transmitBtn').click();
    await expect(page.locator('#notice')).toHaveText('The communications array is offline: power it to transmit the request.');
    await expect(page.locator('#approvalState')).toHaveText('REQUEST REFUSED');
  },
  'without orders every crate aboard goes on the request, and the demo controls add a crate and reset': async ({ open }) => {
    const page = await open('/CargoBay/');
    await demo(page, async () => {
      await flip(page, 'ordersActive');
      await page.locator('#addCrate').click();
    });
    await expect(page.locator('#ordersState')).toHaveText('ORDERS COMPLETE');
    await expect(page.locator('#crateList .crate')).toHaveCount(5);
    await page.locator('[data-view="compare"]').click();
    await expect(page.locator('#viewNote')).toHaveText('NO ORDERS TO COMPARE');
    await page.locator('#prepareBtn').click();
    await expect(page.locator('#prepareSummary')).toContainText('CRATES5');
    await page.locator('#prepareSave').click();
    await expect(page.locator('#requestCrates')).toHaveText('5');
    await demo(page, () => page.locator('#resetDemo').click());
    const state = await bay(page);
    assert.equal(state.crates.length, 4);
    assert.equal(state.request, null);
    assert.equal(state.orders.status, 'active');
  },
});
