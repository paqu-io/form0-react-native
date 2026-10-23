import test from 'node:test';
import assert from 'node:assert/strict';
import { profilePreparation } from './device/preparation-profile.js';
import { field, repeatable } from './fixtures/diagnostic-conformance.js';

test('device profile compares cold/warm managed validation without returning or mutating records', async () => {
  const schema = {
    form: {
      name: 'Profile',
      elements: [
        field('CalculatedField', 'grand', {
          calculate: "REPEATABLESUM($lines, 'total')",
        }),
        repeatable('lines', [field('CalculatedField', 'total', { calculate: '120' })]),
      ],
      events: { code: "ON('validate-repeatable', 'lines', function() {});" },
    },
  };
  const snapshot = {
    values: { grand: 110 },
    repeatable: { lines: [{ id: 0, values: { total: 110 } }] },
  };
  const before = structuredClone(snapshot);
  const result = await profilePreparation({ schema, snapshot });
  assert.deepEqual(snapshot, before);
  assert.deepEqual(
    result.samples.map(({ managedEvents, temperature }) => [managedEvents, temperature]),
    [
      [false, 'cold'],
      [false, 'warm'],
      [true, 'cold'],
      [true, 'warm'],
    ]
  );
  assert.ok(result.timerMeanMs >= 0);
  for (const sample of result.samples) {
    assert.ok(sample.computeMs >= 0);
    assert.ok(sample.yieldWaitMs >= 0);
    assert.equal('snapshot' in sample, false);
    assert.equal('changes' in sample, false);
  }
});

test('device profile honours cancellation before creating an evaluator', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(profilePreparation({ signal: controller.signal }), /cancelled/);
});
