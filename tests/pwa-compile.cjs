// Compiles a framework-free TypeScript module (worker core, picker logic) to a temporary CommonJS module with
// esbuild, so the Node tests can load it without a TypeScript test runner (ANALYSIS-012).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const esbuild = process.env.ESBUILD || path.resolve(root, '../ng-app/node_modules/esbuild/bin/esbuild');

function compileTs(relativeFile) {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mps-ts-')), path.basename(relativeFile).replace(/\.ts$/, '.cjs'));
  execFileSync(esbuild, [path.join(root, relativeFile), '--bundle', '--format=cjs', '--platform=node', '--target=es2022', `--outfile=${out}`, '--log-level=warning'], { stdio: ['ignore', 'inherit', 'inherit'] });
  return require(out);
}

module.exports = { compileTs };
