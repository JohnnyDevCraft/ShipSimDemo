// Flying Helm Control: the helm has to be on course, charged and at zero impulse to engage warp, and
// leaving warp discharges the coils. Warp is set in warp factors from 0.25 up to the ship's rating.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

run({
  'helm aligns, charges, engages and exits warp': async ({ open }) => {
    const page = await open('/Helm/');
    await page.locator('#warpTab').click();
    await expect(page.locator('#warpPane')).toBeVisible();
    await expect(page.locator('#impulsePane')).toBeHidden();
    await page.locator('#chargeBtn').click();
    await expect(page.locator('#chargeValue')).toHaveText('100%', { timeout: 15000 });
    await expect(page.locator('#engage')).toBeDisabled(); // charged, but not on course
    await page.locator('#alignBtn').click();
    await expect(page.locator('.heading')).toHaveAttribute('data-lock', 'COURSE LOCK', { timeout: 40000 });
    await expect(page.locator('#headingValue')).toHaveText('047.0°');
    await expect(page.locator('#engage')).toBeEnabled();
    await page.locator('#engage').click();
    await expect(page.locator('#state')).toHaveText('AT WARP');
    await expect(page.locator('#alignBtn')).toBeDisabled();
    await expect(page.locator('#impulse')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('[data-mode="SRS"]').click();
    await expect(page.locator('#srsBlank')).toBeVisible(); // SRS cannot scan at warp
    await page.locator('[data-mode="LRS"]').click();
    await expect(page.locator('#srsBlank')).toBeHidden();
    await page.locator('#engage').click();
    await expect(page.locator('#state')).toHaveText('SUBLIGHT');
    await expect(page.locator('#chargeValue')).toHaveText('0%');
    await expect(page.locator('#targetName')).toHaveText('Gliese 1061');
  },
  'warp factors run from 0.25 to the rating chosen in demo controls': async ({ open }) => {
    const page = await open('/Helm/');
    await page.locator('#warpTab').click();
    const warp = page.locator('#warp');
    await expect(warp).toHaveAttribute('aria-valuemin', '0.25');
    await expect(warp).toHaveAttribute('aria-valuemax', '6');
    await warp.focus();
    await page.keyboard.press('Home');
    await expect(warp).toHaveAttribute('aria-valuenow', '0.25');
    await expect(page.locator('#driveSetting')).toHaveText('WF 0.25');
    await page.keyboard.press('ArrowUp');
    await expect(warp).toHaveAttribute('aria-valuenow', '0.5');
    await expect(page.locator('#demoControls')).toBeHidden(); // demo controls stay behind the menu
    await page.locator('#menuBtn').click();
    await page.locator('#openDemoControls').click();
    await page.locator('#maxWarp [data-warp="8"]').click();
    await page.locator('#menuDialog [data-close]').click();
    await expect(warp).toHaveAttribute('aria-valuemax', '8');
    await expect(page.locator('#tEtaMaxLabel')).toHaveText('ETA (MAX WARP 8)');
    await warp.focus();
    await page.keyboard.press('End');
    await expect(page.locator('#driveSetting')).toHaveText('WF 8.00');
    await expect(page.locator('#tEtaMax')).toBeHidden(); // the warp set is the maximum, so one row says it
  },
  'impulse speeds the ship up and blocks coil charging': async ({ open }) => {
    const page = await open('/Helm/');
    await page.locator('#impulse').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '100');
    await expect(page.locator('#state')).toHaveText('IMPULSE');
    await expect(page.locator('#speed')).not.toHaveText('0 km/s');
    await page.locator('#warpTab').click();
    await expect(page.locator('#chargeBtn')).toBeDisabled();
    await expect(page.locator('#engineNote')).toHaveText(/impulse to zero/);
  },
  'the joystick turns the ship while it is held and eases to a stop': async ({ open }) => {
    const page = await open('/Helm/');
    await page.locator('#joystick').focus();
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(1500);
    assert.notEqual(await page.locator('#knob').evaluate(knob => knob.style.getPropertyValue('--x')), '0px');
    await page.keyboard.up('ArrowRight');
    const heading = parseFloat(await page.locator('#headingValue').innerText());
    assert.ok(heading > 0.5 && heading < 10, `turned to starboard (${heading})`);
    await expect(page.locator('.heading')).toHaveAttribute('data-lock', 'COURSE LOCK', { timeout: 5000 });
    await expect(page.locator('.heading')).toHaveAttribute('data-turn-rate', '0.0');
  },
  'the heading box shows the heading and the joystick, and no status text': async ({ open }) => {
    const page = await open('/Helm/');
    assert.equal((await page.locator('.heading').innerText()).replace(/\s+/g, ' ').trim(), 'HEADING 000.0°');
  },
  'reverse impulse is a toggle on the dock that lights up while on': async ({ open }) => {
    const page = await open('/Helm/');
    const reverse = page.locator('.dock #reverse');
    await expect(reverse).toHaveAttribute('aria-pressed', 'false');
    await reverse.click();
    await expect(reverse).toHaveAttribute('aria-pressed', 'true');
    const lit = await reverse.locator('.ring').evaluate(ring => getComputedStyle(ring).color);
    assert.equal(lit, 'rgb(6, 17, 31)'); // the icon takes the background colour
    await page.locator('#impulse').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#engineNote')).toHaveText('REVERSE IMPULSE');
    await reverse.click();
    await expect(reverse).toHaveAttribute('aria-pressed', 'false');
    assert.equal(await page.locator('#dockDialog #reverse').count(), 0); // no longer in the Docking window
  },
  'the brakes on the dock slow the ship, and Full Stop stops it': async ({ open }) => {
    const page = await open('/Helm/');
    await expect(page.locator('.dock #light')).toBeDisabled(); // nothing to brake yet
    await page.locator('#impulse').focus();
    await page.keyboard.press('End');
    await expect(page.locator('.dock #hard')).toBeEnabled();
    await page.waitForTimeout(1500);
    const moving = parseFloat(await page.locator('#speed').innerText());
    assert.ok(moving > 1, `moving at ${moving} km/s`);
    await page.locator('.dock #stop').click();
    await expect(page.locator('#impulse')).toHaveAttribute('aria-valuenow', '0');
    await expect(page.locator('#speed')).toHaveText('0 km/s', { timeout: 5000 });
    await expect(page.locator('#state')).toHaveText('SUBLIGHT');
  },
});
