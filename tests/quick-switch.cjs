// Quick switch: every console's menu lists the five divisions; a division opens an overlay with its consoles, and a
// console there opens in the same tab.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const DIVISIONS = {
  command: ['Command', 'ViewScreen', 'Communications'],
  engineering: ['Reactor', 'Battery', 'PowerDistribution', 'LifeSupport', 'DotBay', 'Docking', 'WarpField'],
  science: ['Science', 'Transporter', 'CargoBay', 'TractorBeam'],
  tactical: ['TacticalOfficer', 'Shields', 'TorpedoAssembly', 'TorpedoLaunch', 'PhaseCannon', 'PhaserArray'],
  piloting: ['Helm', 'Navigation', 'Fighter'],
};

async function openDivision(page, division) {
  await page.locator('#menuBtn').click();
  await expect(page.locator('#menuDialog')).toHaveJSProperty('open', true);
  await page.locator(`#menuMain .qs-menu button[data-division="${division}"]`).click();
  await expect(page.locator('#quickSwitch')).toHaveJSProperty('open', true);
  await expect(page.locator('#menuDialog')).toHaveJSProperty('open', false);
}

run({
  'Battery Control: Tactical lists its six consoles and opens Shield System Control in this tab': async ({ open, context }) => {
    const page = await open('/Battery/');
    await page.locator('#menuBtn').click();
    await expect(page.locator('#menuMain .qs-menu h3')).toHaveText('QUICK SWITCH');
    await expect(page.locator('#menuMain .qs-menu button b')).toHaveText(['Command', 'Engineering', 'Science', 'Tactical', 'Piloting']);
    await expect(page.locator('#menuMain .qs-menu button.qs-current')).toHaveAttribute('data-division', 'engineering');
    await page.locator('#menuDialog [data-close]').last().click();
    await openDivision(page, 'tactical');
    await expect(page.locator('#quickSwitchTitle')).toHaveText('TACTICAL');
    await expect(page.locator('#quickSwitch .qs-list [data-console]')).toHaveCount(6);
    await expect(page.locator('#quickSwitch .qs-here')).toHaveCount(0);
    await page.locator('#quickSwitch a[data-console="Shields"]').click();
    await expect(page).toHaveTitle(/Shield System Control/);
    assert.equal(context.pages().length, 1, 'the console opened in the same tab');
  },
  'Helm Control: Piloting marks Helm as here; the Engineering tab opens Reactor Control': async ({ open }) => {
    const page = await open('/Helm/index.html');
    await openDivision(page, 'piloting');
    await expect(page.locator('#quickSwitch .qs-here')).toHaveAttribute('data-console', 'Helm');
    await expect(page.locator('#quickSwitch .qs-here em')).toHaveText('YOU ARE HERE');
    await expect(page.locator('#quickSwitch a[data-console]')).toHaveCount(2);
    await page.locator('#quickSwitch .qs-tabs button[data-division="engineering"]').click();
    await expect(page.locator('#quickSwitch .qs-tabs button[data-division="engineering"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#quickSwitchTitle')).toHaveText('ENGINEERING');
    await page.locator('#quickSwitch a[data-console="Reactor"]').click();
    await expect(page).toHaveTitle(/Reactor Control/);
  },
  'the overlay closes from its close button and from the backdrop': async ({ open }) => {
    const page = await open('/Shields/');
    await openDivision(page, 'science');
    await page.locator('#quickSwitch .mhead button').click();
    await expect(page.locator('#quickSwitch')).toHaveJSProperty('open', false);
    await openDivision(page, 'science');
    await page.mouse.click(8, 8);
    await expect(page.locator('#quickSwitch')).toHaveJSProperty('open', false);
  },
  'Command Control on a phone: the overlay fits and its consoles can be reached': async ({ open }) => {
    const page = await open('/Command/');
    await page.setViewportSize({ width: 360, height: 640 });
    await openDivision(page, 'engineering');
    const fits = await page.locator('#quickSwitch').evaluate(d => { const b = d.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight; });
    assert.ok(fits, 'the overlay is inside the window');
    await page.locator('#quickSwitch a[data-console="WarpField"]').scrollIntoViewIfNeeded();
    await page.locator('#quickSwitch a[data-console="WarpField"]').click();
    await expect(page).toHaveTitle(/Warp Field Control/);
  },
  'every console has the switch and is listed, marked here, in its own division': async ({ open }) => {
    for (const [division, folders] of Object.entries(DIVISIONS))
      for (const folder of folders) {
        const page = await open(`/${folder}/`);
        await expect(page.locator('#menuMain .qs-menu button')).toHaveCount(5);
        await page.evaluate(key => QuickSwitch.open(key), division);
        await expect(page.locator('#quickSwitch .qs-list [data-console]')).toHaveCount(folders.length);
        await expect(page.locator('#quickSwitch .qs-here'), folder).toHaveAttribute('data-console', folder);
        for (const other of folders.filter(f => f !== folder))
          await expect(page.locator(`#quickSwitch a[data-console="${other}"]`)).toHaveAttribute('href', `../${other}/index.html`);
        await page.close();
      }
  },
});
