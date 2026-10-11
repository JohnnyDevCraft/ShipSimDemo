// Which functions the shared Selected Destination widget offers on each console.
const test = require('node:test');
const assert = require('node:assert/strict');
const { functionsFor } = require('../demo-app/static-src/Shared/selected-destination.js');

test('the widget offers set and clear on navigation and align on helm', () => {
  assert.deepEqual(functionsFor('navigation', true), { show: true, set: true, clear: true, align: false });
  assert.deepEqual(functionsFor('navigation', false), { show: true, set: true, clear: true, align: false });
  assert.deepEqual(functionsFor('helm', true), { show: true, set: false, clear: false, align: true });
});
