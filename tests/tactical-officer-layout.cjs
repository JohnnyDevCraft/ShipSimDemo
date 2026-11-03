// Tactical Officer Control fits any landscape window from an iPad to a 4K monitor: the top bar, the weapons and
// shields, the scanned target and the range, the advisory and the bottom bar stay on screen and apart, nothing
// is clipped, and every overlay (camera, condition, subsystems, the weapon set-ups, demo controls) fits.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const sizes = [[1024, 768], [1180, 820], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const parts = { topbar: '.topbar', left: '.col.left', right: '.col.right', advisory: '#advisory', dock: '.dock' };
const box = (page, selector) => page.locator(selector).evaluate(element => { const b = element.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
const dialogFits = (page, id) => page.evaluate(dialogId => { const d = document.getElementById(dialogId), b = d.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && d.scrollHeight <= d.clientHeight + 1; }, id);

const cases = {};
for (const [width, height] of sizes)
  cases[`everything fits at ${width}×${height}`] = async ({ open }) => {
    const page = await open('/TacticalOfficer/');
    await page.setViewportSize({ width, height });
    // The tallest right column: a scanned ship selected.
    await page.evaluate(() => {
      TacticalOfficer.select('ship:Training ship A');
      TacticalOfficer.set({ contacts: [{ range: 20000 }] });
      document.getElementById('scanBtn').click();
      TacticalOfficer.step(95);
      // The longest target values: coils charging.
      document.getElementById('menuBtn').click();
      document.getElementById('openDemoControls').click();
      document.getElementById('demoCoils').click();
      document.querySelector('#menuDialog [data-close]').click();
      TacticalOfficer.step(20);
    });
    await expect(page.locator('#scanStatus')).toHaveText('DETAILED SCAN COMPLETE');
    await page.waitForTimeout(150);
    const boxes = {};
    for (const [name, selector] of Object.entries(parts)) boxes[name] = await box(page, selector);
    for (const [name, b] of Object.entries(boxes)) assert.ok(b.l >= -0.5 && b.t >= -0.5 && b.r <= width + 0.5 && b.b <= height + 0.5, `${name} is inside the window`);
    const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const names = Object.keys(boxes);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(boxes[names[i]], boxes[names[j]]), `${names[i]} and ${names[j]} do not overlap`);
    const panels = await page.evaluate(() => [...document.querySelectorAll('.col .panel')].filter(p => !p.hidden).map(p => {
      const b = p.getBoundingClientRect(), col = p.parentElement.getBoundingClientRect();
      return { id: p.className, clipped: p.scrollHeight > p.clientHeight + 1, inside: b.top >= col.top - 0.5 && b.bottom <= col.bottom + 0.5 };
    }));
    for (const p of panels) {
      assert.ok(!p.clipped, `${p.id} is not clipped`);
      assert.ok(p.inside, `${p.id} stays in its column`);
    }
    // Nothing inside a panel spills past its edges.
    const spill = await page.evaluate(() => [...document.querySelectorAll('.col .panel')].filter(p => !p.hidden).flatMap(panel => {
      const p = panel.getBoundingClientRect();
      return [...panel.querySelectorAll('*')].filter(e => e.getClientRects().length).filter(e => { const b = e.getBoundingClientRect(); return b.right > p.right + 0.5 || b.left < p.left - 0.5; }).map(e => `${panel.className} > ${e.tagName} ${e.textContent.slice(0, 30)}`);
    }));
    assert.deepEqual(spill, [], 'everything stays inside its panel');
    // The shield ring's labels stay clear of the ring.
    const clear = await page.evaluate(() => {
      const ring = [...document.querySelectorAll('#ownQuadrants path')].map(p => p.getBoundingClientRect()), left = Math.min(...ring.map(b => b.left)), right = Math.max(...ring.map(b => b.right));
      const texts = [...document.querySelectorAll('#ownQuadrants text')].map(t => t.getBoundingClientRect());
      return { port: left - Math.max(...texts.slice(6).map(b => b.right)), starboard: Math.min(...texts.slice(2, 4).map(b => b.left)) - right };
    });
    assert.ok(clear.port > 1 && clear.starboard > 1, `port and starboard labels clear the ring (${JSON.stringify(clear)})`);
    // Weapon names, panel titles and target rows are not cut off.
    const cut = await page.evaluate(() => [...document.querySelectorAll('.weapon > *, .thead > *, #targetRows dd, .target-shields b')].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent));
    assert.deepEqual(cut, [], 'no text is cut off');
    const heads = await page.evaluate(() => [...document.querySelectorAll('.col .thead')].filter(t => t.offsetParent).map(t => { const [a, b] = [...t.children].map(c => c.getBoundingClientRect()); return { name: t.firstElementChild.textContent, gap: b.left - a.right }; }));
    for (const head of heads) assert.ok(head.gap >= 4, `${head.name} clears its chip (${head.gap})`);
    const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    const range = await page.locator('#rangeSlider').boundingBox();
    assert.ok(range.height >= 5 * rem, `the range slider is usable (${range.height})`);
    for (const control of ['#weaponGrid', '#shieldDiagram', '#shieldsBtn', '#targetName', '#scanStatus', '#clearBtn', '#cameraBtn', '#menuBtn']) await expect(page.locator(control)).toBeInViewport({ ratio: 0.99 });
    // Overlays
    await page.locator('#cameraBtn').click();
    assert.ok(await dialogFits(page, 'cameraDialog'), 'the camera overlay fits');
    const stick = await page.locator('#cameraStick').boundingBox();
    assert.ok(stick.width >= 8 * rem, 'the joystick is big enough to drag');
    await page.locator('#cameraDialog [data-close]').click();
    await page.locator('#conditionBtn').click();
    assert.ok(await dialogFits(page, 'conditionDialog'), 'the condition overlay fits');
    await page.locator('#conditionDialog [data-close]').click();
    await page.locator('#subsystemsBtn').click();
    assert.ok(await dialogFits(page, 'subsystemsDialog'), 'the subsystems overlay fits');
    await page.locator('#subsystemsDialog [data-close]').click();
    // The weapon set-up overlays: the launcher list, a launcher's set-up at its tallest (proximity, a round
    // assembling and loading), and an energy weapon's set-up. The training ship stops firing so we survive.
    await page.evaluate(() => TacticalOfficer.set({ demo: { behavior: 'run' }, hull: 500 }));
    await page.locator('#torpedoesBtn').click();
    assert.ok(await dialogFits(page, 'weaponsDialog'), 'the torpedo launcher list fits');
    await page.locator('#weaponsList [data-choose="TPD1"]').click();
    await page.locator('#tdTrigger [data-trigger="Proximity"]').click();
    await page.locator('#tdAutoAssemble').click();
    await page.evaluate(() => TacticalOfficer.step(105));
    await page.locator('#tdLoad').click();
    assert.ok(await dialogFits(page, 'weaponsDialog'), 'the launcher set-up fits');
    const cutInDialog = () => page.evaluate(() => [...document.querySelectorAll('#weaponsDialog button, #weaponsDialog .wline > *, #weaponsDialog .rows dd, #weaponsDialog .wc-head > *')].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent));
    assert.deepEqual(await cutInDialog(), [], 'no launcher text is cut off');
    await page.locator('#weaponsDialog [data-close]').click();
    await page.locator('#epwBtn').click();
    assert.ok(await dialogFits(page, 'weaponsDialog'), 'the EPW list fits');
    assert.deepEqual(await cutInDialog(), [], 'no EPW card text is cut off');
    await page.locator('#weaponsList [data-choose="EPW1"]').click();
    assert.ok(await dialogFits(page, 'weaponsDialog'), 'the EPW set-up fits');
    assert.deepEqual(await cutInDialog(), [], 'no EPW set-up text is cut off');
    await page.locator('#weaponsDialog [data-close]').click();
    // The nine bottom-bar commands keep apart.
    const commands = await page.locator('.dock button').evaluateAll(buttons => buttons.map(b => { const r = b.getBoundingClientRect(); return { l: r.left, r: r.right, cut: b.scrollWidth > b.clientWidth + 1 }; }));
    for (let i = 1; i < commands.length; i++) assert.ok(commands[i].l >= commands[i - 1].r, `bottom-bar command ${i + 1} clears the one before`);
    assert.ok(commands.every(c => !c.cut), 'no bottom-bar label is cut off');
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    assert.ok(await dialogFits(page, 'menuDialog'), 'the demo controls fit');
  };
run(cases);
