// Weapons fire on every scanner and scope: a test volley from a page's Demo controls — a hostile drill ship firing a
// torpedo and pulses at us, our ship firing back, two other ships exchanging a beam and a pulse — is drawn on Helm's
// LRS and SRS, Navigation's map, the View Screen's scope and scanners, the weapon scopes, Tactical Officer and Fighter.
// Ours cyan, a hostile's red, anyone else's amber; a page that draws some fire itself adds only the sides it does not.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

// Fires a test volley from the page's Demo controls, then holds it `seconds` in so the marks stay put.
async function fireVolley(page, seconds = 2.6) {
  await page.locator('#menuBtn').click();
  await page.locator('#openDemoControls').click();
  const button = page.locator('#menuDialog [data-demo-volley]');
  await expect(button).toBeVisible();
  await button.click();
  await page.evaluate(t => DemoFire.hold(t), seconds);
  await page.locator('#menuDialog [data-close]').last().click();
  await expect(page.locator('#menuDialog')).toHaveJSProperty('open', false);
}
// The marks a view drew in its latest frame, after a few frames at the held time.
async function drawn(page, view) {
  await page.waitForTimeout(250);
  return page.evaluate(name => DemoFire.drawn[name] ?? [], view);
}
const kinds = marks => [...new Set(marks.map(m => `${m.side} ${m.kind}`))].sort();
// The kinds of fire a view drew 2.6 s into the volley (our pulse, both torpedoes, the beam) and 3.2 s in (the raider's
// pulse), together.
async function kindsOverVolley(page, view) {
  await page.evaluate(() => DemoFire.hold(2.6));
  const early = await drawn(page, view);
  await page.evaluate(() => DemoFire.hold(3.2));
  const late = await drawn(page, view);
  return kinds([...early, ...late]);
}
const EVERY_KIND = ['hostile pulse', 'hostile torpedo', 'other beam', 'ours pulse', 'ours torpedo'];
const sides = marks => [...new Set(marks.map(m => m.side))].sort();

run({
  'Helm: a test volley shows the hostile torpedo closing on our ship, our fire and the others\' on the LRS and the SRS': async ({ open }) => {
    const page = await open('/Helm/index.html?fire=0');
    await fireVolley(page);
    assert.deepEqual(await kindsOverVolley(page, 'helm'), EVERY_KIND, 'every kind of fire on the LRS');
    await page.locator('.scan-tabs [data-mode="SRS"]').click();
    assert.deepEqual(await kindsOverVolley(page, 'helm'), EVERY_KIND, 'every kind of fire on the SRS');
    await page.evaluate(() => DemoFire.hold(2.6));
    const map = await page.locator('#map').evaluate(c => ({ w: c.clientWidth, h: c.clientHeight }));
    const early = (await drawn(page, 'helm')).find(m => m.id.endsWith('raider-torpedo'));
    assert.ok(early && early.x > 0 && early.x < map.w && early.y > 0 && early.y < map.h, 'the hostile torpedo is on the SRS');
    // Later in the volley the hostile torpedo is nearer our ship, at the centre of the scan.
    await page.evaluate(() => DemoFire.hold(5));
    const late = (await drawn(page, 'helm')).find(m => m.id.endsWith('raider-torpedo'));
    const centre = { x: map.w / 2, y: map.h / 2 }, gap = m => Math.hypot(m.x - centre.x, m.y - centre.y);
    assert.ok(late && gap(late) < gap(early) / 2, `the torpedo closed from ${gap(early)} px to ${late && gap(late)} px`);
    assert.ok(early.y < centre.y, 'the volley lies ahead of us (up on the heading-up scan)');
  },
  'Navigation: the map draws the volley around our ship': async ({ open }) => {
    const page = await open('/Navigation/index.html?fire=0');
    await page.waitForFunction(() => typeof NavigationControl === 'object');
    await fireVolley(page);
    assert.deepEqual(await kindsOverVolley(page, 'navigation'), EVERY_KIND);
  },
  'View Screen: the forward scope and both scanners draw the volley': async ({ open }) => {
    const page = await open('/ViewScreen/?models=0&fire=0');
    await fireVolley(page);
    assert.deepEqual(await kindsOverVolley(page, 'view-scope'), EVERY_KIND, 'every kind of fire on the scope');
    const scope = await drawn(page, 'view-scope');
    const width = await page.evaluate(() => innerWidth), height = await page.evaluate(() => innerHeight);
    for (const m of scope.filter(m => m.kind === 'torpedo')) assert.ok(m.x > 0 && m.x < width && m.y > 0 && m.y < height, `${m.id} is on the scope`);
    assert.ok((await drawn(page, 'view-srs')).length >= 4, 'the SRS scanner draws it');
    assert.ok((await drawn(page, 'view-lrs')).length >= 4, 'the LRS scanner draws it');
  },
  'EPW and Torpedo Launch: the target acquisition scope adds the hostile\'s and the other ships\' fire to its own shots': async ({ open }) => {
    for (const route of ['/PhaseCannon/?models=0&fire=0', '/TorpedoLaunch/?models=0&fire=0']) {
      const page = await open(route);
      await fireVolley(page);
      assert.deepEqual(await kindsOverVolley(page, 'scope'), ['hostile pulse', 'hostile torpedo', 'other beam'], `${route}: the others' fire, not ours twice`);
      const marks = await drawn(page, 'scope');
      const width = await page.evaluate(() => innerWidth);
      const torpedo = marks.find(m => m.kind === 'torpedo');
      assert.ok(torpedo.x > width * 0.25 && torpedo.x < width * 0.75, `${route}: the hostile torpedo is in front of the scope`);
      await page.close();
    }
  },
  'Tactical Officer and Fighter: their scanners and Fighter\'s scope add the fire they do not draw themselves': async ({ open }) => {
    const tactical = await open('/TacticalOfficer/?fire=0');
    await fireVolley(tactical);
    assert.deepEqual(sides(await drawn(tactical, 'tactical')), ['other'], 'Tactical adds the other ships\' exchange');
    await tactical.locator('.scan-tabs [data-mode="LRS"]').click();
    assert.deepEqual(sides(await drawn(tactical, 'tactical')), ['other'], 'and on its LRS');
    const fighter = await open('/Fighter/?models=0&fire=0');
    await fireVolley(fighter);
    assert.deepEqual(sides(await drawn(fighter, 'fighter-srs')), ['hostile', 'other'], 'Fighter\'s SRS');
    assert.deepEqual(sides(await drawn(fighter, 'scope')), ['hostile', 'other'], 'Fighter\'s scope');
  },
});
