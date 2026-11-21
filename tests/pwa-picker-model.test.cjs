// The station picker's logic, without Angular: the station list and the offline status line.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compileTs } = require('./pwa-compile.cjs');

const SRC = 'demo-app/projects/station-picker/src/app';
const inventory = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../demo-app/pwa/inventory.json'), 'utf8'));

test('the picker lists all 23 demos grouped by division', () => {
  const { groupStations } = compileTs(`${SRC}/picker/picker-model.ts`);
  const groups = groupStations(inventory);
  assert.deepEqual(groups.map(group => group.division), ['Command', 'Engineering', 'Science', 'Tactical', 'Piloting'], 'quick-switch order');
  assert.equal(groups.flatMap(group => group.stations).length, 23);
  const piloting = groups.find(group => group.division === 'Piloting');
  assert.deepEqual(piloting.stations.map(station => station.folder), ['Helm', 'Navigation', 'Fighter']);
  assert.deepEqual(piloting.stations[0], { folder: 'Helm', name: 'Helm Control', blurb: piloting.stations[0].blurb, href: '../Helm/index.html' });
});

test('the status shows progress, then Offline ready only when the worker reports complete, and the failure reason with Retry otherwise', () => {
  const { describeOffline } = compileTs(`${SRC}/offline/offline-status-model.ts`);
  const base = { version: 'v1', total: 56, totalBytes: 202_000_000, errors: [] };

  const preparing = describeOffline({ supported: true, status: { ...base, state: 'preparing', done: 10, bytes: 50_500_000 } });
  assert.equal(preparing.tone, 'busy');
  assert.equal(preparing.title, 'Preparing offline');
  assert.equal(preparing.detail, '10 of 56 files · 50.5 of 202.0 MB');
  assert.equal(preparing.hint, 'Keep this screen open until Offline ready');
  assert.equal(preparing.retry, false);

  const almost = describeOffline({ supported: true, status: { ...base, state: 'preparing', done: 55, bytes: 201_000_000 } });
  assert.notEqual(almost.title, 'Offline ready', 'never ready before the worker says complete');

  const ready = describeOffline({ supported: true, status: { ...base, state: 'complete', done: 56, bytes: 202_000_000 } });
  assert.equal(ready.tone, 'ok');
  assert.equal(ready.title, 'Offline ready');
  assert.equal(ready.hint, null);

  const failed = describeOffline({ supported: true, status: { ...base, state: 'failed', done: 3, bytes: 1_000_000, errors: [{ url: '/ShipSimDemo/models/mars-surface.glb', reason: 'QuotaExceededError: The quota has been exceeded.' }] } });
  assert.equal(failed.tone, 'error');
  assert.equal(failed.title, 'Preparation failed');
  assert.equal(failed.detail, 'QuotaExceededError: The quota has been exceeded. (models/mars-surface.glb)');
  assert.equal(failed.retry, true);

  assert.equal(describeOffline({ supported: true, status: null }).title, 'Setting up offline use');
  assert.equal(describeOffline({ supported: true, status: null, error: 'install failed: x' }).retry, true, 'a failed install offers Retry');
  assert.equal(describeOffline({ supported: false, status: null }).title, 'Offline use is not available in this browser');
});
