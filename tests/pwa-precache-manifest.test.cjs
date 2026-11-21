// The precache manifest is the list the service worker downloads: every published file once, with its hash,
// split into the core (installed at once) and the heavy set (models, preloaded afterwards), and nothing private.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const demoRoot = path.resolve(__dirname, '..');
const buildPwa = () => require('../scripts/build-pwa.cjs');

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mps-precache-'));
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

const FIXTURE = {
  'index.html': '<a href="Helm/index.html">Helm</a>',
  'Helm/index.html': '<script src="../Shared/a.js"></script>',
  'Helm/helm.js': 'helm()',
  'Shared/a.js': 'a()',
  'models/big.glb': 'x'.repeat(5000),
  'models/small.glb': 'x'.repeat(10),
  'Weapons/main-ABC.js': 'w()',
  'app/index.html': '<app-root></app-root>',
  'demo-app/static-src/Helm/helm.js': 'secret source',
  'scripts/build.cjs': 'build',
  'tests/a.cjs': 'test',
  'artifacts/shot.png': 'png',
  'README.md': 'readme',
  'Helm/README.md': 'readme',
  '.gitignore': '/demo-app/',
  '.devcraft/x.md': 'x',
  'sw.js': 'worker',
  'app/precache-manifest.json': '{}',
};
const INVENTORY = { demos: [{ folder: 'Helm', sharedScripts: ['Shared/a.js'], pageScripts: ['Helm/helm.js'] }] };

test('the precache manifest lists every published file once, with correct hashes, split into core and heavy, and nothing private', () => {
  const { buildManifest } = buildPwa();
  const dir = fixture(FIXTURE);
  const manifest = buildManifest(dir, { inventory: INVENTORY });
  const urls = [...manifest.core, ...manifest.heavy].map(entry => entry.url);

  assert.deepEqual([...urls].sort(), [
    '/ShipSimDemo/Helm/helm.js', '/ShipSimDemo/Helm/index.html', '/ShipSimDemo/Shared/a.js',
    '/ShipSimDemo/Weapons/main-ABC.js', '/ShipSimDemo/app/index.html', '/ShipSimDemo/index.html',
    '/ShipSimDemo/models/big.glb', '/ShipSimDemo/models/small.glb',
  ]);
  assert.equal(new Set(urls).size, urls.length, 'each file once');
  assert.deepEqual(manifest.heavy.map(entry => entry.url), ['/ShipSimDemo/Weapons/main-ABC.js', '/ShipSimDemo/models/small.glb', '/ShipSimDemo/models/big.glb'], 'heavy = models and Weapons, smallest first');
  for (const entry of [...manifest.core, ...manifest.heavy]) {
    const content = fs.readFileSync(path.join(dir, entry.url.replace('/ShipSimDemo/', '')));
    assert.equal(entry.sha256, crypto.createHash('sha256').update(content).digest('hex'), `${entry.url} hash`);
    assert.equal(entry.bytes, content.length, `${entry.url} size`);
  }

  assert.equal(buildManifest(dir, { inventory: INVENTORY }).version, manifest.version, 'version is stable');
  fs.writeFileSync(path.join(dir, 'Shared/a.js'), 'b()');
  assert.notEqual(buildManifest(dir, { inventory: INVENTORY }).version, manifest.version, 'one changed byte changes the version');

  fs.mkdirSync(path.join(dir, '_x'));
  fs.writeFileSync(path.join(dir, '_x/page.html'), 'hidden by Jekyll');
  assert.throws(() => buildManifest(dir, { inventory: INVENTORY }), /_x\/page\.html/, 'a path GitHub Pages would not publish fails the build by name');
  fs.rmSync(path.join(dir, '_x'), { recursive: true });

  fs.rmSync(path.join(dir, 'Shared/a.js'));
  assert.throws(() => buildManifest(dir, { inventory: INVENTORY }), /Shared\/a\.js/, 'a missing shared script fails the build by name');

  const real = buildManifest(demoRoot);
  const realUrls = new Set([...real.core, ...real.heavy].map(entry => entry.url));
  const inventory = JSON.parse(fs.readFileSync(path.join(demoRoot, 'demo-app/pwa/inventory.json'), 'utf8'));
  for (const demo of inventory.demos) {
    for (const file of [`${demo.folder}/index.html`, ...demo.sharedScripts, ...demo.pageScripts]) {
      assert.ok(realUrls.has(`/ShipSimDemo/${file}`), `real tree covers ${file}`);
    }
  }
  assert.ok(![...realUrls].some(url => /\/(demo-app|scripts|tests|artifacts)\/|README\.md$|\/\.|\/sw\.js$|precache-manifest\.json$/.test(url.replace('/ShipSimDemo', ''))), 'nothing private or excluded');
  assert.ok(real.heavy.length > 0 && real.heavy.every(entry => /^\/ShipSimDemo\/(models|Weapons)\//.test(entry.url)), 'heavy is models and Weapons');
  assert.ok(real.core.every(entry => !/^\/ShipSimDemo\/(models|Weapons)\//.test(entry.url)), 'all models in heavy');
  const mb = list => (list.reduce((sum, entry) => sum + entry.bytes, 0) / 1e6).toFixed(1);
  console.log(`real tree: core ${real.core.length} files ${mb(real.core)} MB, heavy ${real.heavy.length} files ${mb(real.heavy)} MB`);
});

test('changing any published file changes sw.js', () => {
  const { buildManifest, stampWorker } = buildPwa();
  const dir = fixture({ 'index.html': 'root', 'Helm/index.html': 'helm', 'models/a.glb': 'model' });
  const worker = 'const MPS_VERSION = "";\n(() => {})();\n';
  const before = stampWorker(worker, buildManifest(dir, { inventory: null }).version);
  fs.writeFileSync(path.join(dir, 'models/a.glb'), 'model v2');
  const after = stampWorker(worker, buildManifest(dir, { inventory: null }).version);
  assert.notEqual(after, before, 'a changed model changes sw.js');
  fs.writeFileSync(path.join(dir, 'Helm/index.html'), 'helm v2');
  assert.notEqual(stampWorker(worker, buildManifest(dir, { inventory: null }).version), after, 'a changed demo page changes sw.js');
});
