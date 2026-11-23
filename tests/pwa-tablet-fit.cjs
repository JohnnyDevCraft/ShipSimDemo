// Tablet layout report (ANALYSIS-017; card #25 ANALYSIS-005/006): for each demo in app mode at each viewport in
// VIEWPORTS (default 960x600, the whole 1280x800 screen of an 8-inch Android tablet at 1.333x, which is what the
// fullscreen app gets, and 1280x800), whether every control is on screen without clipping or page scrolling, whether
// Back to stations covers any control, and which controls lie under the bands where Android draws its system bars
// when the user swipes them in over a fullscreen app (report only: they hide again after about 3 s).
// Writes artifacts/pwa/tablet-fit-<engine>-<WxH>.json and one screenshot per demo and size.
// Report only by default. FIT_STRICT=1 exits non-zero when a demo does not fit (scrolls, clips or hides a control
// under the back control) or the back control is missing or smaller than 44x44, apart from the named EXCLUSIONS.
//   DEMO_MOUNT=/ShipSimDemo VIEWPORTS=960x600,1280x800 FIT_STRICT=1 node tests/pwa-tablet-fit.cjs
const fs = require('node:fs');
const path = require('node:path');
const { playwright } = require('./browser-harness.cjs');
const { siteServer, openStation, screenshotPath, ARTIFACTS } = require('./pwa-journeys-lib.cjs');
const inventory = require('../demo-app/pwa/inventory.json');

const VIEWPORTS = (process.env.VIEWPORTS || '960x600,1280x800').split(',').map(size => {
  const [width, height] = size.split('x').map(Number);
  return { width, height, name: `${width}x${height}` };
});
const STRICT = process.env.FIT_STRICT === '1';
// Nominal heights of Android's status and navigation bars, in CSS px (confirmed on the device, ANALYSIS-011).
const BARS = { top: 24, bottom: 48 };
// Findings accepted under FIT_STRICT, as '<Demo>: <control label>' with the reason.
const EXCLUSIONS = new Map([]);

function measure(bars) {
  const scroll = { x: document.scrollingElement.scrollWidth - innerWidth, y: document.scrollingElement.scrollHeight - innerHeight };
  const back = document.getElementById('mpsBackToStations')?.getBoundingClientRect();
  const controls = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="slider"], [role="tab"]')]
    // Inert controls (a carousel page parked off stage, e.g. Torpedo Assembly's Configure page) cannot be reached
    // until their page is shown, so they are not counted.
    .filter(element => element.id !== 'mpsBackToStations' && !element.closest('#mpsBackToStations') && !element.closest('dialog:not([open])') && !element.closest('[inert]'))
    .filter(element => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0;
    });
  const label = element => (element.getAttribute('aria-label') || element.textContent || element.id || element.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  // A row in a panel that scrolls on its own is reachable by scrolling that panel, so it is not clipped.
  const inScroller = element => {
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY + style.overflowX) && (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth)) return true;
    }
    return false;
  };
  // The part of an element its clipping ancestors (scrolling panels) actually show; null when none of it shows.
  const shownBox = element => {
    let { left, top, right, bottom } = element.getBoundingClientRect();
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      if (getComputedStyle(node).overflow === 'visible') continue;
      const clip = node.getBoundingClientRect();
      left = Math.max(left, clip.left); top = Math.max(top, clip.top); right = Math.min(right, clip.right); bottom = Math.min(bottom, clip.bottom);
    }
    return right > left && bottom > top ? { left, top, right, bottom } : null;
  };
  const clipped = [], underBack = [], underBars = [];
  for (const element of controls) {
    const box = element.getBoundingClientRect();
    if (box.top < bars.top || box.bottom > innerHeight - bars.bottom) underBars.push(label(element));
    if ((box.left < -1 || box.top < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1) && !inScroller(element)) clipped.push(label(element));
    // The brand link leads to the picker too, and only its empty stretch lies under the control.
    // A row scrolled out of view inside its panel is not drawn under the control, so only the shown part counts.
    const shown = shownBox(element);
    if (back && shown && !element.matches('.brand') && shown.left < back.right && shown.right > back.left && shown.top < back.bottom && shown.bottom > back.top) underBack.push(label(element));
  }
  return {
    scroll, controls: controls.length, clipped, underBack, underBars,
    back: back && { left: Math.round(back.left), top: Math.round(back.top), width: Math.round(back.width), height: Math.round(back.height) },
  };
}

// The findings that fail FIT_STRICT for one row, after the named exclusions.
function strictFailures(row) {
  if (row.error) return [`error: ${row.error}`];
  const failures = [];
  if (row.scroll.x > 0 || row.scroll.y > 0) failures.push(`scrolls ${row.scroll.x}x${row.scroll.y}`);
  for (const control of row.clipped) failures.push(`clipped: ${control}`);
  for (const control of row.underBack) failures.push(`under back: ${control}`);
  if (!row.back) failures.push('no back control');
  else if (row.back.width < 44 || row.back.height < 44) failures.push(`back control ${row.back.width}x${row.back.height}`);
  return failures.filter(failure => !EXCLUSIONS.has(`${row.folder}: ${failure.replace(/^(clipped|under back): /, '')}`));
}

(async () => {
  const site = await siteServer();
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  let strictFailed = 0;
  try {
    for (const engine of (process.env.ENGINES || 'chromium,webkit').split(',')) {
      const browser = await playwright[engine].launch();
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, serviceWorkers: 'block' });
        const page = await context.newPage();
        const rows = [];
        await page.goto(`${site.base}/app/`);
        for (const demo of inventory.demos) {
          try {
            await openStation(page, demo);
            await page.waitForTimeout(1200);
            const result = await page.evaluate(measure, BARS);
            const fits = result.scroll.x <= 0 && result.scroll.y <= 0 && result.clipped.length === 0 && result.underBack.length === 0;
            rows.push({ folder: demo.folder, fits, ...result });
            await page.screenshot({ path: screenshotPath(`fit-${demo.folder}-${engine}-${viewport.name}`) });
          } catch (error) {
            rows.push({ folder: demo.folder, fits: false, error: String(error.message).split('\n')[0] });
          }
          await page.goto(`${site.base}/app/`);
        }
        fs.writeFileSync(path.join(ARTIFACTS, `tablet-fit-${engine}-${viewport.name}.json`), JSON.stringify(rows, null, 2));
        for (const row of rows) {
          const failures = strictFailures(row);
          if (STRICT && failures.length) strictFailed++;
          const bars = row.underBars?.length ? ` under bars (report): ${row.underBars.length}` : '';
          console.log(`${row.fits ? 'FITS ' : 'CHECK'} [${engine} ${viewport.name}] ${row.folder}${failures.length ? ` ${failures.join(' | ')}` : ''}${bars}`);
        }
        await context.close();
      }
      await browser.close();
    }
  } finally {
    await site.close();
  }
  if (STRICT) {
    console.log(strictFailed ? `FIT_STRICT: ${strictFailed} demo/size result(s) do not fit` : 'FIT_STRICT: every demo fits');
    process.exit(strictFailed ? 1 : 0);
  }
})();
