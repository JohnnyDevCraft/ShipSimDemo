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
  'the Range dialog sets the radius at once; the scroll wheel and the zoom keys zoom the map, with no range slider on screen': async ({ open }) => {
    const page = await open('/Helm/');
    await expect(page.locator('#rangeSlider')).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.helmMapRange()), '20.0 LY radius');
    await page.locator('.dock [data-open="rangeDialog"]').click();
    await expect(page.locator('#rangePresets button[aria-pressed="true"]')).toHaveText('20 LY');
    await page.locator('#rangePresets button', { hasText: /^5 LY$/ }).click();
    await expect(page.locator('#rangeDialog')).toBeHidden();
    assert.equal(await page.evaluate(() => window.helmMapRange()), '5.00 LY radius');
    // The scroll wheel zooms in; the "-" key back out.
    const box = await page.locator('#map').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(200);
    const wheeled = await page.evaluate(() => window.helmMapRange());
    assert.notEqual(wheeled, '5.00 LY radius', 'the wheel zoomed the map');
    await page.locator('#map').click({ position: { x: 600, y: 120 }, force: true });
    await page.keyboard.press('-');
    await page.waitForTimeout(100);
    assert.notEqual(await page.evaluate(() => window.helmMapRange()), wheeled, 'the "-" key zoomed out');
    await page.locator('[data-mode="SRS"]').click();
    await page.locator('.dock [data-open="rangeDialog"]').click();
    assert.deepEqual((await page.locator('#rangePresets button').allInnerTexts()).slice(0, 2), ['1 BKM', '100 MKM']);
  },
});
