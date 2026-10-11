// The demo index is how a visitor reaches each console.
const { run, expect } = require('./browser-harness.cjs');

run({
  'the demo index opens Navigation Control': async ({ open }) => {
    const page = await open('/index.html');
    await page.getByRole('link', { name: /Navigation Control/ }).click();
    await expect(page.locator('header b')).toHaveText('NAVIGATION CONTROL');
    await expect(page.locator('#ownDestination [data-sd="name"]')).toHaveText('Gliese 1061');
  },
});
