// Minifies the readable sources of the plain HTML demos into the public folders:
// demo-app/static-src/<Page>/<file>.js -> <Page>/<file>.js
// A source named <file>.bundle.js is bundled with what it imports (three.js, from demo-app/render-deps) into
// <Page>/<file>.js; every other source is minified on its own.
// The sources stay in the private demo-app workspace; only the minified files are published.
// esbuild is taken from ESBUILD, or from the simulator workspace's ng-app/node_modules.
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), sources = path.join(root, 'demo-app/static-src');
const bundleModules = path.join(root, 'demo-app/render-deps/node_modules');
const esbuild = process.env.ESBUILD || path.resolve(root, '../ng-app/node_modules/esbuild/bin/esbuild');
if (!fs.existsSync(esbuild)) {
  console.error(`esbuild not found at ${esbuild}. Set ESBUILD to an esbuild binary.`);
  process.exit(1);
}
const check = process.argv.includes('--check');
let stale = 0;
for (const page of fs.readdirSync(sources).filter(name => fs.statSync(path.join(sources, name)).isDirectory())) {
  for (const file of fs.readdirSync(path.join(sources, page)).filter(name => name.endsWith('.js'))) {
    const bundle = file.endsWith('.bundle.js');
    const args = bundle ? ['--bundle', '--minify', '--format=iife', '--target=es2020'] : ['--minify'];
    const minified = execFileSync(esbuild, [...args, path.join(sources, page, file)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, NODE_PATH: bundleModules }, maxBuffer: 64 * 1024 * 1024 });
    const target = path.join(root, page, bundle ? file.replace(/\.bundle\.js$/, '.js') : file);
    const current = fs.existsSync(target) ? fs.readFileSync(target) : null;
    if (current?.equals(minified)) continue;
    stale++;
    if (check) console.error(`STALE ${path.relative(root, target)}`);
    else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, minified);
      console.log(`built ${path.relative(root, target)}`);
    }
  }
}
// With --check nothing is written; the exit code says whether the public files match their sources.
if (check && stale) process.exit(1);
console.log(check ? 'public scripts match their sources' : stale ? `${stale} file(s) written` : 'nothing to build');
