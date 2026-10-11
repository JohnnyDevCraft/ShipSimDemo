// Helm Control scanner maps: the helm has LRS and SRS; the system map belongs to Navigation Control.
const assert = require('node:assert/strict');
const { run } = require('./browser-harness.cjs');

async function selectsShip(open, mode, shipName) {
  const page = await open('/Helm/');
  await page.locator(`[data-mode="${mode}"]`).click();
  if (mode === 'SRS') await page.evaluate(() => { $('zoom').value = 100 * Math.log(100 / srsMaxRange) / Math.log(1 / srsMaxRange); draw(); });
  const contact = await page.evaluate(name => mapContacts.find(c => c.name === name), shipName);
  assert.ok(contact, `${mode} renders ${shipName}`);
  await page.locator('#map').click({ position: { x: contact.x, y: contact.y } });
  assert.match(await page.locator('#mapSelection').innerText(), new RegExp(shipName));
}

run({
  'helm offers LRS and SRS maps and no system map': async ({ open }) => {
    const page = await open('/Helm/');
    assert.deepEqual(await page.locator('[data-mode]').allInnerTexts(), ['LRS', 'SRS']);
  },
  'the long range scan shows and selects ships': ({ open }) => selectsShip(open, 'LRS', 'TNS Horizon'),
  'the short range scan shows and selects ships': ({ open }) => selectsShip(open, 'SRS', 'TNS Endeavor'),
});
