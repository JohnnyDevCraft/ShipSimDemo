// The demo index is how a visitor reaches each console.
const { run, expect } = require('./browser-harness.cjs');

run({
  'the demo index opens Navigation Control': async ({ open }) => {
    const page = await open('/index.html');
    await page.getByRole('link', { name: /Navigation Control/ }).click();
    await expect(page).toHaveTitle(/Navigation Control/);
    await expect(page.locator('#odName')).toHaveText('Gliese 1061');
  },
  'the demo index lists DOT Bay Control after Life Support Control and opens it': async ({ open }) => {
    const page = await open('/');
    const cards = page.locator('nav[aria-label="Bridge demos"] a strong');
    await expect(cards.nth(7)).toHaveText(/^DOT Bay Control/);
    await page.getByRole('link', { name: /DOT Bay Control/ }).click();
    await expect(page).toHaveTitle(/DOT Bay Control/);
    await expect(page.locator('.cradle')).toHaveCount(4);
  },
  'the demo index lists Cargo Bay after Transporter Control and opens it': async ({ open }) => {
    const page = await open('/');
    const cards = page.locator('nav[aria-label="Bridge demos"] a strong');
    await expect(cards.nth(9)).toHaveText(/^Transporter Control/);
    await expect(cards.nth(10)).toHaveText(/^Cargo Bay/);
    await page.getByRole('link', { name: /Cargo Bay/ }).click();
    await expect(page).toHaveTitle(/Cargo Bay/);
    await expect(page.locator('.title-pill')).toHaveText('CARGO BAY');
  },
  'the demo index lists Command Control after View Screen and opens it': async ({ open }) => {
    const page = await open('/');
    const cards = page.locator('nav[aria-label="Bridge demos"] a strong');
    await expect(cards.nth(14)).toHaveText(/^View Screen/);
    await expect(cards.nth(15)).toHaveText(/^Command Control/);
    await page.getByRole('link', { name: /Command Control/ }).click();
    await expect(page).toHaveTitle(/Command Control/);
    await expect(page.locator('.title-pill')).toHaveText('COMMAND CONTROL');
  },
  'the demo index lists Life Support Control after Docking Control and opens it': async ({ open }) => {
    const page = await open('/');
    const cards = page.locator('nav[aria-label="Bridge demos"] a strong');
    await expect(cards.nth(6)).toHaveText(/^Life Support Control/);
    await page.getByRole('link', { name: /Life Support Control/ }).click();
    await expect(page).toHaveTitle(/Life Support Control/);
    await expect(page.locator('#schematic')).toBeVisible();
  },
  'the demo index lists Docking Control after Power Distribution and opens it': async ({ open }) => {
    const page = await open('/');
    const cards = page.locator('nav[aria-label="Bridge demos"] a strong');
    await expect(cards.nth(4)).toHaveText(/^Power Distribution/);
    await expect(cards.nth(5)).toHaveText(/^Docking Control/);
    await page.getByRole('link', { name: /Docking Control/ }).click();
    await expect(page).toHaveTitle(/Docking Control/);
    await expect(page.locator('#schematic')).toBeVisible();
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
