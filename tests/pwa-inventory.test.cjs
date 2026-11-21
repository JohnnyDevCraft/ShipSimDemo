// The demo inventory is the one list the station picker, the precache list and the PWA tests read.
// It must name exactly the demos the landing page links and the quick switch offers.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const inventoryFile = path.join(root, 'demo-app/pwa/inventory.json');

function quickSwitchDivisions() {
  const source = fs.readFileSync(path.join(root, 'demo-app/static-src/Shared/quick-switch.js'), 'utf8');
  const sandbox = { document: { readyState: 'loading', addEventListener() {} }, location: { pathname: '/' } };
  vm.runInNewContext(`${source}\nthis.result = QuickSwitch;`, sandbox);
  return sandbox.result.divisions;
}

function landingPageFolders() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  return [...html.matchAll(/href="([A-Za-z]+)\/index\.html"/g)].map(match => match[1]);
}

test('the inventory lists every demo the landing page links, each with an existing index.html and a quick-switch division', () => {
  assert.ok(fs.existsSync(inventoryFile), 'demo-app/pwa/inventory.json exists');
  const inventory = JSON.parse(fs.readFileSync(inventoryFile, 'utf8'));
  const demos = inventory.demos;
  assert.equal(demos.length, 23, 'all 23 demos');

  const folders = demos.map(demo => demo.folder);
  assert.equal(new Set(folders).size, folders.length, 'no folder twice');
  assert.deepEqual([...folders].sort(), [...new Set(landingPageFolders())].sort(), 'same demos as the landing page');

  const divisions = quickSwitchDivisions();
  const switchFolders = divisions.flatMap(division => division.consoles.map(entry => entry[0]));
  assert.deepEqual([...folders].sort(), [...switchFolders].sort(), 'same demos as the quick switch');

  for (const demo of demos) {
    assert.ok(fs.existsSync(path.join(root, demo.folder, 'index.html')), `${demo.folder}/index.html exists`);
    assert.equal(demo.url, `../${demo.folder}/index.html`, `${demo.folder} url`);
    const division = divisions.find(entry => entry.consoles.some(item => item[0] === demo.folder));
    assert.equal(demo.division, division.name, `${demo.folder} is in ${division.name}`);
    assert.equal(demo.technology, 'static', `${demo.folder} is a static page`);
    assert.ok(demo.title && demo.identify && demo.identify.selector, `${demo.folder} has a title and an identifying element`);
    assert.ok(Array.isArray(demo.sharedScripts) && demo.sharedScripts.length > 0, `${demo.folder} lists its shared scripts`);
    for (const script of demo.sharedScripts) {
      assert.ok(fs.existsSync(path.join(root, script)), `${demo.folder}: ${script} exists`);
    }
    assert.deepEqual(demo.onlineDependencies, [], `${demo.folder} needs no outside server`);
  }
});
