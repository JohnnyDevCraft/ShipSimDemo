// Copies the built demo site into a publish target (the ShipSimDemo working copy, or a temporary folder for tests).
//   node scripts/publish-copy.cjs <target>
// The copy list lives here only (ANALYSIS-019). Never copied: demo-app/ (static-src, the worker and picker
// source), scripts/library-from-seed.cjs, tests/artifacts/, artifacts/. The target's README.md, .gitignore and
// dot folders are never touched. Each listed folder is replaced as a whole, so files removed from the build
// (old hashed app files, for example) leave the target too. No git commands are run.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEMO_FOLDERS = require('../demo-app/pwa/inventory.json').demos.map(demo => demo.folder);
const FOLDERS = [...DEMO_FOLDERS, 'Shared', 'Assets', 'models', 'Weapons', 'brand', 'app', 'scripts', 'tests'];
const FILES = ['sw.js', 'index.html', 'favicon.ico'];
const SKIP = new Set(['scripts/library-from-seed.cjs', 'tests/artifacts']);

function copyFolder(source, target, relative) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const name = `${relative}/${entry.name}`;
    if (SKIP.has(name) || entry.name.startsWith('.')) continue;
    const from = path.join(source, entry.name), to = path.join(target, entry.name);
    if (entry.isDirectory()) copyFolder(from, to, name);
    else if (entry.isFile()) fs.copyFileSync(from, to, fs.constants.COPYFILE_FICLONE);
  }
}

function publishCopy(target) {
  const out = path.resolve(target);
  if (out === ROOT || out.startsWith(ROOT + path.sep)) throw new Error('the target must be outside the source Demo folder');
  fs.mkdirSync(out, { recursive: true });
  for (const folder of FOLDERS) {
    const source = path.join(ROOT, folder);
    if (!fs.existsSync(source)) throw new Error(`${folder}/ is missing from the build`);
    fs.rmSync(path.join(out, folder), { recursive: true, force: true });
    copyFolder(source, path.join(out, folder), folder);
  }
  for (const file of FILES) fs.copyFileSync(path.join(ROOT, file), path.join(out, file), fs.constants.COPYFILE_FICLONE);
  return { folders: FOLDERS.length, files: FILES.length };
}

module.exports = { publishCopy, FOLDERS, FILES };

if (require.main === module) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node scripts/publish-copy.cjs <target>');
    process.exit(2);
  }
  try {
    const { folders, files } = publishCopy(target);
    console.log(`copied ${folders} folders and ${files} files into ${path.resolve(target)}`);
  } catch (error) {
    console.error(`publish-copy: ${error.message}`);
    process.exit(1);
  }
}
