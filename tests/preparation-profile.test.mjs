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

test('production comparison retains three warm samples for each managed-events setting', async () => {
  const schema = {
    form: { name: 'Repeated profile', elements: [field('NumericField', 'amount')] },
  };
  const snapshot = { values: { amount: 0 } };
  const result = await profilePreparation({ schema, snapshot, warmSamples: 3 });
  assert.equal(result.samples.length, 8);
  for (const managed of [false, true])
    assert.deepEqual(
      result.samples
        .filter((sample) => sample.managedEvents === managed)
        .map(({ temperature, sample }) => [temperature, sample]),
      [
        ['cold', 0],
        ['warm', 1],
        ['warm', 2],
        ['warm', 3],
      ]
    );
  assert.equal(result.phaseProbe, null);
  assert.deepEqual(snapshot, { values: { amount: 0 } });
});

test('profile rejects an unbounded repeat count', async () => {
  await assert.rejects(profilePreparation({ warmSamples: 1000 }), /between 1 and 3/);
});
