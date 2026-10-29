// Communications Control: the full-window signal map, detected transmissions and the selected one, the standard
// frequencies overlay, communications (setup, chat, ending), contact and view screen settings, and the demo controls.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const state = page => page.evaluate(() => CommsControl.state());
async function demo(page, act) {
  await page.locator('#menuBtn').click();
  await page.locator('#openDemoControls').click();
  await act();
  if (await page.locator('#menuDialog').isVisible()) await page.locator('#menuDialog [data-close]').last().click();
}
async function keypadEnter(scope, text) {
  await scope.getByRole('button', { name: 'Clear' }).click();
  for (const key of text) await scope.getByRole('button', { name: key, exact: true }).click();
  await scope.locator('[data-save]').click();
}
const typeKeys = async (page, dialog, text) => {
  for (const key of text) await page.locator(`${dialog} .search-keys [data-key="${key === ' ' ? 'SPACE' : key}"]`).first().click();
};

run({
  'the signal map fills the window and the detections are listed beside it': async ({ open }) => {
    const page = await open('/Communications/');
    const map = await page.locator('#map').boundingBox(), size = page.viewportSize();
    assert.deepEqual([map.x, map.y, map.width, map.height], [0, 0, size.width, size.height]);
    await expect(page.locator('#txCount')).toHaveText('7');
    await expect(page.locator('#transmissions .tx')).toHaveCount(7);
    await page.locator('[data-filter="RF"]').click();
    await expect(page.locator('#transmissions .tx')).toHaveCount(3);
    for (const card of await page.locator('#transmissions .tx').all()) await expect(card).toHaveAttribute('data-medium', 'RF');
    await page.locator('[data-filter="Subspace"]').click();
    await expect(page.locator('#transmissions .tx')).toHaveCount(4);
    await expect(page.locator('#gridScale')).toHaveText(/^GRID \d/);
  },
  'a point-to-point transmission is drawn between the origin and destination its card names': async ({ open }) => {
    const page = await open('/Communications/');
    const rows = (await state(page)).rows, find = origin => rows.find(r => r.origin === origin);
    // Ross Orbital Station to TNS Discovery: from the station itself to our ship.
    const traffic = find('Ross Orbital Station');
    const ends = await page.evaluate(id => CommsControl.ends(id), traffic.id);
    assert.deepEqual(ends.a, await page.evaluate(() => CommsControl.place('Ross Orbital Station')), 'the origin is the station');
    assert.deepEqual(ends.b, await page.evaluate(() => CommsControl.place('TNS Discovery')), 'the destination is our ship');
    // A named ship off the chart sits in the system its detection gives; an unresolved destination is not drawn.
    const fleet = await page.evaluate(id => CommsControl.ends(id), find('Space Command').id);
    const centauri = await page.evaluate(() => CommsControl.place('Alpha Centauri Orbital Station'));
    assert.ok(Math.hypot(fleet.b.x - centauri.x, fleet.b.y - centauri.y) < 1e8, 'Patrol ship Resolute is at Alpha Centauri');
    assert.equal((await page.evaluate(id => CommsControl.ends(id), find('Unidentified vessel').id)).b, null);
    // On the map, the selection names the end that was tapped.
    await page.locator('#transmissions .tx', { hasText: 'Ross Orbital Station' }).click();
    await expect(page.locator('#advisory')).toHaveText(/^Ross Orbital Station · /);
    await expect(page.locator('#transmissions .tx.selected small').first()).toHaveText('Ross · 18.0 SSC · to TNS Discovery');
  },
  'selecting a transmission shows it on the right; encrypted content stays hidden': async ({ open }) => {
    const page = await open('/Communications/');
    await expect(page.locator('#sigTitle')).toHaveText('Civil distress call');
    await page.locator('#transmissions .tx', { hasText: 'Space Command' }).click();
    await expect(page.locator('#sigTitle')).toHaveText('Encrypted fleet traffic');
    await expect(page.locator('#sigSecurity')).toHaveText('ENCRYPTED');
    await expect(page.locator('#sigOtherLabel')).toHaveText('DESTINATION');
    await expect(page.locator('#sigOther')).toHaveText('Patrol ship Resolute');
    await expect(page.locator('#sigContent')).toHaveText('Encrypted transmission. Message content unavailable.');
    await expect(page.locator('#advisory')).toHaveText(/^Space Command · Galactic/);
    await page.locator('#transmissions .tx.selected').click();
    await expect(page.locator('#signalPanel')).toBeHidden();
    await expect(page.locator('#noSignal')).toBeVisible();
  },
  'on the map: tap a transmission or a body, zoom on the right, and the list follows the map': async ({ open }) => {
    const page = await open('/Communications/');
    await page.locator('#transmissions .tx.selected').click();
    // At 30 LY Sol's traffic sits on top of it, and a tap picks a transmission first; closer in, Sol stands alone.
    await page.evaluate(() => CommsControl.set({ center: { x: 1031975.97, y: 2443.67 }, range: 1e9 }));
    const sol = await page.evaluate(() => CommsControl.screenPoint('sol'));
    await page.mouse.click(sol.x, sol.y);
    await expect(page.locator('#advisory')).toHaveText(/^Sol · Galactic/);
    // Zoom in on Ross: only Ross traffic is still on the map, and so in the list.
    const ross = await page.evaluate(() => CommsControl.anchor('Ross'));
    await page.evaluate(center => CommsControl.set({ center, range: 3e8 }), { x: ross.x, y: ross.y });
    await expect(page.locator('#rangeValue')).toHaveText('300 MKM');
    await expect(page.locator('#transmissions .tx')).toHaveCount(3);
    const first = (await state(page)).visible[0];
    const point = await page.evaluate(id => CommsControl.screenPoint(id), first);
    await page.mouse.click(point.x, point.y);
    assert.equal((await state(page)).selected, first, 'tapping its origin selects the transmission');
    await expect(page.locator('#transmissions .tx.selected')).toHaveCount(1);
    await page.locator('#homeBtn').click();
    await expect(page.locator('#rangeValue')).toHaveText('30 LY');
    await page.locator('#rangeSlider').focus();
    await page.keyboard.press('Home');
    await expect(page.locator('#rangeValue')).toHaveText('100 KM');
    await page.locator('#ourShipBtn').click();
    await expect(page.locator('#advisory')).toHaveText(/^TNS Discovery/);
  },
  'detections drop off after five minutes, and RF beyond the detection range is not heard': async ({ open }) => {
    const page = await open('/Communications/');
    await demo(page, () => page.locator('#detectSample').click());
    await expect(page.locator('#txCount')).toHaveText('8');
    await demo(page, async () => {
      await page.locator('#menuDialog [data-field="rfRange"] [data-edit]').click();
      await keypadEnter(page.locator('#menuDialog .keypad'), '50000');
    });
    await page.locator('[data-filter="RF"]').click();
    await expect(page.locator('#transmissions .tx')).toHaveCount(1);
    await expect(page.locator('#rangeNote')).toHaveText('RF range 50,000 KM · Subspace unlimited');
    await page.evaluate(() => CommsControl.set({ ageAll: 400000 }));
    await expect(page.locator('#txCount')).toHaveText('0');
  },
  'Standard Frequencies is an overlay from the bottom bar: search, medium, and tune to open a communication': async ({ open }) => {
    const page = await open('/Communications/');
    await page.locator('#frequenciesBtn').click();
    await expect(page.locator('#frequencyDialog')).toBeVisible();
    await expect(page.locator('#frequencyCount')).toHaveText('12 FREQUENCIES');
    await expect(page.locator('#frequencyList .frequency.advertised')).toHaveCount(2);
    await page.locator('[data-frequency-medium="RF"]').click();
    await expect(page.locator('#frequencyCount')).toHaveText('10 FREQUENCIES');
    await page.locator('#frequencySearch').click();
    await expect(page.locator('#frequencyList')).toBeHidden();
    await typeKeys(page, '#frequencyDialog', 'EARTH');
    await page.locator('#frequencyDialog .search-keys [data-key="DONE"]').click();
    await expect(page.locator('#frequencyList .frequency')).toHaveCount(4);
    await page.locator('#frequencyList .frequency', { hasText: 'Earth Orbital Station' }).click();
    await expect(page.locator('#frequencyDialog')).toBeHidden();
    await expect(page.locator('#commsDialog')).toBeVisible();
    await expect(page.locator('#recipientInput')).toHaveValue('Earth Orbital Station');
    await expect(page.locator('#channelValue')).toHaveText('229.5 MHz');
    await expect(page.locator('[data-comm-medium="RF"]')).toHaveClass(/active/);
  },
  'a communication: type and channel rules, open a link, chat, and end it': async ({ open }) => {
    const page = await open('/Communications/');
    await page.locator('#transmissions .tx.selected').click();
    await page.locator('#commsBtn').click();
    await expect(page.locator('#commEmpty')).toBeVisible();
    await page.locator('#newComm').click();
    await expect(page.locator('[data-comm-type="Unicast"]')).toHaveClass(/active/);
    await expect(page.locator('#channelValue')).toHaveText('0 · every channel');
    await expect(page.locator('#encryptComm')).toBeDisabled();
    await page.locator('#channelField').click({ force: true });
    await expect(page.locator('#notice')).toHaveText(/Unicast uses channel 0/);
    await page.locator('[data-comm-type="Point to point"]').click();
    await page.locator('#saveComm').click();
    await expect(page.locator('#commStatus')).toHaveText('Multicast and point to point need a channel other than 0.');
    await page.locator('#channelField').click();
    await keypadEnter(page.locator('#commPad'), '33.3');
    await expect(page.locator('#channelValue')).toHaveText('33.3 SSC');
    await page.locator('#encryptRow').click();
    await expect(page.locator('#encryptComm')).toBeChecked();
    await page.locator('#recipientInput').click();
    await typeKeys(page, '#commSetup', 'KEPLER');
    await page.locator('#commSetup .search-keys [data-key="DONE"]').click();
    await expect(page.locator('#commList .comm-item.active b')).toHaveText('KEPLER');
    await page.locator('#saveComm').click();
    await expect(page.locator('#conversation .bubble')).toHaveCount(4);
    await expect(page.locator('#commDetails')).toHaveText('KEPLER · Point to point · Subspace · Channel 33.3 SSC · Encrypted');
    await expect(page.locator('#commsCount')).toHaveText('1');
    await page.locator('#messageInput').click();
    await expect(page.locator('#conversation')).toBeHidden();
    await typeKeys(page, '#commChat', 'ON OUR WAY');
    await page.locator('#commChat .search-keys [data-key="DONE"]').click();
    await page.locator('#sendMessage').click();
    await expect(page.locator('#conversation .bubble')).toHaveCount(5);
    await expect(page.locator('#conversation .bubble.outgoing').last()).toContainText('On our way');
    await page.locator('#endComm').click();
    await expect(page.locator('#commList')).toHaveText('No active communications.');
    await expect(page.locator('#commsCount')).toBeHidden();
  },
  'the overlay switches between keyboard and voice entry, and voice writes what is said into the field': async ({ open, context }) => {
    // A stand-in for the browser's speech recognition; the test speaks with window.say().
    await context.addInitScript(() => {
      class Recognition {
        constructor() { window.recognizer = this; }
        start() { this.started = true; }
        stop() { this.started = false; }
      }
      window.SpeechRecognition = window.webkitSpeechRecognition = Recognition;
      window.say = (text, isFinal = true) => window.recognizer.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal })] });
    });
    const page = await open('/Communications/');
    await page.locator('#contactBtn').click();
    await page.locator('#saveComm').click();
    await expect(page.locator('[data-input-mode="keyboard"]')).toHaveClass(/active/);
    await page.locator('[data-input-mode="voice"]').click();
    await expect(page.locator('[data-input-mode="voice"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#messageInput')).toHaveAttribute('placeholder', 'Tap to speak a hail or reply');
    await page.locator('#messageInput').click();
    await expect(page.locator('#commChat .search-keys')).toBeHidden();
    await expect(page.locator('#commChat .voice-pad')).toBeVisible();
    await expect(page.locator('#conversation')).toBeHidden();
    await expect(page.locator('#commChat .mic')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#commChat .voice-status')).toHaveText('LISTENING · SPEAK YOUR MESSAGE');
    await page.evaluate(() => window.say('requesting', false));
    await expect(page.locator('#commChat .voice-heard')).toHaveText('requesting');
    await page.evaluate(() => window.say('requesting docking clearance'));
    await expect(page.locator('#messageInput')).toHaveValue('requesting docking clearance');
    await expect(page.locator('#commChat .voice-heard')).toHaveText('');
    await page.locator('#commChat .mic').click();
    await expect(page.locator('#commChat .mic')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#commChat [data-voice="done"]').click();
    await expect(page.locator('#conversation')).toBeVisible();
    await page.locator('#sendMessage').click();
    await expect(page.locator('#conversation .bubble.outgoing').last()).toContainText('Requesting docking clearance');
    // The recipient field listens too.
    await page.locator('#newComm').click();
    await page.locator('#recipientInput').click();
    await expect(page.locator('#commSetup .voice-pad')).toBeVisible();
    await expect(page.locator('#setupFields')).toBeHidden();
    await page.evaluate(() => window.say('Ross Orbital Station'));
    await page.locator('#commSetup [data-voice="done"]').click();
    await expect(page.locator('#commList .comm-item.active b')).toHaveText('Ross Orbital Station');
    // Back to the keyboard; the choice is remembered on this device.
    await page.locator('[data-input-mode="keyboard"]').click();
    await page.locator('#recipientInput').click();
    await expect(page.locator('#commSetup .search-keys')).toBeVisible();
    await expect(page.locator('#commSetup .voice-pad')).toBeHidden();
    await page.locator('[data-input-mode="voice"]').click();
    await page.reload();
    await page.locator('#commsBtn').click();
    await expect(page.locator('[data-input-mode="voice"]')).toHaveClass(/active/);
  },
  'without speech recognition, voice entry says so and points to the keyboard': async ({ open, context }) => {
    await context.addInitScript(() => {
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;
    });
    const page = await open('/Communications/');
    await page.locator('#contactBtn').click();
    await page.locator('#saveComm').click();
    await page.locator('[data-input-mode="voice"]').click();
    await page.locator('#messageInput').click();
    await expect(page.locator('#commChat .voice-status')).toHaveText('Voice transcription is not available in this browser. Switch to the keyboard.');
    await expect(page.locator('#commChat .mic')).toBeDisabled();
  },
  'Contact Origin opens a communication on the transmission’s return channel': async ({ open }) => {
    const page = await open('/Communications/');
    await page.locator('#contactBtn').click();
    await expect(page.locator('#commsDialog')).toBeVisible();
    await expect(page.locator('#recipientInput')).toHaveValue('Cargo ship Meridian');
    await expect(page.locator('#channelValue')).toHaveText('51.0 SSC');
    await expect(page.locator('[data-comm-type="Point to point"]')).toHaveClass(/active/);
    const comm = (await state(page)).communications[0];
    assert.equal(comm.messages[0].text, 'Civil distress. Propulsion offline. Requesting assistance from nearby vessels.');
  },
  'contact settings set our channel and broadcast; view screen settings are kept for the session': async ({ open }) => {
    const page = await open('/Communications/');
    await expect(page.locator('#state')).toHaveText('BROADCAST 42.7 SSC');
    await page.locator('#contactSettingsBtn').click();
    await page.locator('#contactDialog [data-edit]').click();
    await keypadEnter(page.locator('#contactDialog .keypad'), '33.5');
    await expect(page.locator('#state')).toHaveText('BROADCAST 33.5 SSC');
    await page.locator('#broadcastToggle').click();
    await expect(page.locator('#broadcastToggle')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#state')).toHaveText('LISTENING');
    await page.locator('#contactDialog [data-close]').click();
    await page.locator('#viewScreenBtn').click();
    await page.locator('[data-view-mode="dual"]').click();
    await page.locator('#srsRanges button', { hasText: '100 km' }).click();
    await page.locator('#labelsFilters button', { hasText: 'Ships' }).click();
    const view = (await state(page)).viewScreen;
    assert.equal(view.mode, 'dual');
    assert.equal(view.srs, '100-km');
    assert.equal(view.labels.ships, false);
    await expect(page.locator('#viewScreenStatus')).toHaveText('View screen settings updated for this preview.');
  },
});
