// The enemy ship's AI and the hit sounds (MissionProtocol 1.0.0-Beta13 and Beta14, John 2026-11-12): the duel's enemy answers a hail from
// Communications — asked to withdraw it agrees, holds fire and flies off, and every tab follows; asked to hold fire it holds fire; and the
// battle pages play the shield-hit sound when our ship is hit, with a Sound switch in the menu.
const assert = require('node:assert/strict');
const { run, expect } = require('./browser-harness.cjs');

const typeKeys = async (page, dialog, text) => {
  for (const key of text) await page.locator(`${dialog} .search-keys [data-key="${key === ' ' ? 'SPACE' : key}"]`).first().click();
};
async function hail(page, words) {
  await page.locator('#frequenciesBtn').click();
  const card = page.locator('#frequencyList .frequency', { hasText: 'Black Pearl (ZLX-01A)' });
  await expect(card.locator('small')).toHaveText('SUBSPACE · SHIP IN RANGE · ASH CORSAIRS');
  await card.click();
  await page.locator('#saveComm').click();
  await expect(page.locator('#commChat')).toBeVisible();
  await page.locator('#messageInput').click();
  await typeKeys(page, '#commChat', words);
  await page.locator('#commChat .search-keys [data-key="DONE"]').click();
  await page.locator('#sendMessage').click();
}
const enemy = page => page.evaluate(() => {
  const ship = DemoBattle.ships()[0];
  return ship && { truce: ship.truce, km: Math.hypot(ship.x, ship.y + 14000) / 1000, centreKm: Math.hypot(ship.x, ship.y) / 1000, speed: ship.speed, plans: DemoBattle.enemy?.truce?.kind ?? null };
});

run({
  'hailed, the enemy agrees to withdraw: it holds fire and flies away from our ship, on every tab': async ({ open }) => {
    const helm = await open('/Helm/');
    await helm.evaluate(() => DemoBattle.addEnemy());
    const before = await enemy(helm);
    assert.equal(before.truce, null);
    const comms = await open('/Communications/');
    await hail(comms, 'WITHDRAW NOW');
    await expect(comms.locator('#conversation .bubble', { hasText: 'We hold fire and withdraw to our nearest base' })).toBeVisible({ timeout: 5000 });
    // Helm, in its own tab, follows: the enemy is withdrawing, and a few seconds later it is farther off and moving away.
    await expect.poll(async () => (await enemy(helm)).truce).toBe('withdraw');
    await helm.waitForTimeout(3000);
    const later = await enemy(helm);
    assert.ok(later.km > before.km + 0.1, `withdrew from ${before.km.toFixed(2)} km to ${later.km.toFixed(2)} km`);
    assert.ok(later.speed > 50, `moving off at ${later.speed} m/s`);
    // No new fire either way once the truce holds.
    const shots = await helm.evaluate(() => { const t = DemoBattle.now(); return DemoBattle.shots(t).filter(s => s.t0 > t - 1).length; });
    assert.equal(shots, 0);
    // Withdrawn, it is no longer offered as a ship in range.
    await comms.locator('#commsDialog [data-close]').last().click();
    await comms.locator('#frequenciesBtn').click();
    await expect(comms.locator('#frequencyList .frequency', { hasText: 'Black Pearl' })).toHaveCount(0);
  },
  'asked to hold fire it holds fire where it is; other words are refused': async ({ open }) => {
    const helm = await open('/Helm/');
    await helm.evaluate(() => DemoBattle.addEnemy());
    const comms = await open('/Communications/');
    await hail(comms, 'SURRENDER');
    await expect(comms.locator('#conversation .bubble', { hasText: 'Withdraw, or we keep firing.' })).toBeVisible({ timeout: 5000 });
    assert.equal((await enemy(helm)).truce, null);
    await comms.locator('#messageInput').click();
    await typeKeys(comms, '#commChat', 'CEASE FIRE');
    await comms.locator('#commChat .search-keys [data-key="DONE"]').click();
    await comms.locator('#sendMessage').click();
    await expect(comms.locator('#conversation .bubble', { hasText: 'We hold fire for thirty minutes.' })).toBeVisible({ timeout: 5000 });
    await expect.poll(async () => (await enemy(helm)).truce).toBe('hold');
    assert.ok((await enemy(helm)).centreKm < 11.5, 'it stays on its weave (about 11 km round its point), not flying off');
  },
  'our ship hit: the shield-hit sound plays, and the menu turns sound off': async ({ open }) => {
    const helm = await open('/Helm/');
    await helm.mouse.click(5, 5);
    await helm.evaluate(() => DemoBattle.addEnemy());
    await expect.poll(() => helm.evaluate(() => DemoSound.played), { timeout: 40000 }).toBeGreaterThan(0);
    await helm.locator('#menuBtn').click();
    const sound = helm.locator('#menuMain [data-demo-sound]');
    await expect(sound.locator('b')).toHaveText('Turn sound off');
    await sound.click();
    await expect(sound.locator('b')).toHaveText('Turn sound on');
    assert.equal(await helm.evaluate(() => DemoSound.on), false);
    assert.equal(await helm.evaluate(() => DemoSound.hit('shield')), false);
  },
});
