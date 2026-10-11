// Shared runner for the demo browser tests. Serves the Demo folder on a free local port (or uses
// DEMO_BASE), runs every case in a fresh browser context, in each engine named by ENGINES
// (default "chromium,webkit"), and fails on any page error.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const playwright = require(process.env.PLAYWRIGHT_MODULE || path.resolve(__dirname, '../../ng-app/node_modules/@playwright/test'));
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.json': 'application/json' };

function serve() {
  const server = http.createServer((request, response) => {
    let file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!file.startsWith(root)) return response.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return response.writeHead(404).end();
    response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// cases: { 'what the user gets': async ({ open, context, base, engine }) => { ... } }
async function run(cases) {
  const server = process.env.DEMO_BASE ? null : await serve();
  const base = process.env.DEMO_BASE || `http://127.0.0.1:${server.address().port}`;
  let failed = 0;
  try {
    for (const engine of (process.env.ENGINES || 'chromium,webkit').split(',')) {
      const browser = await playwright[engine].launch();
      try {
        for (const [name, body] of Object.entries(cases)) {
          const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } }), errors = [];
          context.setDefaultTimeout(10000);
          const open = async route => {
            const page = await context.newPage();
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => message.type() === 'error' && errors.push(message.text()));
            await page.goto(base + route);
            return page;
          };
          try {
            await body({ open, context, base, engine });
            if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
            console.log(`PASS [${engine}] ${name}`);
          } catch (error) {
            failed++;
            console.log(`FAIL [${engine}] ${name}\n     ${String(error.message).split('\n').slice(0, 6).join('\n     ')}`);
          } finally {
            await context.close();
          }
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    server?.close();
  }
  console.log(failed ? `${failed} failed` : 'all passed');
  process.exit(failed ? 1 : 0);
}

module.exports = { run, expect: playwright.expect };
