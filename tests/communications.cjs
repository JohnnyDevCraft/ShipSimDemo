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
    // The seven sample detections and three network messages heard before the console opened.
    await expect(page.locator('#txCount')).toHaveText('10');
    await expect(page.locator('#transmissions .tx')).toHaveCount(10);
    await expect(page.locator('#transmissions .tx[data-medium="RF"]')).toHaveCount(3);
    // The live console's filters: distress calls, the network the array overhears, and hails to and from our ship.
    await page.locator('[data-filter="distress"]').click();
    await expect(page.locator('#transmissions .tx')).toHaveCount(2);
    for (const card of await page.locator('#transmissions .tx').all()) await expect(card).toHaveAttribute('data-kind', 'distress');
    await page.locator('[data-filter="ours"]').click();
    await expect(page.locator('#transmissions .tx')).toHaveCount(1);
    await expect(page.locator('#transmissions .tx b')).toHaveText('Ross Orbital Station');
    await page.locator('[data-filter="network"]').click();
    await expect(page.locator('#transmissions .tx')).toHaveCount(9);
    await page.locator('[data-filter="all"]').click();
    await expect(page.locator('#transmissions .tx')).toHaveCount(10);
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
    await page.locator('#transmissions .tx', { hasText: 'to Patrol ship Resolute' }).click();
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
    await expect(page.locator('#txCount')).toHaveText('11');
    await demo(page, async () => {
      await page.locator('#menuDialog [data-field="rfRange"] [data-edit]').click();
      await keypadEnter(page.locator('#menuDialog .keypad'), '50000');
    });
    // The sample detected again is Kepler's RF beacon, 45,000 km off: both its detections are within 50,000 km.
    await expect(page.locator('#transmissions .tx[data-medium="RF"]')).toHaveCount(2);
    await expect(page.locator('#rangeNote')).toHaveText('RF range 50,000 KM · Subspace unlimited · our array Tx 3 LY · Rx 3 LY');
    await page.evaluate(() => CommsControl.set({ ageAll: 400000 }));
    await expect(page.locator('#txCount')).toHaveText('0');
  },
  'Standard Frequencies is an overlay from the bottom bar: search, medium, and tune to open a communication': async ({ open }) => {
    const page = await open('/Communications/');
    await page.locator('#frequenciesBtn').click();
    await expect(page.locator('#frequencyDialog')).toBeVisible();
    await expect(page.locator('#frequencyCount')).toHaveText('20 FREQUENCIES');
    await expect(page.locator('#frequencyList .frequency.advertised')).toHaveCount(2);
    await page.locator('[data-frequency-medium="RF"]').click();
    await expect(page.locator('#frequencyCount')).toHaveText('14 FREQUENCIES');
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
  'places answer on their own frequencies: what each is for, RF in transit at light speed, RF beyond a light-hour refused': async ({ open }) => {
    // MissionProtocol "Settlement and Base Communications" (John, 2026-11-12): Tranquility, the Commonwealth's base and seat of government,
    // talks on subspace — its settlement, Commonwealth Command and the Commonwealth's government each on a frequency of their own.
    const page = await open('/Communications/');
    await page.locator('#frequenciesBtn').click();
    const card = name => page.locator('#frequencyList .frequency.place', { hasText: name });
    await expect(card('Commonwealth Command · Tranquility').locator('small')).toHaveText('SUBSPACE · COMMONWEALTH BASE · COMMAND · BEYOND OUR REACH · ROUTE THROUGH RELAYS');
    await expect(card('Commonwealth Government · Tranquility').locator('small')).toHaveText(/^SUBSPACE · COMMONWEALTH GOVERNMENT · GOVERNMENT · /);
    await expect(card('Tranquility · Traffic control').locator('small')).toHaveText(/^SUBSPACE · TRANQUILITY · TRAFFIC CONTROL · /);
    await page.locator('[data-frequency-medium="RF"]').click();
    await expect(card('Ross Orbital Station · Public information').locator('small')).toHaveText(/^RF · ROSS ORBITAL STATION · PUBLIC INFORMATION · IN RF REACH · .* EACH WAY$/);
    await expect(card('Paris · Public information').locator('small')).toHaveText('RF · PARIS · PUBLIC INFORMATION · BEYOND RF (OVER A LIGHT-HOUR)');
    // RF in reach: the hail is in transit at light speed, and the place's desk replies after the light time each way.
    await card('Ross Orbital Station · Public information').click();
    await expect(page.locator('#channelValue')).toHaveText('412.0 MHz');
    await page.locator('#saveComm').click();
    await expect(page.locator('#commChat')).toBeVisible();
    await page.locator('#messageInput').click();
    await typeKeys(page, '#commChat', 'HELLO');
    await page.locator('#commChat .search-keys [data-key="DONE"]').click();
    await page.locator('#sendMessage').click();
    await expect(page.locator('#conversation .bubble', { hasText: 'In transit by RF' })).toBeVisible();
    await expect(page.locator('#conversation .bubble', { hasText: 'Ross Orbital Station public information. Reading you, Discovery.' })).toBeVisible({ timeout: 5000 });
    // RF more than a light-hour away does not carry: the hail is refused, and subspace is offered.
    await page.locator('#commsDialog [data-close]').last().click();
    await page.locator('#frequenciesBtn').click();
    await page.locator('[data-frequency-medium="RF"]').click();
    await card('Paris · Public information').click();
    await page.locator('#saveComm').click();
    await expect(page.locator('#commStatus')).toHaveText(/Paris is .* away: RF carries only a light-hour\. Hail it on subspace\./);
    await expect(page.locator('#commChat')).toBeHidden();
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
    await expect(page.locator('#commDetails')).toHaveText('KEPLER · Point to point · Subspace · Channel 33.3 SSC · Encrypted · direct');
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
    // Ross Orbital Station is beside us, in reach of our array (the cargo ship first selected is 8 LY off: out of reach).
    await page.locator('#transmissions .tx', { hasText: 'Ross Orbital Station' }).click();
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
    // Ross Orbital Station is beside us, in reach of our array (the cargo ship first selected is 8 LY off: out of reach).
    await page.locator('#transmissions .tx', { hasText: 'Ross Orbital Station' }).click();
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
  'contact settings set our channel and broadcast; view screen settings are saved for the View Screen': async ({ open }) => {
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
    // Four view types, NONE leaving the forward scope alone; DUAL is the default.
    await expect(page.locator('[data-view-mode]')).toHaveText(['SRS', 'LRS', 'DUAL', 'NONE']);
    await expect(page.locator('[data-view-mode="dual"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-view-mode="none"]').click();
    await expect(page.locator('#srsRanges')).toHaveClass(/unused/);
    await expect(page.locator('#lrsRanges')).toHaveClass(/unused/);
    await page.locator('[data-view-mode="srs"]').click();
    await expect(page.locator('#srsRanges')).not.toHaveClass(/unused/);
    await expect(page.locator('#lrsRanges')).toHaveClass(/unused/);
    await page.locator('#srsRanges button', { hasText: '100 km' }).click();
    await page.locator('#labelsFilters button', { hasText: 'Ships' }).click();
    await expect(page.locator('#scopeZooms button')).toHaveText(['1×', '2×', '4×', '8×', '12×', '20×']);
    await expect(page.locator('#scopeZooms button', { hasText: /^1×$/ })).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#scopeZooms button', { hasText: /^8×$/ }).click();
    await expect(page.locator('#scopeZooms button', { hasText: /^8×$/ })).toHaveAttribute('aria-pressed', 'true');
    const view = (await state(page)).viewScreen;
    assert.equal(view.mode, 'srs');
    assert.equal(view.srs, '100-km');
    assert.equal(view.labels.ships, false);
    assert.equal(view.zoom, 8);
    await expect(page.locator('#viewScreenStatus')).toHaveText('View screen updated.');
    // Saved where the View Screen reads it, and kept after a reload.
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('xmps-demo-view-screen')));
    assert.deepEqual([saved.mode, saved.srs, saved.zoom, saved.labels.ships], ['srs', '100-km', 8, false]);
    await page.reload();
    await page.locator('#viewScreenBtn').click();
    await expect(page.locator('[data-view-mode="srs"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#scopeZooms button', { hasText: /^8×$/ })).toHaveAttribute('aria-pressed', 'true');
  },
  'a relay route carries subspace beyond our array: our buoys and our allies\' open with codes the computer holds; others ask for a code we do not have': async ({ open }) => {
    const page = await open('/Communications/');
    const shots = process.env.SHOTS, engine = page.context().browser().browserType().name();
    await page.locator('#commsBtn').click();
    await page.locator('#newComm').click();
    await page.locator('#recipientInput').click();
    await typeKeys(page, '#commSetup', 'TERRAN SPACE COMMAND');
    await page.locator('#commSetup .search-keys [data-key="DONE"]').click();
    // Terran Space Command is on Earth, 11 LY off: beyond our 3 LY array, so the link is refused until relays carry it.
    await expect(page.locator('#routeState')).toHaveText('OUT OF REACH');
    await expect(page.locator('#routeHops .hop.bad .why')).toHaveText("beyond TNS Discovery's Tx (3 LY)");
    await page.locator('#saveComm').click();
    await expect(page.locator('#commStatus')).toHaveText(/^Out of reach\. TNS Discovery → Terran Space Command: 11\.\d\d LY/);
    await expect(page.locator('#commChat')).toBeHidden();
    // The buoys, nearest first: only Ross 128's is in reach of our ship. Ours, so the computer fills its code in.
    await page.locator('#addRelay').click();
    await expect(page.locator('#relayList .relay-item').first()).toHaveAttribute('data-relay', 'relay-ross-128');
    await expect(page.locator('[data-relay="relay-ross-128"] i')).toHaveText('IN REACH');
    await expect(page.locator('[data-relay="relay-ross-128"] em')).toHaveText('Terran Space Command · ours · CODE KNOWN');
    await expect(page.locator('[data-relay="relay-sol"] i')).toHaveText('OUT OF REACH');
    // A rival's buoy asks for its code; our computer does not hold it, and a guess is refused. (Every buoy is Terran Space
    // Command's today; the test hands one to the Velari Concord.)
    await page.evaluate(() => CommsControl.set({ relayOwner: ['relay-gj-699', 'Velari Concord'] }));
    await page.locator('#relayCancel').click();
    await page.locator('#addRelay').click();
    await expect(page.locator('[data-relay="relay-gj-699"] em')).toHaveText('Velari Concord · rival · CODE NEEDED');
    if (shots) await page.screenshot({ path: `${shots}/relay-${engine}-picker.png` });
    await page.locator('[data-relay="relay-gj-699"]').click();
    await expect(page.locator('#relayCodeHint')).toContainText('Our computer does not hold its access code');
    await typeKeys(page, '#relayCodeStep', '1234-5678');
    await page.locator('#relayCodeAdd').click();
    await expect(page.locator('#relayStatus')).toHaveText('Access code refused by GJ 699 Buoy.');
    if (shots) await page.screenshot({ path: `${shots}/relay-${engine}-code.png` });
    await page.locator('#relayCodeBack').click();
    await page.locator('[data-relay="relay-ross-128"]').click();
    await expect(page.locator('#commSetup')).toBeVisible();
    // Then Sol's buoy, 11 LY from Ross's: in reach buoy to buoy (20 LY each way), and ours too.
    await page.locator('#addRelay').click();
    await expect(page.locator('#relayFrom')).toHaveText('NEXT HOP FROM ROSS 128 BUOY');
    await expect(page.locator('[data-relay="relay-sol"] i')).toHaveText('IN REACH');
    await page.locator('[data-relay="relay-sol"]').click();
    await expect(page.locator('#routeState')).toHaveText('ROUTE OPEN');
    await expect(page.locator('#routeHops .hop.good')).toHaveCount(3);
    if (shots) await page.screenshot({ path: `${shots}/relay-${engine}-route.png` });
    await page.locator('#saveComm').click();
    await expect(page.locator('#commDetails')).toHaveText(/via Ross 128 Buoy → Sol Buoy$/);
    if (shots) {
      await page.locator('#commsDialog [data-close]').first().click();
      await page.evaluate(() => CommsControl.set({ range: 30 * 9460730472580.8 }));
      await page.screenshot({ path: `${shots}/relay-${engine}-map.png` });
    }
    // RF takes no relays.
    const route = await page.evaluate(() => CommsControl.route());
    assert.equal(route.open, true);
    assert.deepEqual(route.route.map(h => h.key), ['relay-ross-128', 'relay-sol']);
  },
  'Space Traffic: network messages listed with their kind, our organization\'s encrypted traffic DECRYPTED, another\'s unreadable': async ({ open }) => {
    const page = await open('/Communications/');
    const patrol = page.locator('#transmissions .tx[data-kind="patrol"]');
    await expect(patrol.locator('.tx-top span')).toHaveText('10.0 SSC · PATROL REPORT');
    await expect(patrol.locator('.tx-top em')).toHaveText('DECRYPTED');
    await expect(patrol.locator('b')).toHaveText('Terran Space Command');
    await expect(patrol.locator('small').first()).toHaveText(/^to TNS Resolute · Patrol report: Ross corridor clear/);
    await patrol.click();
    await expect(page.locator('#sigSecurity')).toHaveText('ENCRYPTED · OUR ORGANIZATION');
    await expect(page.locator('#sigType')).toHaveText('Patrol report');
    await expect(page.locator('#sigContent')).toHaveText(/^Patrol report: Ross corridor clear/);
    const plan = page.locator('#transmissions .tx[data-kind="flight-plan"]');
    await expect(plan.locator('.tx-top em')).toHaveText('ENCRYPTED');
    await plan.click();
    await expect(page.locator('#sigSecurity')).toHaveText('ENCRYPTED');
    await expect(page.locator('#sigContent')).toHaveText('Encrypted transmission from Velari courier Ithis to Alpha Centauri Orbital Station on 16.0 SSC. Content not readable.');
    // The stream: a warning, then messages to our ship (OURS) with their live names.
    const names = [];
    for (let i = 0; i < 13; i++) names.push((await page.evaluate(() => CommsControl.hearNext())).name);
    assert.deepEqual(names, ['Arrival', 'Requisition', 'Docking clearance', 'Navigation warning', 'Distress call', 'Dispatch', 'Stand down', 'All clear', 'Delivery approved', 'Departure', 'Hail refused', 'Report', 'Delivery refused']);
    await page.locator('[data-filter="ours"]').click();
    await expect(page.locator('#transmissions .tx[data-kind="clearance"] .tx-top span')).toHaveText('SUBSPACE · DOCKING CLEARANCE');
    await expect(page.locator('#transmissions .tx[data-kind="delivery-refused"]')).toHaveCount(1);
    await expect(page.locator('#transmissions .tx[data-kind="refused"] small').first()).toHaveText('Ross · Direct · to TNS Discovery');
    // A docking clearance is held in the chat with that station.
    await page.locator('#frequenciesBtn').click();
    await page.locator('#frequencyDialog [data-close]').click();
    await page.evaluate(() => CommsControl.set({}));
    await page.locator('#transmissions .tx[data-kind="clearance"]').click();
    await page.locator('#contactBtn').click();
    await page.locator('[data-comm-type="Unicast"]').click();
    await page.locator('#saveComm').click();
    await expect(page.locator('#commDetails')).toHaveText(/Docking clearance held$/);
  },

  'a distress call raises the banner: caller, GBEAR and distance, HAIL opens a chat, DISMISS until a fresh MAYDAY, gone at the all clear': async ({ open }) => {
    const page = await open('/Communications/');
    await expect(page.locator('#distressBanner')).toBeHidden();
    await page.evaluate(() => CommsControl.hearTraffic({ kind: 'distress', fromName: 'Atlas Bulk Transport ABT-07', fromKey: 'ABT-07', system: 'Ross', text: 'MAYDAY, MAYDAY. ABT-07 held by a raider.' }));
    await expect(page.locator('#distressBanner')).toBeVisible();
    await expect(page.locator('#distressFrom')).toHaveText('Atlas Bulk Transport ABT-07 (ABT-07)');
    await expect(page.locator('#distressWhere')).toHaveText(/^GBEAR [\d.,]+° · [\d.,]+ (KM|MKM|BKM|LY) · /);
    await expect(page.locator('#distressText')).toHaveText('MAYDAY, MAYDAY. ABT-07 held by a raider.');
    await page.locator('[data-filter="distress"]').click();
    await expect(page.locator('#transmissions .tx[data-kind="distress"]').first()).toContainText('DISTRESS CALL');
    await page.locator('#distressPlot').click();
    await expect(page.locator('#notice')).toContainText("Navigation would plot a course to Atlas Bulk Transport ABT-07's position");
    await page.locator('#distressHail').click();
    await expect(page.locator('#commsDialog')).toBeVisible();
    await expect(page.locator('#recipientInput')).toHaveValue('Atlas Bulk Transport ABT-07');
    await expect(page.locator('#routeState')).toHaveText('DIRECT · IN REACH');
    await page.locator('#commsDialog [data-close]').first().click();
    await page.locator('#distressDismiss').click();
    await expect(page.locator('#distressBanner')).toBeHidden();
    // A repeat that is not a fresh MAYDAY stays dismissed; a fresh MAYDAY brings it back.
    await page.evaluate(() => CommsControl.hearTraffic({ kind: 'distress', fromName: 'Atlas Bulk Transport ABT-07', fromKey: 'ABT-07', text: 'ABT-07 still waiting.' }));
    await expect(page.locator('#distressBanner')).toBeHidden();
    await page.evaluate(() => CommsControl.hearTraffic({ kind: 'distress', fromName: 'Atlas Bulk Transport ABT-07', fromKey: 'ABT-07', text: 'MAYDAY, MAYDAY. ABT-07 hull damaged.' }));
    await expect(page.locator('#distressBanner')).toBeVisible();
    await expect(page.locator('#distressText')).toHaveText('MAYDAY, MAYDAY. ABT-07 hull damaged.');
    await page.evaluate(() => CommsControl.hearTraffic({ kind: 'all-clear', fromName: 'Atlas Bulk Transport ABT-07', fromKey: 'ABT-07', text: 'All clear.' }));
    await expect(page.locator('#distressBanner')).toBeHidden();
  },

  'the chat\'s ROUTE goes back to the setup and keeps the conversation; the setup lists matching contacts to tap': async ({ open }) => {
    const page = await open('/Communications/');
    await page.locator('#commsBtn').click();
    await page.locator('#newComm').click();
    await page.locator('#recipientInput').click();
    await typeKeys(page, '#commSetup', 'EARTH');
    await page.locator('#commSetup .search-keys [data-key="DONE"]').click();
    const chips = page.locator('#recipientMatches .match');
    await expect(chips.first()).toHaveText(/^Earth/);
    await page.locator('#recipientMatches [data-contact="Earth Orbital Station"]').click();
    await expect(page.locator('#recipientInput')).toHaveValue('Earth Orbital Station');
    await expect(page.locator('#recipientMatches [data-contact="Earth Orbital Station"]')).toHaveAttribute('aria-pressed', 'true');
    // Earth is 11 LY from Ross: out of our 3 LY reach direct, so OPEN COMMUNICATION is refused.
    await page.locator('#saveComm').click();
    await expect(page.locator('#commStatus')).toHaveText(/^Out of reach\./);
    await page.evaluate(() => document.querySelector('[data-array="10"]').click());
    await expect(page.locator('#routeState')).toHaveText('OUT OF REACH');
    for (const relay of ['relay-ross-128', 'relay-sol']) {
      await page.locator('#addRelay').click();
      await page.locator(`[data-relay="${relay}"]`).click();
    }
    await page.locator('#saveComm').click();
    await expect(page.locator('#conversation .bubble')).toHaveCount(4);
    await page.locator('#editRoute').click();
    await expect(page.locator('#commSetup')).toBeVisible();
    await expect(page.locator('#saveComm')).toHaveText('BACK TO COMMUNICATION');
    await page.locator('#clearRoute').click();
    await page.locator('#addRelay').click();
    await page.locator('[data-relay="relay-ross-128"]').click();
    await page.locator('#addRelay').click();
    await page.locator('[data-relay="relay-sol"]').click();
    await page.locator('#saveComm').click();
    await expect(page.locator('#conversation .bubble')).toHaveCount(4);
    // The reply was heard as a transmission to our ship.
    await page.locator('#commsDialog [data-close]').first().click();
    await page.locator('[data-filter="ours"]').click();
    await expect(page.locator('#transmissions .tx[data-kind="reply"] .tx-top span')).toHaveText('SUBSPACE · HAIL REPLY');
  },

  'the communications array in contact settings: reach, power, health, ARRAY RELAY; off, the array hears nothing': async ({ open }) => {
    const page = await open('/Communications/');
    await page.locator('#contactSettingsBtn').click();
    await expect(page.locator('#arrayName')).toHaveText('Terran Communications Array Mark I · slot COM-1');
    await expect(page.locator('#arrayTx')).toHaveText('3 LY');
    await expect(page.locator('#arrayRx')).toHaveText('3 LY');
    await expect(page.locator('#arrayPower')).toHaveText('6 / 6 PU');
    await expect(page.locator('#arrayHealth')).toHaveText('100 %');
    await expect(page.locator('#arrayCritical')).toBeHidden();
    await page.locator('#arrayRelay').click();
    await expect(page.locator('#arrayRelay')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#arrayPower')).toHaveText('0 / 6 PU · OFF');
    await page.locator('#contactDialog [data-close]').click();
    await expect(page.locator('#state')).toHaveText('ARRAY OFFLINE');
    await expect(page.locator('#monitorText')).toHaveText('ARRAY OFFLINE');
    await expect(page.locator('#monitor')).toHaveClass(/off/);
    await expect(page.locator('#rangeNote')).toContainText('· no power');
    const before = (await state(page)).rows.length;
    assert.equal(await page.evaluate(() => CommsControl.hearNext()), null, 'nothing is heard with the array off');
    assert.equal((await state(page)).rows.length, before);
    await page.locator('#contactSettingsBtn').click();
    await page.locator('#arrayRelay').click();
    await page.locator('#contactDialog [data-close]').click();
    await expect(page.locator('#monitorText')).toHaveText('SUBSPACE LISTENING');
    await expect(page.locator('#state')).toHaveText('BROADCAST 42.7 SSC');
  },

  'critical damage on the array: subspace range halved, no subspace (top bar, route, refused), no RF': async ({ open }) => {
    const page = await open('/Communications/');
    await page.evaluate(() => DemoCombat.set('comms', ['subspace-range-halved']));
    await page.locator('#contactSettingsBtn').click();
    await expect(page.locator('#arrayTx')).toHaveText('1.5 LY of 3');
    await expect(page.locator('#arrayCritical')).toHaveText('CRITICAL: Subspace range halved');
    await expect(page.locator('#arrayHealth')).toHaveText('45 %');
    await page.locator('#contactDialog [data-close]').click();
    await expect(page.locator('#rangeNote')).toContainText('Tx 1.5 LY · Rx 1.5 LY · CRITICAL: Subspace range halved');
    await page.evaluate(() => DemoCombat.set('comms', ['no-subspace']));
    await expect(page.locator('#state')).toHaveText('NO SUBSPACE');
    await page.locator('#transmissions .tx', { hasText: 'Ross Orbital Station' }).click();
    await page.locator('#contactBtn').click();
    await expect(page.locator('#routeState')).toHaveText('NO SUBSPACE · CRITICAL DAMAGE');
    await page.locator('#saveComm').click();
    await expect(page.locator('#commStatus')).toHaveText('No subspace communications: the array has critical damage.');
    assert.equal(await page.evaluate(() => CommsControl.hearNext()), null, 'no subspace traffic is heard');
    await page.locator('#commsDialog [data-close]').first().click();
    // No RF: RF detections are not heard and an RF communication is refused.
    await page.evaluate(() => DemoCombat.set('comms', ['no-rf']));
    await expect(page.locator('#transmissions .tx[data-medium="RF"]')).toHaveCount(0);
    await expect(page.locator('#rangeNote')).toContainText('RF not heard');
    await page.locator('#commsBtn').click();
    await page.locator('#newComm').click();
    await page.locator('[data-comm-medium="RF"]').click();
    await page.locator('#saveComm').click();
    await expect(page.locator('#commStatus')).toHaveText('No RF communications: the array has critical damage.');
    await page.evaluate(() => DemoCombat.clearCritical());
    await page.locator('#saveComm').click();
    await expect(page.locator('#commChat')).toBeVisible();
  },
});
