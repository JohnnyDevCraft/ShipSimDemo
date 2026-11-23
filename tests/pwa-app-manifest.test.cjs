// The built app (Demo/app/) is installable: one web app manifest with the right scope and icons, and the iOS
// meta tags for Add to Home Screen. Reads the build output, so run `node scripts/build-pwa.cjs` first.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = path.resolve(process.env.DEMO_ROOT || path.resolve(__dirname, '..'), 'app');

function pngSize(file) {
  const header = fs.readFileSync(file);
  assert.equal(header.subarray(1, 4).toString(), 'PNG', `${path.basename(file)} is a PNG`);
  return [header.readUInt32BE(16), header.readUInt32BE(20)];
}

test('the built app has a valid installable manifest with 192, 512 and maskable icons and iOS meta', () => {
  const html = fs.readFileSync(path.join(app, 'index.html'), 'utf8');
  assert.match(html, /<base href="\/ShipSimDemo\/app\/" ?\/?>/);
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest" ?\/?>/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon-180\.png" ?\/?>/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes" ?\/?>/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="MPS Demos" ?\/?>/);
  assert.match(html, /<meta name="theme-color" content="#02070f" ?\/?>/);

  const manifest = JSON.parse(fs.readFileSync(path.join(app, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'Mission Protocol Demos');
  assert.equal(manifest.short_name, 'MPS Demos');
  assert.equal(manifest.id, '/ShipSimDemo/app/');
  assert.equal(manifest.start_url, '/ShipSimDemo/app/');
  assert.equal(manifest.scope, '/ShipSimDemo/');
  assert.ok(manifest.start_url.startsWith(manifest.scope), 'start_url inside the scope');
  assert.equal(manifest.display, 'fullscreen', 'the installed app asks for fullscreen (card #25)');
  assert.equal(manifest.display_override, undefined, 'no display_override: display alone carries the mode');
  assert.equal(manifest.orientation, 'landscape');
  assert.ok(manifest.background_color && manifest.theme_color);
  assert.notEqual(manifest.prefer_related_applications, true);

  const icon = (size, purpose) => manifest.icons.find(entry => entry.sizes === size && (entry.purpose || 'any').split(' ').includes(purpose));
  for (const [size, purpose] of [['192x192', 'any'], ['512x512', 'any'], ['512x512', 'maskable']]) {
    const entry = icon(size, purpose);
    assert.ok(entry, `${purpose} ${size} icon listed`);
    assert.deepEqual(pngSize(path.join(app, entry.src)).join('x'), size, `${entry.src} is really ${size}`);
  }
  assert.deepEqual(pngSize(path.join(app, 'icons/apple-touch-icon-180.png')), [180, 180]);
});
