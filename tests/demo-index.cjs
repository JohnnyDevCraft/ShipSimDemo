// The demo index is how a visitor reaches each console.
const { run, expect } = require('./browser-harness.cjs');

run({
  'the demo index opens Navigation Control': async ({ open }) => {
    const page = await open('/index.html');
    await page.getByRole('link', { name: /Navigation Control/ }).click();
    await expect(page).toHaveTitle(/Navigation Control/);
    await expect(page.locator('#odName')).toHaveText('Gliese 1061');
  },
  'the demo index lists Battery Control beside Reactor Control and opens it': async ({ open }) => {
    const page = await open('/index.html');
    const cards = page.locator('nav[aria-label="Bridge demos"] a strong');
    await expect(cards.nth(3)).toHaveText(/^Battery Control/);
    await expect(cards.nth(2)).toHaveText(/^Reactor Control/);
    await page.getByRole('link', { name: /Battery Control/ }).click();
    await expect(page).toHaveTitle(/Battery Control/);
    await expect(page.locator('.title-pill')).toHaveText('BATTERY CONTROL');
  },
});
