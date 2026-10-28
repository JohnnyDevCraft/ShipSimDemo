// Navigation Control: the system map, the free locator, our ship's destination, the known objects list
// and courses plotted for another ship.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const own = page => page.locator('#ownDestination');
const other = page => page.locator('#otherDestination');
const part = (widget, name) => widget.locator(`[data-sd="${name}"]`);
const action = (widget, name) => widget.locator(`[data-sd-action="${name}"]`);
// The known objects list is behind its tab; pick a row there and return to course control.
const pickKnown = async (page, name) => {
  await page.locator('#tabKnown').click();
  await knownRow(page, name).click();
  await page.locator('#tabCourse').click();
};
const calculationSeconds = async (page, seconds) => { await page.locator('#calculationSeconds').fill(String(seconds)); await page.locator('#calculationSeconds').blur(); };
const knownRow = (page, name) => page.locator('#knownList [data-key]').filter({ has: page.locator('.known-name', { hasText: new RegExp(`^${name}$`) }) });
// Click an object where the map draws it.
async function clickOnMap(page, key) {
  const at = await page.evaluate(objectKey => NavigationControl.screenOf(objectKey), key);
  assert.ok(at, `${key} is drawn on the map`);
  await page.locator('#map').click({ position: at });
}
// Centre the map on Mars with a 200,000 km radius, then click empty space up and to the right of it.
async function dropPinNearMars(page) {
  await pickKnown(page, 'Mars');
  await page.evaluate(() => NavigationControl.setRadius(200000));
  const centre = await page.evaluate(() => NavigationControl.screenOf('Sol|Mars'));
  await page.locator('#map').click({ position: { x: centre.x + 60, y: centre.y - 40 } });
}

run({
  'setting an object as destination counts down, then shows it': async ({ open }) => {
    const page = await open('/Navigation/');
    await expect(part(own(page), 'name')).toHaveText('Gliese 1061');
    await calculationSeconds(page, 2);
    await clickOnMap(page, 'Sol|Mars');
    await expect(page.locator('#mapSelection')).toContainText('Mars');
    await action(own(page), 'set').click();
    await expect(own(page)).toHaveAttribute('data-state', 'calculating');
    await expect(part(own(page), 'name')).toHaveText('Mars', { timeout: 6000 });
    await expect(part(own(page), 'distance')).toHaveText(/BKM$/);
    assert.deepEqual(await own(page).locator('button').evaluateAll(buttons => buttons.map(button => button.dataset.sdAction)), ['set', 'clear']);
  },
  'a destination set on navigation appears on helm, and clearing it empties helm': async ({ open }) => {
    const navigation = await open('/Navigation/'), helm = await open('/Helm/');
    const helmName = helm.locator('#targetName');
    await calculationSeconds(navigation, 0);
    await pickKnown(navigation, 'Mars');
    await action(own(navigation), 'set').click();
    await expect(helmName).toHaveText('Mars');
    await action(own(navigation), 'clear').click();
    await expect(helmName).toHaveText('No target');
    await expect(helm.locator('#alignBtn')).toBeDisabled();
  },
  'a pin dropped on empty space reads from the nearest object, moves when edited, and can be set': async ({ open }) => {
    const page = await open('/Navigation/');
    await dropPinNearMars(page);
    const scale = await page.evaluate(() => NavigationControl.scale());
    const expected = Math.round(Math.hypot(60, 40) / scale);
    await expect(page.locator('#pinReference')).toHaveText('Mars');
    assert.ok(Math.abs(Number(await page.locator('#pinDistance').inputValue()) - expected) <= 1, 'distance from Mars');
    assert.equal(await page.locator('#pinBearing').inputValue(), '56.3');
    await page.locator('#pinDistance').fill('52000');
    await page.locator('#pinBearing').fill('270');
    await page.locator('#pinBearing').blur();
    const moved = await page.evaluate(() => { const pin = NavigationControl.pinScreen(), mars = NavigationControl.screenOf('Sol|Mars'); return { dx: pin.x - mars.x, dy: pin.y - mars.y, scale: NavigationControl.scale() }; });
    assert.ok(Math.abs(moved.dx + 52000 * moved.scale) < 0.5 && Math.abs(moved.dy) < 0.5, 'pin sits 52,000 km from Mars on bearing 270');
    await calculationSeconds(page, 0);
    await action(own(page), 'set').click();
    await expect(part(own(page), 'name')).toHaveText('Free point');
    await expect(part(own(page), 'note')).toHaveText(/52,000 KM from Mars, bearing 270/);
    const held = await page.evaluate(() => JSON.parse(localStorage.getItem('xmps-demo-navigation')).destinations[NavWorld.ownShip.registry]);
    assert.equal(held.kind, 'point');
    assert.equal(held.key, undefined);
  },
  'dragging the pin moves it and updates the reading': async ({ open }) => {
    const page = await open('/Navigation/');
    await dropPinNearMars(page);
    const before = Number(await page.locator('#pinDistance').inputValue());
    const box = await page.locator('#map').boundingBox(), pin = await page.evaluate(() => NavigationControl.pinScreen());
    await page.mouse.move(box.x + pin.x, box.y + pin.y);
    await page.mouse.down();
    await page.mouse.move(box.x + pin.x + 40, box.y + pin.y, { steps: 4 });
    await page.mouse.up();
    const after = await page.evaluate(() => NavigationControl.pinScreen());
    // WebKit reports the canvas box in whole pixels, so allow the pointer a pixel either way.
    assert.ok(Math.abs(after.x - (pin.x + 40)) <= 2 && Math.abs(after.y - pin.y) <= 2, 'the pin followed the pointer');
    assert.ok(Number(await page.locator('#pinDistance').inputValue()) > before, 'the reading moved with it');
    await expect(page.locator('#pinReference')).toHaveText('Mars');
  },
  'a destination is still shown on both consoles after a reload': async ({ open }) => {
    const navigation = await open('/Navigation/'), helm = await open('/Helm/');
    await calculationSeconds(navigation, 0);
    await pickKnown(navigation, 'Mars');
    await action(own(navigation), 'set').click();
    await expect(part(own(navigation), 'name')).toHaveText('Mars');
    await navigation.reload();
    await helm.reload();
    await expect(part(own(navigation), 'name')).toHaveText('Mars');
    await expect(helm.locator('#targetName')).toHaveText('Mars');
  },
  'the locator warns when the pin is inside a body': async ({ open }) => {
    const page = await open('/Navigation/');
    await dropPinNearMars(page);
    await expect(page.locator('#locatorWarning')).toBeHidden();
    await page.locator('#pinDistance').fill('1000');
    await page.locator('#pinDistance').blur();
    await expect(page.locator('#locatorWarning')).toHaveText(/inside Mars/i);
    await page.locator('#pinDistance').fill('20000');
    await page.locator('#pinDistance').blur();
    await expect(page.locator('#locatorWarning')).toHaveText(/safety boundary/i);
  },
  'unpowered, the destination still shows and cannot be changed': async ({ open }) => {
    const page = await open('/Navigation/');
    await pickKnown(page, 'Mars');
    await expect(action(own(page), 'set')).toBeEnabled();
    await page.locator('#demoNavigationPower').click();
    await expect(page.locator('#state')).toHaveText('OFFLINE');
    await expect(part(own(page), 'name')).toHaveText('Gliese 1061');
    await expect(action(own(page), 'set')).toBeDisabled();
    await expect(action(own(page), 'clear')).toBeDisabled();
    await expect(action(other(page), 'set')).toBeDisabled();
    await page.locator('#demoNavigationPower').click();
    await expect(action(own(page), 'clear')).toBeEnabled();
  },
  'the side panel shows course control or the known objects, one tab at a time': async ({ open }) => {
    const page = await open('/Navigation/');
    await expect(page.locator('#pinDistance')).toBeVisible();
    await expect(page.locator('#otherShip')).toBeVisible();
    await expect(page.locator('#knownList')).toBeHidden();
    await page.locator('#tabKnown').click();
    await expect(page.locator('#knownList')).toBeVisible();
    await expect(page.locator('#pinDistance')).toBeHidden();
    await expect(page.locator('#otherShip')).toBeHidden();
    await page.locator('#tabCourse').click();
    await expect(page.locator('#pinDistance')).toBeVisible();
  },
  'the known objects list hides what the computer does not know': async ({ open }) => {
    const page = await open('/Navigation/');
    await page.locator('#tabKnown').click();
    const names = await page.locator('#knownList .known-name').allInnerTexts();
    for (const known of ['Wasp One', 'Neptune', 'Survey Buoy 7', 'TNS Endeavor', 'Gliese 1061']) assert.ok(names.includes(known), `${known} is listed`);
    for (const hidden of ['MV Corbin Trader', 'Listening Post Argus', 'TNS Meridian', 'TNS Horizon', 'Alpha Centauri I']) assert.ok(!names.includes(hidden), `${hidden} is not listed`);
    await page.evaluate(() => NavigationControl.setRadius(6e9));
    const drawn = await page.evaluate(() => NavigationControl.contacts().map(contact => contact.name));
    assert.ok(drawn.includes('Neptune') && !drawn.includes('TNS Meridian') && !drawn.includes('MV Corbin Trader'), 'the map draws known objects only');
  },
  'a course plotted for a fighter shows course, turn and jump distance beside our own': async ({ open }) => {
    const page = await open('/Navigation/');
    await calculationSeconds(page, 0);
    await page.locator('#otherShip').selectOption({ label: 'Wasp One · TF-101' });
    await pickKnown(page, 'Earth');
    await action(other(page), 'set').click();
    await expect(part(other(page), 'name')).toHaveText('Earth');
    const plot = await page.evaluate(() => {
      const objects = NavWorld.worldObjects(), fighter = objects.find(object => object.name === 'Wasp One'), earth = objects.find(object => object.name === 'Earth');
      const result = NavWorld.plotCourse({ x: fighter.x, y: fighter.y, bearing: fighter.heading }, NavWorld.resolve(NavWorld.destinationForObject(earth)));
      return { course: NavWorld.courseLabel(result.course), turn: NavWorld.turnLabel(result.turn) };
    });
    await expect(part(other(page), 'course')).toHaveText(plot.course);
    await expect(part(other(page), 'turn')).toHaveText(plot.turn);
    await expect(part(other(page), 'distance')).toHaveText(/BKM$/);
    await expect(page.locator('#readout')).toHaveText(/^Wasp One: come (port|starboard) [\d.]+° to course [\d.]+°, jump [\d.,]+ BKM\.$/);
    await expect(part(own(page), 'name')).toHaveText('Gliese 1061');
    const held = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('xmps-demo-navigation')).destinations).sort());
    assert.deepEqual(held, ['TF-101', 'TN-0417']);
  },
});
