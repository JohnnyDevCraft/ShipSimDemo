// Helm Control's Selected Destination widget: it shows what the navigation computer holds for our ship
// and can only align to it.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const widget = page => page.locator('.selected-destination');
const part = (page, name) => widget(page).locator(`[data-sd="${name}"]`);

// Stands in for Navigation Control: another page on the same origin using the same navigation computer.
async function otherConsole(open) {
  const page = await open('/index.html');
  await page.addScriptTag({ url: '../Shared/nav-world.js' });
  await page.addScriptTag({ url: '../Shared/nav-computer.js' });
  await page.evaluate(() => { window.computer = NavComputer.connect({ ownRegistry: NavWorld.ownShip.registry }); });
  return page;
}
const plotFor = (page, objectName, seconds) => page.evaluate(([name, calculationSeconds]) => {
  computer.setCalculationSeconds(calculationSeconds);
  return computer.plot(NavWorld.ownShip.registry, NavWorld.destinationForObject(NavWorld.worldObjects().find(object => object.name === name)));
}, [objectName, seconds]);

run({
  "helm's destination widget has Align and nothing else": async ({ open }) => {
    const page = await open('/Helm/');
    assert.deepEqual(await widget(page).locator('button').evaluateAll(buttons => buttons.map(button => button.dataset.sdAction)), ['align']);
    assert.equal(await page.locator('#useMapTarget, #clearDestination').count(), 0);
    assert.deepEqual(await page.locator('.route [data-entry]').allInnerTexts(), ['Course & distance', 'Galactic coordinates']);
  },
  'helm shows the destination the navigation computer holds': async ({ open }) => {
    const helm = await open('/Helm/');
    await expect(part(helm, 'name')).toHaveText('Gliese 1061');
    await expect(part(helm, 'course')).toHaveText('047.0°');
    await expect(part(helm, 'turn')).toHaveText('+47.0°');
    await expect(part(helm, 'distance')).toHaveText(/LR$/);
    const navigation = await otherConsole(open);
    assert.deepEqual(await plotFor(navigation, 'Mars', 0), { ok: true });
    await expect(part(helm, 'name')).toHaveText('Mars');
    await expect(part(helm, 'distance')).toHaveText(/BKM$/);
  },
  'helm shows the navigation calculation in progress': async ({ open }) => {
    const helm = await open('/Helm/');
    const navigation = await otherConsole(open);
    await plotFor(navigation, 'Mars', 30);
    await expect(widget(helm)).toHaveAttribute('data-state', 'calculating');
    await expect(widget(helm).locator('progress')).toBeVisible();
    await expect(widget(helm).locator('[data-sd-action="align"]')).toBeDisabled();
  },
  "a manual course leaves navigation's destination alone": async ({ open }) => {
    const helm = await open('/Helm/');
    await helm.locator('#course').fill('30');
    await helm.locator('#distance').fill('5');
    await helm.locator('#manual').click();
    await expect(helm.locator('#manualResult')).toHaveText(/030\.0°.*5 LR/);
    await expect(part(helm, 'name')).toHaveText('Gliese 1061');
    const held = await helm.evaluate(() => JSON.parse(localStorage.getItem('xmps-demo-navigation')).destinations[NavWorld.ownShip.registry].name);
    assert.equal(held, 'Gliese 1061');
  },
});
