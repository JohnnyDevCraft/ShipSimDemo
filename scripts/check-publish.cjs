// Checks a publish tree (the ShipSimDemo working copy) before it goes to GitHub Pages (ANALYSIS-019, 028).
//   node scripts/check-publish.cjs <target>
// Fails, listing every problem, when the tree holds private source, breaks a GitHub Pages limit, makes the public
// root installable, lacks the app, or has a worker or precache list that does not match its files.
const fs = require('node:fs');
const path = require('node:path');
const { buildManifest, workerVersion, MANIFEST, WORKER } = require('./build-pwa.cjs');

const SITE_LIMIT = 1024 * 1024 * 1024;
const FILE_LIMIT = 100 * 1024 * 1024;
const PRIVATE = ['demo-app', 'scripts/library-from-seed.cjs', 'tests/artifacts', 'artifacts'];

function walk(dir, relative = '', files = []) {
  for (const entry of fs.readdirSync(path.join(dir, relative), { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (!relative && (entry.name === '.git' || entry.name === '.devcraft' || entry.name === '.claude')) continue; // not published content
    if (entry.isDirectory()) walk(dir, name, files);
    else if (entry.isFile()) files.push({ name, bytes: fs.statSync(path.join(dir, name)).size });
  }
  return files;
}

function checkPublish(target) {
  const root = path.resolve(target);
  const problems = [];
  for (const item of PRIVATE) {
    if (fs.existsSync(path.join(root, item))) problems.push(`private: ${item} must not be published`);
  }
  const files = walk(root);
  const total = files.reduce((sum, file) => sum + file.bytes, 0);
  if (total >= SITE_LIMIT) problems.push(`size: ${(total / 1e6).toFixed(1)} MB is over GitHub Pages' 1 GB site limit`);
  for (const file of files) {
    if (file.bytes > FILE_LIMIT) problems.push(`size: ${file.name} is over GitHub's 100 MB file limit`);
    const hidden = file.name.split('/').find(segment => segment.startsWith('_') || (segment.startsWith('.') && segment !== '.gitignore'));
    if (hidden) problems.push(`jekyll: ${file.name} has a segment "${hidden}" that GitHub Pages would not publish`);
  }
  const rootPage = path.join(root, 'index.html');
  if (fs.existsSync(rootPage) && /rel=["']?manifest/.test(fs.readFileSync(rootPage, 'utf8'))) problems.push('root: index.html links a manifest, so the public root would be installable');
  for (const needed of ['app/index.html', 'app/manifest.webmanifest', MANIFEST, WORKER]) {
    if (!fs.existsSync(path.join(root, needed))) problems.push(`app: ${needed} is missing`);
  }
  if (fs.existsSync(path.join(root, MANIFEST)) && fs.existsSync(path.join(root, WORKER))) {
    const listed = JSON.parse(fs.readFileSync(path.join(root, MANIFEST), 'utf8'));
    const stamp = workerVersion(fs.readFileSync(path.join(root, WORKER), 'utf8'));
    if (stamp !== listed.version) problems.push(`worker: sw.js is stamped ${stamp}, the precache list is ${listed.version}`);
    const actual = buildManifest(root, { inventory: null });
    if (JSON.stringify(actual) !== JSON.stringify(listed)) problems.push('worker: the precache list does not match the files in the tree');
    const named = [...listed.core, ...listed.heavy].map(entry => entry.url.replace(/^\/ShipSimDemo\//, ''));
    const wrong = named.filter(name => /^(scripts|tests)\//.test(name) || /(^|\/)README\.md$/.test(name));
    if (wrong.length) problems.push(`worker: the precache list names ${wrong.join(', ')}`);
  }
  return { problems, total, files: files.length };
}

module.exports = { checkPublish };

if (require.main === module) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node scripts/check-publish.cjs <target>');
    process.exit(2);
  }
  const { problems, total, files } = checkPublish(target);
  problems.forEach(problem => console.error(`FAIL ${problem}`));
  if (problems.length) process.exit(1);
  console.log(`publish tree ok: ${files} files, ${(total / 1e6).toFixed(1)} MB, no private source, root not installable, worker matches its list`);
}
