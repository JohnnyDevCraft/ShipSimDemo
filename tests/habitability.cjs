// The ship lost: once Life Support Control finds the ship can no longer support life, every console shows the
// full-screen NON-HABITABLE notice (Shared/habitability.js), including consoles already open; restarting the
// demo from Life Support Control clears it everywhere. A habitable ship shows no notice.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const CONSOLES = ['Helm', 'Navigation', 'Reactor', 'Battery', 'PowerDistribution', 'Docking', 'LifeSupport', 'Communications', 'Transporter', 'TractorBeam', 'ViewScreen', 'TacticalOfficer', 'TorpedoAssembly', 'TorpedoLaunch', 'PhaseCannon', 'PhaserArray', 'Shields', 'WarpField'];
const lose = page => page.evaluate(() => localStorage.setItem('xmps-demo-habitability', JSON.stringify({ habitable: false, cause: 'Oxygen exhausted', at: Date.now() })));

run({
  'every console shows NON-HABITABLE, covering the screen, once the ship is lost': async ({ open }) => {
    const index = await open('/index.html');
    await lose(index);
    for (const name of CONSOLES) {
      const page = await open(`/${name}/?models=0`);
      const notice = page.locator('#nonHabitable');
      await expect(notice, name).toBeVisible();
      await expect(page.locator('#nonHabitableTitle'), name).toHaveText('NON-HABITABLE');
      await expect(page.locator('#nonHabitableCause'), name).toHaveText('OXYGEN EXHAUSTED');
      const box = await notice.boundingBox(), size = page.viewportSize();
      assert.deepEqual([box.x, box.y, box.width, box.height], [0, 0, size.width, size.height], `${name}: the notice covers the screen`);
      // Only Life Support Control restarts the demo; the others point there.
      if (name === 'LifeSupport') await expect(page.locator('#restartDemo')).toBeVisible();
      else await expect(page.locator('#restartLink'), name).toHaveAttribute('href', '../LifeSupport/index.html');
      await page.close();
    }
  },
  'a habitable ship shows no notice on any console': async ({ open }) => {
    for (const name of CONSOLES) {
      const page = await open(`/${name}/?models=0`);
      await expect(page.locator('#nonHabitable'), name).toBeHidden();
      await page.close();
    }
  },
  'open consoles turn non-habitable the moment Life Support loses the ship, and clear on restart': async ({ open }) => {
    const helm = await open('/Helm/');
    const reactor = await open('/Reactor/');
    const life = await open('/LifeSupport/');
    await expect(helm.locator('#nonHabitable')).toBeHidden();
    await life.evaluate(() => {
      LifeSupport.set({ station: false, plantOn: false });
      LifeSupport.step(610);
    });
    await expect(life.locator('#nonHabitable')).toBeVisible();
    await expect(helm.locator('#nonHabitable')).toBeVisible();
    await expect(reactor.locator('#nonHabitable')).toBeVisible();
    await expect(helm.locator('#nonHabitableCause')).toHaveText('OXYGEN EXHAUSTED');
    await life.locator('#restartDemo').click();
    await expect(helm.locator('#nonHabitable')).toBeHidden();
    await expect(reactor.locator('#nonHabitable')).toBeHidden();
    await expect(life.locator('#state')).toHaveText('HABITABLE');
  },
});
