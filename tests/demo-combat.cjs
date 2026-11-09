// The demo's combat state (Shared/demo-combat.js): every console's menu has Critical damage, where the demo user gives the ship's
// components their critical effects and raises, drains or lowers station shields; every tab sees the same state.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const PAGES = ['Battery', 'CargoBay', 'Command', 'Communications', 'Docking', 'DotBay', 'Fighter', 'Helm', 'LifeSupport', 'Navigation', 'PhaseCannon',
  'PhaserArray', 'PowerDistribution', 'Reactor', 'Shields', 'TacticalOfficer', 'TorpedoAssembly', 'TorpedoLaunch', 'TractorBeam', 'Transporter',
  'ViewScreen', 'WarpField'];

async function openCritical(page) {
  await page.locator('#menuBtn').click();
  await expect(page.locator('#menuDialog')).toHaveJSProperty('open', true);
  await page.locator('#menuMain #openCritical').click();
  await expect(page.locator('#criticalDialog')).toHaveJSProperty('open', true);
}

run({
  'every console page offers Critical damage in its menu, after the quick switch': async ({ open }) => {
    for (const name of PAGES) {
      const page = await open(`/${name}/`);
      await expect(page.locator('#menuMain #openCritical'), name).toHaveCount(1);
      const after = await page.locator('#menuMain #openCritical').evaluate(node => node.previousElementSibling?.classList.contains('qs-menu'));
      assert.ok(after, `${name}: Critical damage follows the quick switch`);
      await page.close();
    }
  },
  'Reactor Control lists its reactor first; an effect set there shows in Battery Control in another tab, and repairs from anywhere': async ({ open }) => {
    const reactor = await open('/Reactor/');
    await openCritical(reactor);
    await expect(reactor.locator('#criticalDialog .dc-comp').first()).toHaveAttribute('data-component', 'reactor');
    const battery = await open('/Battery/');
    await reactor.locator('#criticalDialog [data-component="battery"] button[data-effect="cannot-recharge"]').click();
    await expect(reactor.locator('#criticalDialog [data-component="battery"] button[data-effect="cannot-recharge"]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => battery.evaluate(() => DemoCombat.critical('battery'))).toEqual(['cannot-recharge']);
    assert.equal(await battery.evaluate(() => DemoCombat.banner('battery')), 'CRITICAL: Battery cannot recharge');
    await openCritical(battery);
    await battery.locator('#criticalClear').click();
    await expect.poll(() => reactor.evaluate(() => DemoCombat.critical('battery'))).toEqual([]);
  },
  'Earth Orbital Station starts with its shield raised; draining and lowering it change the live label': async ({ open }) => {
    const page = await open('/Transporter/');
    assert.equal(await page.evaluate(() => DemoCombat.placeShieldText(DemoCombat.placeShield('Earth Orbital Station'))), 'SHIELD UP 100%');
    await openCritical(page);
    const station = page.locator('#criticalDialog [data-place="Earth Orbital Station"]');
    await station.locator('button[data-shield="drain"]').click();
    await expect(station.locator('b')).toHaveText('EARTH ORBITAL STATION · SHIELD DRAINED');
    assert.equal(await page.evaluate(() => DemoCombat.shielded('Earth Orbital Station')), false);
    await page.locator('#criticalDialog [data-place="Earth Orbital Station"] button[data-shield="lower"]').click();
    assert.equal(await page.evaluate(() => DemoCombat.placeShield('Earth Orbital Station')), null);
    await page.locator('#criticalReset').click();
    assert.equal(await page.evaluate(() => DemoCombat.shielded('Earth Orbital Station')), true);
    assert.equal(await page.evaluate(() => DemoCombat.shielded('Cislunar Relay Station')), true, 'the weapon scopes\' relay station starts raised too');
  },
  'a place a page registers is listed in the menu and keeps its starting shield after Reset shields': async ({ open }) => {
    // The weapon scopes register their near places this way (Shared/scope.js); Transporter is a lighter page to drive it from.
    const page = await open('/Transporter/');
    await page.evaluate(() => DemoCombat.registerPlace('Tycho Rock Outpost', false));
    await page.evaluate(() => DemoCombat.registerPlace('Kepler Watch Station', true));
    await openCritical(page);
    await expect(page.locator('#criticalDialog [data-place="Tycho Rock Outpost"]')).toHaveCount(1);
    await expect(page.locator('#criticalDialog [data-place="Kepler Watch Station"] b')).toHaveText('KEPLER WATCH STATION · SHIELD UP 100%');
    await page.locator('#criticalDialog [data-place="Kepler Watch Station"] button[data-shield="lower"]').click();
    assert.equal(await page.evaluate(() => DemoCombat.shielded('Kepler Watch Station')), false);
    await page.locator('#criticalReset').click();
    assert.equal(await page.evaluate(() => DemoCombat.shielded('Kepler Watch Station')), true);
    assert.equal(await page.evaluate(() => DemoCombat.placeShield('Tycho Rock Outpost')), null, 'a place registered lowered starts with no shield up');
  },
});
