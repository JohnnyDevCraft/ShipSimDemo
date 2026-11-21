// Tablet layout report (ANALYSIS-017), report only: for each demo at 960x600 (what an 8-inch 1280x800 Android
// tablet is expected to report) in app mode, whether every control is on screen without clipping or page scrolling,
// and whether Back to stations covers any control. Writes artifacts/pwa/tablet-fit-<engine>.json and one screenshot
// per demo. It never fails the run on a layout finding.
//   DEMO_MOUNT=/ShipSimDemo node tests/pwa-tablet-fit.cjs
const fs = require('node:fs');
const path = require('node:path');
const { playwright } = require('./browser-harness.cjs');
const { siteServer, openStation, screenshotPath, ARTIFACTS } = require('./pwa-journeys-lib.cjs');
const inventory = require('../demo-app/pwa/inventory.json');

const VIEWPORT = { width: 960, height: 600 };

function measure() {
  const scroll = { x: document.scrollingElement.scrollWidth - innerWidth, y: document.scrollingElement.scrollHeight - innerHeight };
  const back = document.getElementById('mpsBackToStations')?.getBoundingClientRect();
  const controls = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="slider"], [role="tab"]')]
    .filter(element => element.id !== 'mpsBackToStations' && !element.closest('#mpsBackToStations') && !element.closest('dialog:not([open])'))
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
  const clipped = [], underBack = [];
  for (const element of controls) {
    const box = element.getBoundingClientRect();
    if ((box.left < -1 || box.top < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1) && !inScroller(element)) clipped.push(label(element));
    // The brand link leads to the picker too, and only its empty stretch lies under the control.
    if (back && !element.matches('.brand') && box.left < back.right && box.right > back.left && box.top < back.bottom && box.bottom > back.top) underBack.push(label(element));
  }
  return { scroll, controls: controls.length, clipped, underBack, back: back && { left: Math.round(back.left), top: Math.round(back.top) } };
}

(async () => {
  const site = await siteServer();
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  try {
    for (const engine of (process.env.ENGINES || 'chromium,webkit').split(',')) {
      const browser = await playwright[engine].launch();
      const context = await browser.newContext({ viewport: VIEWPORT, serviceWorkers: 'block' });
      const page = await context.newPage();
      const rows = [];
      await page.goto(`${site.base}/app/`);
      for (const demo of inventory.demos) {
        try {
          await openStation(page, demo);
          await page.waitForTimeout(1200);
          const result = await page.evaluate(measure);
          const fits = result.scroll.x <= 0 && result.scroll.y <= 0 && result.clipped.length === 0 && result.underBack.length === 0;
          rows.push({ folder: demo.folder, fits, ...result });
          await page.screenshot({ path: screenshotPath(`fit-${demo.folder}-${engine}-960x600`) });
        } catch (error) {
          rows.push({ folder: demo.folder, fits: false, error: String(error.message).split('\n')[0] });
        }
        await page.goto(`${site.base}/app/`);
      }
      fs.writeFileSync(path.join(ARTIFACTS, `tablet-fit-${engine}.json`), JSON.stringify(rows, null, 2));
      for (const row of rows) {
        console.log(`${row.fits ? 'FITS ' : 'CHECK'} [${engine} 960x600] ${row.folder}${row.error ? ` error: ${row.error}` : ''}${row.clipped?.length ? ` clipped: ${row.clipped.join(' | ')}` : ''}${row.underBack?.length ? ` under back: ${row.underBack.join(' | ')}` : ''}${row.scroll && (row.scroll.x > 0 || row.scroll.y > 0) ? ` scrolls ${row.scroll.x}x${row.scroll.y}` : ''}`);
      }
      await browser.close();
    }
  } finally {
    await site.close();
  }
})();
