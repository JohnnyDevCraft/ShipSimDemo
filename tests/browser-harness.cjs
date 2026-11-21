// Shared runner for the demo browser tests. Serves the Demo folder on a free local port (or uses
// DEMO_BASE), runs every case in a fresh browser context, in each engine named by ENGINES
// (default "chromium,webkit"), and fails on any page error.
// DEMO_ROOT serves another tree (default this Demo folder) and DEMO_MOUNT serves it under a URL prefix such as
// /ShipSimDemo, as GitHub Pages does. VIEWPORTS (for example 960x600,1280x800) runs every case at each size;
// the default is one 1500x1000 window.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const playwright = require(process.env.PLAYWRIGHT_MODULE || path.resolve(__dirname, '../../ng-app/node_modules/@playwright/test'));
const root = path.resolve(process.env.DEMO_ROOT || path.resolve(__dirname, '..'));
const mount = (process.env.DEMO_MOUNT || '').replace(/\/$/, '');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.webp': 'image/webp' };
const viewports = (process.env.VIEWPORTS || '1500x1000').split(',').map(size => {
  const [width, height] = size.split('x').map(Number);
  return { width, height };
});

// Serves the tree like GitHub Pages: folders answer with their index.html; a mounted tree is served only under its
// prefix. Returns the server; its address gives the port.
function serve({ dir = root, prefix = mount, port = 0, log = null, slowModelsMs = 0 } = {}) {
  const server = http.createServer(async (request, response) => {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    log?.push(pathname);
    if (prefix) {
      if (pathname !== prefix && !pathname.startsWith(prefix + '/')) return response.writeHead(404).end();
      pathname = pathname.slice(prefix.length) || '/';
    }
    let file = path.join(dir, pathname);
    if (!file.startsWith(dir)) return response.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return response.writeHead(404).end();
    if (slowModelsMs && pathname.startsWith('/models/')) await new Promise(resolve => setTimeout(resolve, slowModelsMs)); // a slow venue Wi-Fi
    response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}

// cases: { 'what the user gets': async ({ open, context, base, engine }) => { ... } }
// options.contextOptions are passed to every browser context (for example { serviceWorkers: 'block' }).
async function run(cases, options = {}) {
  const server = process.env.DEMO_BASE ? null : await serve();
  const base = process.env.DEMO_BASE || `http://127.0.0.1:${server.address().port}${mount}`;
  let failed = 0;
  try {
    for (const engine of (process.env.ENGINES || 'chromium,webkit').split(',')) {
      const browser = await playwright[engine].launch();
      try {
        for (const viewport of viewports) for (const [name, body] of Object.entries(cases)) {
          const size = viewports.length > 1 || process.env.VIEWPORTS ? ` ${viewport.width}x${viewport.height}` : '';
          const context = await browser.newContext({ viewport, ...options.contextOptions }), errors = [];
          context.setDefaultTimeout(10000);
          const open = async route => {
            const page = await context.newPage();
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => message.type() === 'error' && errors.push(message.text()));
            await page.goto(base + route);
            return page;
          };
          try {
            await body({ open, context, base, engine, viewport, browser });
            if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
            console.log(`PASS [${engine}${size}] ${name}`);
          } catch (error) {
            failed++;
            console.log(`FAIL [${engine}${size}] ${name}\n     ${String(error.message).split('\n').slice(0, Number(process.env.ERROR_LINES || 6)).join('\n     ')}`);
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

module.exports = { run, serve, root, mount, viewports, playwright, expect: playwright.expect };
