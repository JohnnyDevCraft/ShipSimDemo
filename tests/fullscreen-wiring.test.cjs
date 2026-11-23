// Every demo console offers "Enter Fullscreen" in its menu through one shared script (card #25 correction).
//   node --test tests/fullscreen-wiring.test.cjs
// The wiring is checked here without a browser: the readable source exists, every demo page loads the minified
// script right after the quick switch (both fill the same #menuMain), and the inventory lists it, so the precache
// manifest and the offline app carry it too.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'demo-app/pwa/inventory.json'), 'utf8'));
const SCRIPT = 'Shared/fullscreen.js';

test('the fullscreen menu script has a readable source and a published build', () => {
  assert.ok(fs.existsSync(path.join(root, 'demo-app/static-src', SCRIPT)), `demo-app/static-src/${SCRIPT} exists`);
  assert.ok(fs.existsSync(path.join(root, SCRIPT)), `${SCRIPT} is built`);
});

test('every demo page loads the fullscreen menu script after the quick switch', () => {
  assert.equal(inventory.demos.length, 23);
  for (const demo of inventory.demos) {
    const html = fs.readFileSync(path.join(root, demo.folder, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script src="\.\.\/(Shared\/[\w-]+\.js)(?:\?[^"]*)?"/g)].map(match => match[1]);
    const at = scripts.indexOf(SCRIPT);
    assert.ok(at >= 0, `${demo.folder} loads ${SCRIPT}`);
    assert.equal(scripts.indexOf(SCRIPT, at + 1), -1, `${demo.folder} loads ${SCRIPT} once`);
    assert.ok(at > scripts.indexOf('Shared/quick-switch.js'), `${demo.folder} loads ${SCRIPT} after the quick switch`);
    assert.match(html, /id="menuMain"/, `${demo.folder} has the shared menu`);
  }
});

test('the inventory lists the fullscreen menu script for every demo', () => {
  for (const demo of inventory.demos) {
    assert.ok(demo.sharedScripts.includes(SCRIPT), `${demo.folder} lists ${SCRIPT}`);
  }
});
