// Space dust on the camera scopes (John, 2026-11-03): dust drifts past only while the ship moves at impulse, faster as the
// ship goes faster (never as fast as warp), none at rest or at warp, streaming out from where the ship is heading and in
// toward the centre looking aft. Reads Shared/space-dust.js's record of what each scope drew (SpaceDust.drawn).
const { run } = require('./browser-harness.cjs');

// The dust each scope drew, averaged over `frames` animation frames (a single frame has only a few specks).
async function sample(page, name, frames = 30) {
  return page.evaluate(async ({ name, frames }) => {
    const sum = { dots: 0, level: 0, flow: 0, pixelSpeed: 0, radial: 0, sideways: 0 };
    for (let i = 0; i < frames; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const drawn = SpaceDust.drawn[name];
      for (const key of Object.keys(sum)) sum[key] += drawn[key] / frames;
    }
    return sum;
  }, { name, frames });
}
const settle = page => page.waitForTimeout(1500);
const click = (page, selector) => page.evaluate(selector => document.querySelector(selector).click(), selector);

run({
  'A weapon scope shows dust only while moving, faster as the ship speeds up, streaming out ahead and in astern': async ({ open }) => {
    const page = await open('/TorpedoLaunch/?models=0');
    await page.waitForFunction(() => SpaceDust.drawn.scope);
    await settle(page);
    const rest = await sample(page, 'scope');
    if (rest.dots !== 0 || rest.level !== 0) throw new Error(`dust at rest: ${JSON.stringify(rest)}`);

    await click(page, '[data-ship-speed="2"]');
    await settle(page);
    const slow = await sample(page, 'scope');
    if (!(slow.dots >= 5) || !(slow.level > 0.9)) throw new Error(`no dust at 2 km/s: ${JSON.stringify(slow)}`);
    if (!(slow.radial > 0)) throw new Error(`moving ahead, the dust should stream outward: ${JSON.stringify(slow)}`);

    await click(page, '[data-ship-speed="20"]');
    await settle(page);
    const fast = await sample(page, 'scope');
    if (process.env.DUST_LOG) console.log('     2 km/s', JSON.stringify(slow), '\n     20 km/s', JSON.stringify(fast));
    if (!(fast.flow > slow.flow * 1.2) || !(fast.pixelSpeed > slow.pixelSpeed)) throw new Error(`no faster at 20 km/s: slow ${JSON.stringify(slow)} fast ${JSON.stringify(fast)}`);
    // Not warp: under a third of the screen's width a second on average.
    const width = await page.evaluate(() => innerWidth);
    if (!(fast.pixelSpeed < width / 3)) throw new Error(`full impulse too fast: ${fast.pixelSpeed} px/s on a ${width} px screen`);

    await click(page, '[data-ship-course="180"]');
    await settle(page);
    const astern = await sample(page, 'scope');
    if (!(astern.dots >= 5) || !(astern.radial < 0)) throw new Error(`moving astern, the dust should close in on the centre: ${JSON.stringify(astern)}`);

    await click(page, '[data-ship-course="90"]');
    await settle(page);
    const abeam = await sample(page, 'scope');
    if (!(abeam.sideways < 0) || !(Math.abs(abeam.sideways) > Math.abs(abeam.radial))) throw new Error(`moving to starboard, the dust should slide to the left: ${JSON.stringify(abeam)}`);

    // The dust fades out over about two seconds once the ship is at rest.
    await click(page, '[data-ship-speed="0"]');
    await page.waitForTimeout(3000);
    const stopped = await sample(page, 'scope', 5);
    if (stopped.dots !== 0) throw new Error(`dust after stopping: ${JSON.stringify(stopped)}`);
  },

  'The View Screen shows dust at impulse, flowing in looking aft, and none at warp': async ({ open }) => {
    const page = await open('/ViewScreen/?models=0');
    await page.waitForFunction(() => SpaceDust.drawn['view-scope']);
    const rest = await sample(page, 'view-scope', 5);
    if (rest.dots !== 0) throw new Error(`dust at rest: ${JSON.stringify(rest)}`);

    await click(page, '#demoImpulse');
    await settle(page);
    const ahead = await sample(page, 'view-scope');
    if (!(ahead.dots >= 5) || !(ahead.radial > 0)) throw new Error(`at impulse looking ahead, the dust should stream outward: ${JSON.stringify(ahead)}`);

    await page.evaluate(() => ViewScreenSettings.write({ camera: 180 }));
    await settle(page);
    const aft = await sample(page, 'view-scope');
    if (!(aft.dots >= 5) || !(aft.radial < 0)) throw new Error(`looking aft, the dust should close in on the centre: ${JSON.stringify(aft)}`);

    await click(page, '#demoWarp');
    await settle(page);
    const warp = await sample(page, 'view-scope', 5);
    if (warp.dots !== 0 || warp.level !== 0) throw new Error(`dust at warp: ${JSON.stringify(warp)}`);
  },

  'Fighter Control shows dust while the fighter flies': async ({ open }) => {
    const page = await open('/Fighter/?models=0');
    await page.waitForFunction(() => SpaceDust.drawn.scope);
    await settle(page);
    const rest = await sample(page, 'scope', 5);
    if (rest.dots !== 0) throw new Error(`dust at rest: ${JSON.stringify(rest)}`);
    // Flying ahead along the nose at 1 km/s.
    await page.evaluate(() => {
      const heading = FighterControl.state().heading;
      FighterControl.set({ vx: Math.sin((heading * Math.PI) / 180) * 1000, vz: Math.cos((heading * Math.PI) / 180) * 1000 });
    });
    await settle(page);
    const flying = await sample(page, 'scope');
    if (!(flying.dots >= 5) || !(flying.radial > 0)) throw new Error(`flying ahead, the dust should stream outward: ${JSON.stringify(flying)}`);
  },
});
