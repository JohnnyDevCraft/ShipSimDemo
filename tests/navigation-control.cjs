// Navigation Control: the system map, the free locator, our ship's destination, the known objects and systems
// lists, and courses plotted for another ship or a body with Plot For.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

// Demo controls live behind the menu.
async function demoControls(page, act) {
  await page.locator('#menuBtn').click();
  await page.locator('#openDemoControls').click();
  await act();
  await page.locator('#menuDialog [data-close]').click();
}
const calculationSeconds = (page, seconds) => demoControls(page, () => page.locator(`#calcSeconds [data-seconds="${seconds}"]`).click());
const knownRow = (page, name) => page.locator('#knownList [data-key]').filter({ has: page.locator('.known-name', { hasText: new RegExp(`^${name}$`) }) });
// Pick an object from the Known Objects dialog: it becomes the map target and the map centres on it.
async function pickKnown(page, name) {
  await page.locator('.dock [data-open="knownDialog"]').click();
  await knownRow(page, name).click();
  await expect(page.locator('#knownDialog')).toBeHidden();
}
// Click an object where the map draws it.
async function clickOnMap(page, key) {
  const at = await page.evaluate(objectKey => NavigationControl.screenOf(objectKey), key);
  assert.ok(at, `${key} is drawn on the map`);
  await page.locator('#map').click({ position: at, force: true });
}
// Centre the map on Mars with a 200,000 km radius, then click empty space up and to the right of it.
async function dropPinNearMars(page) {
  await pickKnown(page, 'Mars');
  await page.evaluate(() => NavigationControl.setRadius(200000));
  const centre = await page.evaluate(() => NavigationControl.screenOf('Sol|Mars'));
  await page.locator('#map').click({ position: { x: centre.x + 90, y: centre.y - 60 }, force: true });
  await expect(page.locator('#mtName')).toHaveText('Free point');
}
// Enter a value on one of the locator's keypads.
async function enter(page, field, keys) {
  await page.locator(`#locatorDialog [data-field="${field}"] [data-edit]`).click();
  for (const key of keys) await page.locator('#locatorDialog .keypad-keys button', { hasText: new RegExp(`^${key}$`) }).click();
  await page.locator('#locatorDialog [data-save]').click();
}

run({
  'setting an object as destination counts down, then shows it': async ({ open }) => {
    const page = await open('/Navigation/');
    await expect(page.locator('#odName')).toHaveText('Gliese 1061');
    await calculationSeconds(page, 2);
    await pickKnown(page, 'Earth');
    await clickOnMap(page, 'Sol|Mars');
    await expect(page.locator('#mtName')).toHaveText('Mars');
    await expect(page.locator('#mtKind')).toHaveText('Terrestrial Planet');
    await page.locator('#setOwn').click();
    await expect(page.locator('#ownDestination')).toHaveAttribute('data-state', 'calculating');
    await expect(page.locator('#odCalc')).toBeVisible();
    await expect(page.locator('#odName')).toHaveText('Mars', { timeout: 6000 });
    await expect(page.locator('#odDistance')).toHaveText(/MKM$/);
  },
  'a destination set on navigation appears on helm, and clearing it empties helm': async ({ open }) => {
    const navigation = await open('/Navigation/'), helm = await open('/Helm/');
    await calculationSeconds(navigation, 0);
    await pickKnown(navigation, 'Mars');
    await navigation.locator('#setOwn').click();
    await expect(helm.locator('#targetName')).toHaveText('Mars');
    await navigation.locator('#clearOwn').click();
    await expect(helm.locator('#targetName')).toHaveText('No target');
    await expect(helm.locator('#alignBtn')).toBeDisabled();
    await expect(navigation.locator('#odName')).toHaveText('No destination');
  },
  'a pin dropped on empty space reads from the nearest object, moves when edited, and can be set': async ({ open }) => {
    const page = await open('/Navigation/');
    await dropPinNearMars(page);
    await expect(page.locator('#mtKind')).toHaveText(/from Mars, bearing 056°/);
    await page.locator('.dock [data-open="locatorDialog"]').click();
    await expect(page.locator('#pinReference')).toHaveText('Mars');
    await expect(page.locator('#locatorDialog [data-field="bearing"] [data-value]')).toHaveText('56.3°');
    const scale = await page.evaluate(() => NavigationControl.scale());
    const shown = parseFloat((await page.locator('#locatorDialog [data-field="distance"] [data-value]').innerText()).replace(/,/g, ''));
    assert.ok(Math.abs(shown - Math.hypot(90, 60) / scale) <= 2, `distance from Mars (${shown})`);
    await enter(page, 'distance', ['5', '2', '0', '0', '0']);
    await enter(page, 'bearing', ['2', '7', '0']);
    const moved = await page.evaluate(() => { const pin = NavigationControl.pinScreen(), mars = NavigationControl.screenOf('Sol|Mars'); return { dx: pin.x - mars.x, dy: pin.y - mars.y, scale: NavigationControl.scale() }; });
    assert.ok(Math.abs(moved.dx + 52000 * moved.scale) < 0.5 && Math.abs(moved.dy) < 0.5, 'pin sits 52,000 km from Mars on bearing 270');
    await expect(page.locator('#locatorDialog [data-field="distance"] [data-value]')).toHaveText('52,000 KM');
    await page.locator('#locatorDialog [data-close]').click();
    await calculationSeconds(page, 0);
    await page.locator('#setOwn').click();
    await expect(page.locator('#odName')).toHaveText('Free point');
    await expect(page.locator('#odNote')).toHaveText(/52,000 KM from Mars, bearing 270/);
    const held = await page.evaluate(() => JSON.parse(localStorage.getItem('xmps-demo-navigation')).destinations[NavWorld.ownShip.registry]);
    assert.equal(held.kind, 'point');
    assert.equal(held.key, undefined);
  },
  'dragging the pin moves it and updates the reading': async ({ open }) => {
    const page = await open('/Navigation/');
    await dropPinNearMars(page);
    const before = await page.locator('#mtKind').innerText();
    const pin = await page.evaluate(() => NavigationControl.pinScreen());
    await page.mouse.move(pin.x, pin.y);
    await page.mouse.down();
    await page.mouse.move(pin.x + 40, pin.y, { steps: 4 });
    await page.mouse.up();
    const after = await page.evaluate(() => NavigationControl.pinScreen());
    // WebKit reports pointer positions in whole pixels, so allow a pixel or two either way.
    assert.ok(Math.abs(after.x - (pin.x + 40)) <= 2 && Math.abs(after.y - pin.y) <= 2, 'the pin followed the pointer');
    await expect(page.locator('#mtKind')).not.toHaveText(before);
    await expect(page.locator('#mtKind')).toHaveText(/from Mars/);
  },
  'a destination is still shown on both consoles after a reload': async ({ open }) => {
    const navigation = await open('/Navigation/'), helm = await open('/Helm/');
    await calculationSeconds(navigation, 0);
    await pickKnown(navigation, 'Mars');
    await navigation.locator('#setOwn').click();
    await expect(navigation.locator('#odName')).toHaveText('Mars');
    await navigation.reload();
    await helm.reload();
    await expect(navigation.locator('#odName')).toHaveText('Mars');
    await expect(helm.locator('#targetName')).toHaveText('Mars');
  },
  'the locator warns when the pin is inside a body or too close to it': async ({ open }) => {
    const page = await open('/Navigation/');
    await dropPinNearMars(page);
    await expect(page.locator('#mtWarning')).toBeHidden();
    await page.locator('.dock [data-open="locatorDialog"]').click();
    await page.locator('#pinUnit [data-unit="KM"]').click();
    await enter(page, 'distance', ['1', '0', '0', '0']);
    await expect(page.locator('#locatorWarning')).toHaveText(/inside Mars/i);
    await enter(page, 'distance', ['2', '0', '0', '0', '0']);
    await expect(page.locator('#locatorWarning')).toHaveText(/safety boundary/i);
    await page.locator('#locatorDialog [data-close]').click();
    await expect(page.locator('#mtWarning')).toHaveText(/safety boundary/i);
  },
  'a pin can be dropped at the map centre and removed from the locator': async ({ open }) => {
    const page = await open('/Navigation/');
    await page.locator('.dock [data-open="locatorDialog"]').click();
    await expect(page.locator('#locatorState')).toHaveText('NO PIN');
    await expect(page.locator('#locatorDialog [data-field="distance"] [data-edit]')).toBeDisabled();
    await page.locator('#dropPin').click();
    await expect(page.locator('#locatorState')).toHaveText('PIN IS MAP TARGET');
    await expect(page.locator('#pinReference')).not.toHaveText('—');
    await page.locator('#pinClear').click();
    await expect(page.locator('#locatorState')).toHaveText('NO PIN');
    await page.locator('#locatorDialog [data-close]').click();
    await expect(page.locator('#mtName')).toHaveText('No target');
  },
  'unpowered, the destination still shows and cannot be changed': async ({ open }) => {
    const page = await open('/Navigation/');
    await pickKnown(page, 'Mars');
    await expect(page.locator('#setOwn')).toBeEnabled();
    await demoControls(page, () => page.locator('#demoNavigationPower').click());
    await expect(page.locator('#state')).toHaveText('OFFLINE');
    await expect(page.locator('#mapBlank')).toBeVisible();
    await expect(page.locator('#odName')).toHaveText('Gliese 1061');
    await expect(page.locator('#setOwn')).toBeDisabled();
    await expect(page.locator('#clearOwn')).toBeDisabled();
    await expect(page.locator('#plotForBtn')).toBeDisabled();
    await demoControls(page, () => page.locator('#demoNavigationPower').click());
    await expect(page.locator('#clearOwn')).toBeEnabled();
    await expect(page.locator('#mapBlank')).toBeHidden();
  },
  'the known objects list hides what the computer does not know': async ({ open }) => {
    const page = await open('/Navigation/');
    await page.locator('.dock [data-open="knownDialog"]').click();
    const names = await page.locator('#knownList .known-name').allInnerTexts();
    for (const known of ['Wasp One', 'Neptune', 'Survey Buoy 7', 'TNS Endeavor', 'Gliese 1061', 'Sirius']) assert.ok(names.includes(known), `${known} is listed`);
    for (const hidden of ['MV Corbin Trader', 'Listening Post Argus', 'TNS Meridian', 'TNS Horizon', 'Alpha Centauri I']) assert.ok(!names.includes(hidden), `${hidden} is not listed`);
    await expect(page.locator('#knownCount')).toHaveText(`${names.length} KNOWN`);
    // Each card is tall enough for its text, and the cards do not overlap.
    const cards = await page.locator('#knownList [data-key]').evaluateAll(buttons => buttons.map(button => { const box = button.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, text: Math.max(...[...button.children].map(child => child.getBoundingClientRect().bottom)) }; }));
    cards.forEach((card, index) => {
      assert.ok(card.text <= card.bottom - 4, `card ${index} holds its text`);
      if (index) assert.ok(cards[index - 1].bottom <= card.top, `card ${index} sits below the one before`);
    });
    // The filter keeps the title and itself in place; only the list scrolls, and it shows no scroll bar.
    // A physical keyboard still types into the box; Enter closes the in-app keyboard.
    await page.locator('#knownSearch').fill('wasp');
    await page.locator('#knownSearch').press('Enter');
    await expect(page.locator('#knownList')).toBeVisible();
    await expect(page.locator('#knownList .known-name')).toHaveCount(2);
    assert.deepEqual((await page.locator('#knownList .known-name').allInnerTexts()).sort(), ['Wasp One', 'Wasp Two']);
    await expect(page.locator('#knownCount')).toHaveText(`2 OF ${names.length}`);
    await page.locator('#knownSearch').click();
    await page.locator('#knownDialog .search-keys').getByRole('button', { name: 'Clear the search' }).click();
    await expect(page.locator('#knownSearch')).toHaveValue('');
    await page.locator('#knownSearch').fill('no such thing');
    await page.locator('#knownSearch').press('Enter');
    await expect(page.locator('#knownList')).toHaveText('Nothing known matches that filter.');
    const list = await page.locator('#knownList').evaluate(element => ({ overflow: getComputedStyle(element).overflowY, bar: getComputedStyle(element).scrollbarWidth, gutter: element.offsetWidth - element.clientWidth }));
    assert.deepEqual(list, { overflow: 'auto', bar: 'none', gutter: 0 });
    await page.locator('#knownDialog [data-close]').click();
    await page.evaluate(() => NavigationControl.setRadius(6e9));
    const drawn = await page.evaluate(() => NavigationControl.contacts().map(contact => contact.name));
    assert.ok(drawn.includes('Neptune') && !drawn.includes('TNS Meridian') && !drawn.includes('MV Corbin Trader'), 'the map draws known objects only');
  },
  'the System dialog shows another system on the map': async ({ open }) => {
    const page = await open('/Navigation/');
    await expect(page.locator('#currentSystem')).toHaveText('Sol System');
    await page.locator('#systemBtn').click();
    await expect(page.locator('#systemList [data-system]')).toHaveCount(8);
    // Tapping the search box swaps the cards for the in-app keyboard; the system keyboard is not asked for.
    const keys = page.locator('#systemDialog .search-keys');
    await expect(page.locator('#systemSearch')).toHaveAttribute('inputmode', 'none');
    await page.locator('#systemSearch').click();
    await expect(page.locator('#systemList')).toBeHidden();
    await expect(keys).toBeVisible();
    for (const key of ['S', 'I', 'R', 'X']) await keys.locator(`[data-key="${key}"]`).click();
    await expect(page.locator('#systemSearch')).toHaveValue('sirx');
    await expect(keys.locator('.search-status')).toHaveText('0 MATCHES');
    await keys.getByRole('button', { name: 'Backspace' }).click();
    await expect(page.locator('#systemSearch')).toHaveValue('sir');
    await expect(keys.locator('.search-status')).toHaveText('1 MATCH');
    await keys.getByRole('button', { name: 'Done' }).click();
    await expect(keys).toBeHidden();
    await expect(page.locator('#systemList [data-system]')).toHaveCount(1);
    await page.locator('#systemList [data-system="Sirius"]').click();
    await expect(page.locator('#systemDialog')).toBeHidden();
    await expect(page.locator('#currentSystem')).toHaveText('Sirius System');
    await page.locator('.dock #centerShip').click();
    await expect(page.locator('#currentSystem')).toHaveText('Sol System');
  },
  'Plot For a fighter: the computer plots its course, which is read out and never becomes our own': async ({ open }) => {
    const page = await open('/Navigation/');
    await calculationSeconds(page, 2);
    await expect(page.locator('#plotForName')).toHaveText('TNS Vigilant (us)');
    await expect(page.locator('#plotForBtn')).toBeDisabled();
    await pickKnown(page, 'Wasp One');
    await page.locator('#plotForBtn').click();
    await expect(page.locator('#plotForBtn')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#plotForName')).toHaveText('Wasp One');
    await expect(page.locator('#mtName')).toHaveText('No target');
    await pickKnown(page, 'Earth');
    // Until the computer has plotted it, the card has no figures for another ship.
    await expect(page.locator('#mtCourse')).toHaveText('—');
    await page.locator('#setOwn').click();
    await expect(page.locator('#mtCourse')).toHaveText('CALCULATING…');
    await expect(page.locator('#plottedCalc')).toBeVisible();
    const plot = await page.evaluate(() => {
      const objects = NavWorld.worldObjects(), fighter = objects.find(object => object.name === 'Wasp One'), earth = objects.find(object => object.name === 'Earth');
      const result = NavWorld.plotCourse({ x: fighter.x, y: fighter.y, bearing: fighter.heading }, NavWorld.resolve(NavWorld.destinationForObject(earth)));
      return { course: NavWorld.courseLabel(result.course), turn: NavWorld.turnLabel(result.turn) };
    });
    await expect(page.locator('#mtCourse')).toHaveText(plot.course, { timeout: 6000 });
    await expect(page.locator('#mtTurn')).toHaveText(plot.turn);
    await expect(page.locator('#mtDistance')).toHaveText(/BKM$/);
    await expect(page.locator('#readout')).toHaveText(/^Wasp One: come (port|starboard) [\d.]+° to course [\d.]+°, jump [\d.,]+ BKM to Earth\.$/);
    await expect(page.locator('#odName')).toHaveText('Gliese 1061');
    const held = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('xmps-demo-navigation')).destinations).sort());
    assert.deepEqual(held, ['TF-101', 'TN-0417']);
    await page.locator('#plottedClear').click();
    await expect(page.locator('#plotted')).toBeHidden();
    await page.locator('#plotForClear').click();
    await expect(page.locator('#plotForName')).toHaveText('TNS Vigilant (us)');
    await expect(page.locator('#mtCourseLabel')).toHaveText('COURSE FROM US');
  },
  'Plot For a planet: a course from Neptune to Saturn has a course and distance but no turn': async ({ open }) => {
    const page = await open('/Navigation/');
    await calculationSeconds(page, 0);
    await pickKnown(page, 'Neptune');
    await page.locator('#plotForBtn').click();
    await pickKnown(page, 'Saturn');
    await page.locator('#setOwn').click();
    await expect(page.locator('#plottedTitle')).toHaveText('PLOTTED COURSE');
    await expect(page.locator('#readout')).toHaveText(/^From Neptune: course [\d.]+°, [\d.,]+ BKM to Saturn\.$/);
    await expect(page.locator('#mtTurn')).toHaveText('—');
    await expect(page.locator('#mtDistance')).toHaveText(/BKM$/);
    await expect(page.locator('#odName')).toHaveText('Gliese 1061');
    // With nothing new targeted, Plot For goes back to our ship.
    await page.locator('#clearTarget').click();
    await page.locator('#plotForBtn').click();
    await expect(page.locator('#plotForName')).toHaveText('TNS Vigilant (us)');
  },
  'holding a control does not select text': async ({ open }) => {
    const page = await open('/Navigation/');
    const select = await page.locator('.dock [data-open="knownDialog"]').evaluate(button => { const computed = getComputedStyle(button); return computed.webkitUserSelect || computed.userSelect; });
    assert.equal(select, 'none');
  },
});
