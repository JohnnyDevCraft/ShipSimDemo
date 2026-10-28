// Helm Control scanner maps: LRS and SRS fill the window; the system map belongs to Navigation Control.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

async function selectsShip(open, mode, shipName) {
  const page = await open('/Helm/');
  await page.locator(`[data-mode="${mode}"]`).click();
  if (mode === 'SRS') await page.evaluate(() => setZoom(zoomFor(rangeScales.SRS, 100)));
  await page.waitForTimeout(200);
  const contact = await page.evaluate(name => mapContacts.find(c => c.name === name), shipName);
  assert.ok(contact, `${mode} renders ${shipName}`);
  await page.locator('#map').click({ position: { x: contact.x, y: contact.y }, force: true });
  await expect(page.locator('#contactChip')).toContainText(shipName);
}

run({
  'helm offers LRS and SRS maps and no system map': async ({ open }) => {
    const page = await open('/Helm/');
    assert.deepEqual(await page.locator('[data-mode]').allInnerTexts(), ['LRS', 'SRS']);
  },
  'the long range scan shows and selects ships': ({ open }) => selectsShip(open, 'LRS', 'TNS Horizon'),
  'the short range scan shows and selects ships': ({ open }) => selectsShip(open, 'SRS', 'TNS Endeavor'),
  'the long range scan labels nearby stars with their distance': async ({ open }) => {
    const page = await open('/Helm/');
    await page.waitForTimeout(200);
    const stars = await page.evaluate(() => mapContacts.filter(contact => contact.world.kind === 'star' && contact.labelBox).map(contact => contact.name));
    for (const star of ['Gliese 1061', 'Ross 128', 'Tau Ceti', 'Sirius', 'Wolf 359', "Barnard's Star"]) assert.ok(stars.includes(star), `${star} is labelled`);
  },
  'the Range dialog sets the radius at once, and the range slider follows': async ({ open }) => {
    const page = await open('/Helm/');
    await expect(page.locator('#rangeSlider')).toHaveAttribute('aria-valuetext', '20.0 LY radius');
    await page.locator('.dock [data-open="rangeDialog"]').click();
    await expect(page.locator('#rangePresets button[aria-pressed="true"]')).toHaveText('20 LY');
    await page.locator('#rangePresets button', { hasText: /^5 LY$/ }).click();
    await expect(page.locator('#rangeDialog')).toBeHidden();
    await expect(page.locator('#rangeSlider')).toHaveAttribute('aria-valuetext', '5.00 LY radius');
    await page.locator('[data-mode="SRS"]').click();
    await page.locator('.dock [data-open="rangeDialog"]').click();
    assert.deepEqual((await page.locator('#rangePresets button').allInnerTexts()).slice(0, 2), ['1 BKM', '100 MKM']);
  },
});
