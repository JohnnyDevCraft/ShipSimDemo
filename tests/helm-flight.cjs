// Flying is unchanged by the navigation split: the helm still has to be on course, charged and at zero
// impulse to engage warp, and leaving warp discharges the coils.
const { run, expect } = require('./browser-harness.cjs');

run({
  'helm aligns, charges, engages and exits warp as before': async ({ open }) => {
    const page = await open('/Helm/');
    await page.locator('#chargeBtn').click();
    await expect(page.locator('#chargeValue')).toHaveText('100%', { timeout: 15000 });
    await expect(page.locator('#engage')).toBeDisabled();                       // charged, but not on course
    await page.locator('.selected-destination [data-sd-action="align"]').click();
    await expect(page.locator('#lock')).toHaveText('COURSE LOCK', { timeout: 40000 });
    await expect(page.locator('#heading')).toHaveText('047.0');
    await expect(page.locator('#engage')).toBeEnabled();
    await page.locator('#engage').click();
    await expect(page.locator('#state')).toHaveText('AT WARP');
    await expect(page.locator('.selected-destination [data-sd-action="align"]')).toBeDisabled();
    await page.locator('#engage').click();
    await expect(page.locator('#state')).toHaveText('SUBLIGHT');
    await expect(page.locator('#chargeValue')).toHaveText('0%');
    await expect(page.locator('.selected-destination [data-sd="name"]')).toHaveText('Gliese 1061');
  },
});
