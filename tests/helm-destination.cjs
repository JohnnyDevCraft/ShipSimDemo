// Helm Control's Selected Target: it shows what the navigation computer holds for our ship, or the helm's
// own course from Course or Plot. Helm aligns to it but never changes navigation's destination.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

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
const heldByNavigation = page => page.evaluate(() => JSON.parse(localStorage.getItem('xmps-demo-navigation')).destinations[NavWorld.ownShip.registry].name);
// Enter a value on a Course or Plot field's keypad.
async function enter(page, dialog, field, keys) {
  await page.locator(`#${dialog} [data-field="${field}"] [data-edit]`).click();
  for (const key of keys) await page.locator(`#${dialog} .keypad-keys button`, { hasText: new RegExp(`^${key.replace('.', '\\.')}$`) }).click();
  await page.locator(`#${dialog} [data-save]`).click();
}

run({
  'helm shows the destination the navigation computer holds': async ({ open }) => {
    const helm = await open('/Helm/');
    await expect(helm.locator('#targetName')).toHaveText('Gliese 1061');
    await expect(helm.locator('#targetKind')).toHaveText('Red Dwarf (M5.5V)');
    await expect(helm.locator('#tBearing')).toHaveText('047.0°');
    await expect(helm.locator('#tTurn')).toHaveText('+47.0°');
    await expect(helm.locator('#tDistance')).toHaveText('12.0 LY');
    const navigation = await otherConsole(open);
    assert.deepEqual(await plotFor(navigation, 'Mars', 0), { ok: true });
    await expect(helm.locator('#targetName')).toHaveText('Mars');
    await expect(helm.locator('#tDistance')).toHaveText(/MKM$/);
  },
  'helm shows the navigation calculation in progress': async ({ open }) => {
    const helm = await open('/Helm/');
    const navigation = await otherConsole(open);
    await plotFor(navigation, 'Mars', 30);
    await expect(helm.locator('#target')).toHaveAttribute('data-state', 'calculating');
    await expect(helm.locator('#targetCalc')).toBeVisible();
    await expect(helm.locator('#alignBtn')).toBeDisabled();
  },
  "a course from the Course keypad becomes the helm's target and leaves navigation's alone": async ({ open }) => {
    const helm = await open('/Helm/');
    await helm.locator('.dock [data-open="courseDialog"]').click();
    await enter(helm, 'courseDialog', 'course', ['3', '0']);
    await expect(helm.locator('#courseDialog [data-field="course"] [data-value]')).toHaveText('30.0°');
    await enter(helm, 'courseDialog', 'distance', ['5']);
    await helm.locator('#courseUnit [data-unit="KM"]').click();
    await expect(helm.locator('#courseDialog [data-field="distance"] [data-value]')).toHaveText('5 KM');
    await helm.locator('#saveCourse').click();
    await expect(helm.locator('#courseDialog')).toBeHidden();
    await expect(helm.locator('#targetTitle')).toHaveText('HELM COURSE');
    await expect(helm.locator('#targetName')).toHaveText('Helm Course');
    await expect(helm.locator('#targetKind')).toHaveText('Course 030.0° · 5 KM');
    await expect(helm.locator('#tBearing')).toHaveText('030.0°');
    await expect(helm.locator('#targetNote')).toHaveText(/Gliese 1061/);
    assert.equal(await heldByNavigation(helm), 'Gliese 1061');
    await helm.locator('#targetMore').click();
    await helm.locator('#returnToDestination').click();
    await expect(helm.locator('#targetName')).toHaveText('Gliese 1061');
  },
  'the keypad checks its value before saving': async ({ open }) => {
    const helm = await open('/Helm/');
    await helm.locator('.dock [data-open="courseDialog"]').click();
    await helm.locator('#courseDialog [data-field="course"] [data-edit]').click();
    for (const key of ['4', '0', '0']) await helm.locator('#courseDialog .keypad-keys button', { hasText: new RegExp(`^${key}$`) }).click();
    await helm.locator('#courseDialog [data-save]').click();
    await expect(helm.locator('#courseDialog .keypad-error')).toHaveText(/−180 to 359\.99/);
    await helm.locator('#courseDialog [data-cancel]').click();
    await expect(helm.locator('#courseDialog [data-field="course"] [data-value]')).toHaveText('47.0°');
  },
  'galactic coordinates from Plot take the navigation computer’s time and become the target': async ({ open }) => {
    const helm = await open('/Helm/');
    const navigation = await otherConsole(open);
    await navigation.evaluate(() => computer.setCalculationSeconds(2));
    await helm.locator('.dock [data-open="plotDialog"]').click();
    await expect(helm.locator('#plotDialog [data-field="localBearing"] [data-edit]')).toBeDisabled();
    await helm.locator('#plotCourse').click();
    await expect(helm.locator('#target')).toHaveAttribute('data-state', 'calculating');
    await expect(helm.locator('#targetName')).toHaveText('Galactic Plot', { timeout: 6000 });
    await expect(helm.locator('#tDistance')).toHaveText(/LY$/);
    assert.equal(await heldByNavigation(helm), 'Gliese 1061');
  },
  'plotting needs the navigation computer online': async ({ open }) => {
    const helm = await open('/Helm/');
    await helm.locator('#menuBtn').click();
    await helm.locator('#openDemoControls').click();
    await helm.locator('#navPower').click();
    await expect(helm.locator('#navStatus')).toHaveText(/offline/);
    await helm.locator('#menuDialog [data-close]').click();
    await helm.locator('.dock [data-open="plotDialog"]').click();
    await expect(helm.locator('#plotCourse')).toBeDisabled();
  },
});
