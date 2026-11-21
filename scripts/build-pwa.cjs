// Builds the installable demo app (the PWA shell around the 23 demo pages).
//   node scripts/build-pwa.cjs             icons → station picker → copy into app/ → worker → precache manifest → stamp sw.js
//   node scripts/build-pwa.cjs --manifest  only writes app/precache-manifest.json and stamps sw.js
//   node scripts/build-pwa.cjs --worker    only bundles the worker into sw.js (then stamps it)
//   node scripts/build-pwa.cjs --icons     only renders the app icons from the brand emblem (macOS sips)
//   node scripts/build-pwa.cjs --check     writes nothing; fails when sw.js or the manifest is out of date
// The precache manifest lists every published file with its SHA-256: `core` is installed at once, `heavy`
// (models/ and Weapons/) is preloaded afterwards. sw.js carries the manifest's version, so any change to a
// published file changes sw.js and reaches installed copies (ANALYSIS-001).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PREFIX = '/ShipSimDemo/';
const MANIFEST = 'app/precache-manifest.json';
const WORKER = 'sw.js';
const VERSION_PATTERN = /const MPS_VERSION = "[0-9a-f]*";/;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
// Never listed: private source, build and test tooling, and the two files that describe the list itself.
const EXCLUDED_TOP = new Set(['demo-app', 'scripts', 'tests', 'artifacts', 'node_modules']);
const HEAVY_TOP = new Set(['models', 'Weapons']);

function publishedFiles(rootDir) {
  const files = [];
  const walk = relative => {
    for (const entry of fs.readdirSync(path.join(rootDir, relative), { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.name.startsWith('.')) continue; // dot files and folders are not published
      if (!relative && EXCLUDED_TOP.has(entry.name)) continue;
      if (entry.isDirectory()) walk(name);
      else if (entry.isFile() && entry.name !== 'README.md' && name !== WORKER && name !== MANIFEST) files.push(name);
    }
  };
  walk('');
  return files.sort();
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function readInventory(rootDir) {
  const file = path.join(rootDir, 'demo-app/pwa/inventory.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

// Pure apart from reading rootDir. Throws, naming the file, when the tree could not be published as is.
function buildManifest(rootDir, { inventory = readInventory(rootDir), prefix = PREFIX } = {}) {
  const files = publishedFiles(rootDir);
  const hidden = files.find(file => file.split('/').some(segment => segment.startsWith('_')));
  if (hidden) throw new Error(`${hidden}: GitHub Pages (Jekyll) does not publish paths with a segment starting "_"`);
  const present = new Set(files);
  for (const demo of inventory?.demos ?? []) {
    for (const needed of [`${demo.folder}/index.html`, ...(demo.sharedScripts ?? []), ...(demo.pageScripts ?? [])]) {
      if (!present.has(needed)) throw new Error(`${needed}: needed by ${demo.folder} but missing from the published tree`);
    }
  }
  const entries = files.map(file => {
    const content = fs.readFileSync(path.join(rootDir, file));
    if (content.length > MAX_FILE_BYTES) throw new Error(`${file}: ${content.length} bytes is over GitHub's 100 MB file limit`);
    return { url: prefix + file, sha256: sha256(content), bytes: content.length, heavy: HEAVY_TOP.has(file.split('/')[0]) };
  });
  const strip = ({ heavy, ...entry }) => entry;
  const core = entries.filter(entry => !entry.heavy).map(strip);
  const heavy = entries.filter(entry => entry.heavy).sort((a, b) => a.bytes - b.bytes || a.url.localeCompare(b.url)).map(strip);
  const version = sha256(JSON.stringify(entries.map(entry => [entry.url, entry.sha256])));
  return { version, core, heavy };
}

function stampWorker(source, version) {
  if (!VERSION_PATTERN.test(source)) throw new Error(`${WORKER} has no MPS_VERSION constant to stamp`);
  return source.replace(VERSION_PATTERN, `const MPS_VERSION = "${version}";`);
}

function workerVersion(source) {
  return source.match(/const MPS_VERSION = "([0-9a-f]*)";/)?.[1] ?? null;
}

const ESBUILD = process.env.ESBUILD || path.resolve(ROOT, '../ng-app/node_modules/esbuild/bin/esbuild');
const APP = path.join(ROOT, 'demo-app');
const WORKER_SOURCE = path.join(APP, 'pwa/worker/sw.ts');
const PICKER_PUBLIC = path.join(APP, 'projects/station-picker/public');
const PICKER_DIST = path.join(APP, 'dist/station-picker/browser');
const CONSOLE_BACKGROUND = '02070f';
const EMBLEM_LARGE = path.join(ROOT, 'brand/xelseor-emblem-1024.png');
const EMBLEM = path.join(ROOT, 'brand/xelseor-emblem.png');

function bundleWorker() {
  return execFileSync(ESBUILD, [WORKER_SOURCE, '--bundle', '--format=iife', '--target=es2020', '--log-level=warning', '--banner:js=const MPS_VERSION = "";'], { stdio: ['ignore', 'pipe', 'inherit'] }).toString();
}

function writeManifestAndStamp(rootDir) {
  const manifest = buildManifest(rootDir);
  fs.mkdirSync(path.dirname(path.join(rootDir, MANIFEST)), { recursive: true });
  fs.writeFileSync(path.join(rootDir, MANIFEST), JSON.stringify(manifest, null, 1) + '\n');
  const workerFile = path.join(rootDir, WORKER);
  fs.writeFileSync(workerFile, stampWorker(fs.readFileSync(workerFile, 'utf8'), manifest.version));
  const mb = list => (list.reduce((sum, entry) => sum + entry.bytes, 0) / 1e6).toFixed(1);
  console.log(`precache list ${manifest.version.slice(0, 12)}: core ${manifest.core.length} files ${mb(manifest.core)} MB, heavy ${manifest.heavy.length} files ${mb(manifest.heavy)} MB`);
}

// Renders the app icons with macOS sips. The 128 px emblem is drawn at no more than twice its size, centred on the
// console background, so it stays sharp and inside the maskable safe zone (ANALYSIS-016).
function renderIcons() {
  const source = fs.existsSync(EMBLEM_LARGE) ? EMBLEM_LARGE : EMBLEM;
  const large = source === EMBLEM_LARGE;
  const out = path.join(PICKER_PUBLIC, 'icons');
  fs.mkdirSync(out, { recursive: true });
  const icons = [
    // [file, canvas, emblem size]
    ['icon-192.png', 192, large ? 160 : 128],
    ['icon-512.png', 512, large ? 440 : 256],
    ['icon-maskable-512.png', 512, large ? 320 : 256],
    ['apple-touch-icon-180.png', 180, large ? 150 : 128],
  ];
  for (const [file, canvas, size] of icons) {
    const target = path.join(out, file);
    execFileSync('sips', ['-s', 'format', 'png', '-z', String(size), String(size), source, '--out', target], { stdio: 'ignore' });
    execFileSync('sips', ['--padToHeightWidth', String(canvas), String(canvas), '--padColor', CONSOLE_BACKGROUND, target], { stdio: 'ignore' });
  }
  console.log(`icons from ${path.relative(ROOT, source)} into ${path.relative(ROOT, out)}`);
}

function buildPicker() {
  execFileSync('npm', ['run', 'build:picker'], { cwd: APP, stdio: 'inherit' });
  const out = path.join(ROOT, 'app');
  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync(PICKER_DIST, out, { recursive: true });
  console.log(`copied ${path.relative(ROOT, PICKER_DIST)} into app/`);
}

function check(rootDir) {
  const problems = [];
  const expected = buildManifest(rootDir);
  const manifestFile = path.join(rootDir, MANIFEST);
  const current = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null;
  if (!current) problems.push(`${MANIFEST} is missing`);
  else if (JSON.stringify(current) !== JSON.stringify(expected)) problems.push(`${MANIFEST} does not match the published files`);
  const workerFile = path.join(rootDir, WORKER);
  const worker = fs.existsSync(workerFile) ? fs.readFileSync(workerFile, 'utf8') : null;
  if (!worker) problems.push(`${WORKER} is missing`);
  else {
    if (workerVersion(worker) !== expected.version) problems.push(`${WORKER} is stamped ${workerVersion(worker)} but the files are version ${expected.version}`);
    if (fs.existsSync(WORKER_SOURCE) && stampWorker(bundleWorker(), expected.version) !== worker) problems.push(`${WORKER} does not match demo-app/pwa/worker`);
  }
  return problems;
}

function main(args, rootDir) {
  if (args.includes('--check')) {
    const problems = check(rootDir);
    problems.forEach(problem => console.error(`STALE ${problem}`));
    if (problems.length) process.exit(1);
    console.log('sw.js and the precache list match the published files');
    return;
  }
  const only = ['--manifest', '--worker', '--icons'].filter(flag => args.includes(flag));
  if (!only.length || only.includes('--icons')) renderIcons();
  if (!only.length) buildPicker();
  if (!only.length || only.includes('--worker')) fs.writeFileSync(path.join(rootDir, WORKER), bundleWorker());
  if (!only.length || only.includes('--manifest') || only.includes('--worker')) writeManifestAndStamp(rootDir);
}

module.exports = { buildManifest, publishedFiles, stampWorker, workerVersion, check, writeManifestAndStamp, PREFIX, MANIFEST, WORKER };

if (require.main === module) {
  try {
    main(process.argv.slice(2), ROOT);
  } catch (error) {
    console.error(`build-pwa: ${error.message}`);
    process.exit(1);
  }
}
