// The service worker core: installs the core all or nothing, preloads the heavy set resumably, serves offline,
// and updates without re-downloading unchanged files. Compiled from TypeScript with esbuild and run against
// in-memory Cache API and fetch fakes.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { compileTs } = require('./pwa-compile.cjs');

const { createWorkerCore } = compileTs('demo-app/pwa/worker/worker-core.ts');
const ORIGIN = 'https://johnnydevcraft.github.io';
const SCOPE = '/ShipSimDemo/';
const MANIFEST_URL = `${ORIGIN}${SCOPE}app/precache-manifest.json`;

const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const digest = async buffer => crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');

class FakeCache {
  constructor() { this.map = new Map(); }
  key(request) { return typeof request === 'string' ? request : request.url; }
  async match(request) { const hit = this.map.get(this.key(request)); return hit ? hit.clone() : undefined; }
  async put(request, response) {
    if (this.full) throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
    this.map.set(this.key(request), response.clone());
  }
  async delete(request) { return this.map.delete(this.key(request)); }
  async keys() { return [...this.map.keys()].map(url => new Request(url)); }
}
class FakeCaches {
  constructor() { this.named = new Map(); }
  async open(name) { if (!this.named.has(name)) this.named.set(name, new FakeCache()); return this.named.get(name); }
  async keys() { return [...this.named.keys()]; }
  async delete(name) { return this.named.delete(name); }
}

// A server with files { path: content }, a manifest built from them, and a log of what was downloaded.
function site(files, heavyNames = []) {
  const entries = Object.entries(files).map(([name, content]) => ({ url: SCOPE + name, sha256: sha(content), bytes: Buffer.byteLength(content), heavy: heavyNames.includes(name) }));
  const strip = ({ heavy, ...entry }) => entry;
  const manifest = {
    version: sha(JSON.stringify(entries.map(entry => [entry.url, entry.sha256]))).slice(0, 16),
    core: entries.filter(entry => !entry.heavy).map(strip),
    heavy: entries.filter(entry => entry.heavy).sort((a, b) => a.bytes - b.bytes).map(strip),
  };
  const server = { files: { ...files }, manifest, downloads: [], offline: false, failing: new Set() };
  server.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (server.offline) throw new TypeError('Failed to fetch');
    if (url.origin !== ORIGIN) throw new Error('cross-origin fetch attempted');
    if (url.href.split('?')[0] === MANIFEST_URL) return new Response(JSON.stringify(server.manifest), { headers: { 'content-type': 'application/json' } });
    const name = url.pathname.slice(SCOPE.length);
    server.downloads.push(name);
    if (server.failing.has(name) || !(name in server.files)) return new Response('missing', { status: 404 });
    const type = name.endsWith('.html') ? 'text/html' : name.endsWith('.wav') ? 'audio/wav' : 'application/octet-stream';
    return new Response(server.files[name], { headers: { 'content-type': type } });
  };
  return server;
}

function core(server, caches = new FakeCaches(), version = server.manifest.version) {
  return createWorkerCore({ caches, fetch: server.fetch, digest, version, manifestUrl: MANIFEST_URL, scope: SCOPE, origin: ORIGIN });
}

const request = (path, { mode, ...init } = {}) => {
  const req = new Request(ORIGIN + path, init);
  if (mode === 'navigate') Object.defineProperty(req, 'mode', { value: 'navigate' });
  return req;
};

async function prepareAll(worker) {
  let status;
  do { status = await worker.preloadBatch(); } while (status.state === 'preparing');
  return status;
}

const FILES = {
  'index.html': 'root page',
  'app/index.html': '<app-root>',
  'Helm/index.html': 'helm page',
  'Shared/console.css': 'css',
  'Assets/audio/hit.wav': '0123456789',
  'models/a.glb': 'a'.repeat(100),
  'models/b.glb': 'b'.repeat(200),
  'models/c.glb': 'c'.repeat(300),
  'models/d.glb': 'd'.repeat(400),
  'models/e.glb': 'e'.repeat(500),
  'models/f.glb': 'f'.repeat(600),
};
const HEAVY = ['models/a.glb', 'models/b.glb', 'models/c.glb', 'models/d.glb', 'models/e.glb', 'models/f.glb'];

test('install caches the whole core or fails as a whole', async () => {
  const good = site(FILES, HEAVY);
  const worker = core(good);
  await worker.install();
  assert.deepEqual([...good.downloads].sort(), ['Assets/audio/hit.wav', 'Helm/index.html', 'Shared/console.css', 'app/index.html', 'index.html']);

  const corrupt = site(FILES, HEAVY);
  corrupt.files['Shared/console.css'] = 'tampered';
  const caches = new FakeCaches();
  await assert.rejects(core(corrupt, caches).install(), /console\.css/);
  assert.equal((await core(corrupt, caches).status()).state, 'not-installed', 'a failed install leaves no installed version');

  const other = site(FILES, HEAVY);
  await assert.rejects(core(other, new FakeCaches(), 'another-version').install(), /version/);
});

test('heavy preload resumes from where it stopped and reports complete only when every model is verified', async () => {
  const server = site(FILES, HEAVY);
  const caches = new FakeCaches();
  const first = core(server, caches);
  await first.install();
  await first.activate();
  const before = await first.status();
  assert.equal(before.state, 'preparing');
  assert.equal(before.done, 0);
  assert.equal(before.total, 6);

  const batch = await first.preloadBatch();
  assert.equal(batch.state, 'preparing');
  assert.equal(batch.done, 4, 'one batch is at most four files');
  assert.deepEqual(server.downloads.slice(-4), ['models/a.glb', 'models/b.glb', 'models/c.glb', 'models/d.glb'], 'smallest first');

  // The worker is stopped and started again (a new instance over the same caches): nothing is fetched twice.
  server.downloads = [];
  const again = core(server, caches);
  const status = await prepareAll(again);
  assert.deepEqual(server.downloads, ['models/e.glb', 'models/f.glb']);
  assert.equal(status.state, 'complete');
  assert.equal(status.done, 6);
  assert.equal(status.bytes, status.totalBytes);
});

test('a quota or load failure is reported as failed, never complete', async () => {
  const server = site(FILES, HEAVY);
  const caches = new FakeCaches();
  const worker = core(server, caches);
  await worker.install();
  server.failing.add('models/a.glb');
  const failed = await worker.preloadBatch();
  assert.equal(failed.state, 'failed');
  assert.match(failed.errors[0].reason, /404/);
  assert.equal(failed.errors[0].url, '/ShipSimDemo/models/a.glb');

  server.failing.clear();
  (await caches.open('mps-files')).full = true;
  const quota = await worker.preloadBatch();
  assert.equal(quota.state, 'failed');
  assert.ok(quota.errors.some(error => /QuotaExceededError/.test(error.reason)), 'the quota error is named');
  assert.notEqual((await worker.status()).state, 'complete');

  (await caches.open('mps-files')).full = false;
  assert.equal((await prepareAll(worker)).state, 'complete', 'Retry completes once the cause is gone');
});

test('an update reuses unchanged files without downloading them again and removes only files no version needs', async () => {
  const server = site(FILES, HEAVY);
  const caches = new FakeCaches();
  const v1 = core(server, caches);
  await v1.install();
  await v1.activate();
  await prepareAll(v1);

  const changed = { ...FILES, 'Helm/index.html': 'helm page v2', 'models/f.glb': 'g'.repeat(600) };
  const next = site(changed, HEAVY);
  const v2 = core(next, caches);
  await v2.install();
  assert.deepEqual(next.downloads, ['Helm/index.html'], 'install downloads only the changed core file');
  await v2.activate();
  const status = await v2.status();
  assert.equal(status.state, 'preparing', 'offline readiness is worked out again for the new version');
  assert.equal(status.done, 5);
  await prepareAll(v2);
  assert.deepEqual(next.downloads, ['Helm/index.html', 'models/f.glb']);

  const keys = (await (await caches.open('mps-files')).keys()).map(key => key.url.split('/').pop());
  assert.ok(!keys.includes(sha('helm page')), 'the old Helm page is removed');
  assert.ok(!keys.includes(sha('f'.repeat(600))), 'the old model is removed');
  assert.ok(keys.includes(sha('a'.repeat(100))), 'unchanged files are kept');
  assert.equal(keys.length, Object.keys(changed).length, 'each file stored once');
  const metaKeys = await (await caches.open('mps-meta')).keys();
  assert.equal(metaKeys.length, 1, 'only the active version list is kept');
});

test('versioned asset URLs and folder addresses are served from cache offline, and cross-origin or non-GET requests are never cached', async () => {
  const server = site(FILES, HEAVY);
  const caches = new FakeCaches();
  const worker = core(server, caches);
  await worker.install();
  await worker.activate();
  server.offline = true;

  assert.equal(await (await worker.respond(request('/ShipSimDemo/Shared/console.css?v=3'))).text(), 'css');
  assert.equal(await (await worker.respond(request('/ShipSimDemo/Helm/', { mode: 'navigate' }))).text(), 'helm page');
  assert.equal(await (await worker.respond(request('/ShipSimDemo/app/'))).text(), '<app-root>');
  assert.equal(worker.respond(new Request('https://example.com/ShipSimDemo/Helm/index.html')), null, 'cross-origin passes through');
  assert.equal(worker.respond(request('/ShipSimDemo/Helm/index.html', { method: 'POST', body: 'x' })), null, 'non-GET passes through');
  assert.equal(worker.respond(request('/OtherProject/index.html')), null, 'outside the scope passes through');
  assert.equal(worker.respond(request('/ShipSimDemo/sw.js')), null, 'the worker script itself is never cached');
  assert.equal([...caches.named.keys()].every(name => name.startsWith('mps-')), true, 'only mps- caches');
});

test('an unknown address under /app/ opens the picker', async () => {
  const server = site(FILES, HEAVY);
  const worker = core(server);
  await worker.install();
  await worker.activate();
  server.offline = true;
  const response = await worker.respond(request('/ShipSimDemo/app/no/such/page', { mode: 'navigate' }));
  assert.equal(await response.text(), '<app-root>');
  assert.equal(worker.respond(request('/ShipSimDemo/NoSuchFolder/x.png')), null, 'unknown files outside /app/ go to the network');
});

test('a sound requested in byte ranges is answered with the right slice', async () => {
  const server = site(FILES, HEAVY);
  const worker = core(server);
  await worker.install();
  await worker.activate();
  server.offline = true;
  const part = await worker.respond(request('/ShipSimDemo/Assets/audio/hit.wav', { headers: { range: 'bytes=2-5' } }));
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal(part.headers.get('content-length'), '4');
  assert.equal(part.headers.get('content-type'), 'audio/wav');
  assert.equal(await part.text(), '2345');
  const open = await worker.respond(request('/ShipSimDemo/Assets/audio/hit.wav', { headers: { range: 'bytes=7-' } }));
  assert.equal(await open.text(), '789');
  const outside = await worker.respond(request('/ShipSimDemo/Assets/audio/hit.wav', { headers: { range: 'bytes=20-30' } }));
  assert.equal(outside.status, 416);
});
