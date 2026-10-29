// DOT Bay Control: four DOTs in their charging cradles; one is picked and assigned to a damaged component, beams
// there in ten seconds and repairs it; repair time divides by the DOTs on it; a battery lasts five minutes of repair,
// then the DOT beams home, recharges and goes back on its own; a finished repair sends its DOTs home; recall; the
// bay offline; power from idle to all four charging; and the demo controls in the menu.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const state = page => page.evaluate(() => DotBay.state());
const step = (page, seconds) => page.evaluate(s => DotBay.step(s), seconds);
const dot = (page, i) => page.locator(`#cradle${i}`);
// Tap a cradle where it is on screen (WebKit's test driver misplaces clicks on SVG groups).
async function tapCradle(page, i) {
  const b = await dot(page, i).evaluate(g => { const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(b.x, b.y);
}
async function assign(page, i, key) {
  await tapCradle(page, i);
  await page.locator('#assignBtn').click();
  await page.locator(`#assignGrid [data-component="${key}"]`).click();
  await expect(page.locator('#assignDialog')).toBeHidden();
}
async function demo(page, act) {
  await page.locator('#menuBtn').click();
  await page.locator('#openDemoControls').click();
  await act();
  if (await page.locator('#menuDialog').isVisible()) await page.locator('#menuDialog [data-close]').last().click();
}
async function setField(page, key, text) {
  await page.locator(`#menuDialog [data-field="${key}"] [data-edit]`).click();
  const pad = page.locator('#menuDialog .keypad');
  await pad.getByRole('button', { name: 'Clear' }).click();
  for (const key of text) await pad.getByRole('button', { name: key, exact: true }).click();
  await page.locator('#menuDialog [data-save]').click();
}

run({
  'four DOTs charged in the bay, the bay at idle power, and the damaged components listed first': async ({ open }) => {
    const page = await open('/DotBay/');
    await expect(page.locator('.title-pill')).toHaveText('DOT BAY CONTROL');
    await expect(page.locator('.cradle')).toHaveCount(4);
    await expect(page.locator('.cradle .state-text')).toHaveText(['READY', 'READY', 'READY', 'READY']);
    await expect(page.locator('.cradle .battery-text')).toHaveText(Array(4).fill('BATTERY 100%'));
    await expect(page.locator('#bayChip')).toHaveText('ONLINE');
    await expect(page.locator('#powerValue')).toHaveText('1.0 PU');
    await expect(page.locator('#readyCount')).toHaveText('4');
    await expect(page.locator('#componentsChip')).toHaveText('4 DAMAGED');
    await expect(page.locator('#componentList li')).toHaveCount(12);
    await expect(page.locator('#componentList li .cname').first()).toHaveText('Phaser array');
    await expect(page.locator('.dock button')).toHaveText(['ASSIGN DOT 1', 'SEND NOW', 'RECALL DOT', 'RECALL ALL', 'BAY ONLINE', 'DIAGNOSTICS']);
    await expect(page.locator('#sendBtn')).toBeDisabled();
    await expect(page.locator('#recallBtn')).toBeDisabled();
    await expect(page.locator('#advisory')).toHaveText('4 components damaged. Assign DOT 1 to one.');
    // A tap on a cradle picks its DOT.
    await tapCradle(page, 2);
    await expect(page.locator('#cradle2')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#dotTitle')).toHaveText('DOT 3');
    await expect(page.locator('#assignLabel')).toHaveText('ASSIGN DOT 3');
  },
  'an assigned DOT beams to its component in ten seconds and repairs it; two DOTs halve the time': async ({ open }) => {
    const page = await open('/DotBay/');
    await page.locator('#assignBtn').click();
    // 60% of the warp drive's 30 minutes for one DOT.
    await expect(page.locator('#assignGrid [data-component="warp"] small')).toHaveText('0 DOTs on it · with this one: 18m 00s');
    await page.locator('#assignGrid [data-component="warp"]').click();
    await expect(page.locator('#notice')).toHaveText('DOT 1 beaming to Warp drive.');
    await expect(page.locator('#dotState')).toHaveText('BEAMING OUT');
    await step(page, 10.1);
    await expect(page.locator('#dotState')).toHaveText('REPAIRING');
    await expect(page.locator('#dotLocation')).toHaveText('Warp drive');
    await expect(page.locator('#cradle0 .empty-where')).toHaveText('AT WARP DRIVE');
    const before = (await state(page)).integrity.warp;
    await step(page, 60);
    assert.ok(Math.abs((await state(page)).integrity.warp - before - 100 / 30) < 0.05, 'one DOT: 1/30 of the drive a minute');
    await assign(page, 1, 'warp');
    await step(page, 10.1);
    const halfway = await state(page);
    await step(page, 60);
    assert.ok(Math.abs((await state(page)).integrity.warp - halfway.integrity.warp - 200 / 30) < 0.05, 'two DOTs: twice as fast');
    await expect(page.locator('#componentList li', { hasText: 'Warp drive' }).locator('.cdots i')).toHaveCount(2);
  },
  'after five minutes on a battery a DOT beams home, recharges and goes back on its own': async ({ open }) => {
    const page = await open('/DotBay/');
    await assign(page, 0, 'warp');
    await step(page, 10.1 + 300);
    await expect(page.locator('#notice')).toHaveText('DOT 1 battery empty: beaming home to recharge.');
    await expect(page.locator('#dotState')).toHaveText('BEAMING HOME');
    await step(page, 10.1);
    await expect(page.locator('#dotState')).toHaveText('CHARGING');
    await expect(page.locator('#powerValue')).toHaveText('2.5 PU');
    await expect(page.locator('#dotAssignment')).toHaveText('Warp drive');
    await expect(page.locator('#advisory')).toHaveText(/^DOT 1 charging · back to Warp drive in /);
    await step(page, 120.1);
    await expect(page.locator('#dotState')).toHaveText('BEAMING OUT');
    await step(page, 10.1);
    await expect(page.locator('#dotState')).toHaveText('REPAIRING');
    await expect(page.locator('#dotLocation')).toHaveText('Warp drive');
  },
  'Send Now sends a charging DOT to its job early, from 30% battery': async ({ open }) => {
    const page = await open('/DotBay/');
    await assign(page, 0, 'warp');
    await step(page, 10.1 + 300 + 10.1);
    await expect(page.locator('#dotState')).toHaveText('CHARGING');
    // Below 30% it cannot be sent, and says why.
    await expect(page.locator('#sendBtn')).toBeDisabled();
    await expect(page.locator('#sendBtn')).toHaveAttribute('title', /^DOT 1 needs 30% battery to be sent \(now \d+%\)\.$/);
    await expect(page.locator('#advisory')).toHaveText(/^DOT 1 charging · back to Warp drive in .* · Send Now from 30%\.$/);
    await step(page, 30);
    await expect(page.locator('#sendBtn')).toBeDisabled();
    await step(page, 10);
    await expect(page.locator('#sendBtn')).toBeEnabled();
    await expect(page.locator('#sendLabel')).toHaveText('SEND NOW 33%');
    await expect(page.locator('#advisory')).toHaveText(/, or Send Now\.$/);
    await page.locator('#sendBtn').click();
    await expect(page.locator('#notice')).toHaveText('DOT 1 sent to Warp drive at 33% battery.');
    await expect(page.locator('#dotState')).toHaveText('BEAMING OUT');
    await step(page, 10.1);
    await expect(page.locator('#dotState')).toHaveText('REPAIRING');
    // A third of a battery: about a hundred seconds of repair before it heads home again.
    await step(page, 95);
    await expect(page.locator('#dotState')).toHaveText('REPAIRING');
    await step(page, 10);
    await expect(page.locator('#dotState')).toHaveText('BEAMING HOME');
    // Assigning a charging DOT that is already past 30% says Send Now is there.
    await page.evaluate(() => DotBay.set({ dots: DotBay.state().dots.map(d => (d.id === 2 ? { ...d, state: 'charging', battery: 0.5 } : d)) }));
    await assign(page, 1, 'shields');
    await expect(page.locator('#notice')).toHaveText('DOT 2 assigned to Shield generator. It deploys when charged, or use Send Now.');
    await expect(page.locator('#sendBtn')).toBeEnabled();
  },
  'a finished repair sends its DOTs home; recall brings one back': async ({ open }) => {
    const page = await open('/DotBay/');
    await assign(page, 0, 'sensors');
    await step(page, 10.1);
    // 20% of the sensors' 10 minutes: two minutes.
    await step(page, 121);
    await expect(page.locator('#notice')).toHaveText('Sensors repaired. Its DOTs are beaming home.');
    await expect(page.locator('#dotAssignment')).toHaveText('None');
    await expect(page.locator('#componentList li', { hasText: 'Sensors' }).locator('b')).toHaveText('100%');
    await step(page, 10.1);
    await expect(page.locator('#dotLocation')).toHaveText('In the bay');
    // Recall
    await assign(page, 1, 'shields');
    await step(page, 10.1);
    await page.locator('#recallBtn').click();
    await expect(page.locator('#notice')).toHaveText('DOT 2 recalled from Shield generator.');
    await expect(page.locator('#dotState')).toHaveText('BEAMING HOME');
    await step(page, 10.1);
    await expect(page.locator('#dotLocation')).toHaveText('In the bay');
    await expect(page.locator('#recallBtn')).toBeDisabled();
  },
  'power runs from idle to the maximum with all four DOTs charging; offline the bay draws nothing and strands DOTs': async ({ open }) => {
    const page = await open('/DotBay/');
    await page.evaluate(() => DotBay.set({ dots: DotBay.state().dots.map(d => ({ ...d, state: 'charging', battery: 0.1 })) }));
    await expect(page.locator('#powerValue')).toHaveText('7.0 PU');
    await expect(page.locator('#chargingCount')).toHaveText('4');
    await page.evaluate(() => DotBay.set({ dots: DotBay.state().dots.map(d => ({ ...d, state: 'ready', battery: 1 })) }));
    await assign(page, 0, 'array');
    await step(page, 10.1);
    await page.locator('#bayBtn').click();
    await expect(page.locator('#bayLabel')).toHaveText('BAY OFFLINE');
    await expect(page.locator('#powerValue')).toHaveText('0.0 PU');
    await expect(page.locator('#transporterRow')).toHaveText('Offline');
    // The deployed DOT keeps working until its battery runs out, then it is stranded.
    await step(page, 300);
    await expect(page.locator('#dotState')).toHaveText('STRANDED');
    await expect(page.locator('#advisory')).toHaveText('Bay offline · 1 DOT stranded with empty batteries.');
    await page.locator('#bayBtn').click();
    await step(page, 0.2);
    await expect(page.locator('#dotState')).toHaveText('BEAMING HOME');
  },
  'the demo controls live in the menu: damage a component and the demo clock': async ({ open }) => {
    const page = await open('/DotBay/');
    await expect(page.locator('#demoControls')).toBeHidden();
    await demo(page, async () => {
      await page.locator('#demoComponent').selectOption('reactor');
      await setField(page, 'integrity', '30');
      await page.locator('[data-speed="60"]').click();
    });
    await expect(page.locator('#componentsChip')).toHaveText('5 DAMAGED');
    await expect(page.locator('#componentList li', { hasText: 'Reactor' }).locator('b')).toHaveText('30%');
    await expect(page.locator('#caption')).toHaveText('DIAGNOSTIC AND OPERATIONAL TECHNICIANS · REPAIRS · DEMO CLOCK ×60');
    await page.locator('#diagnosticsBtn').click();
    await expect(page.locator('#dotRows tr')).toHaveCount(4);
    await expect(page.locator('#diagnostics')).toContainText('7.0 PU');
  },
});
