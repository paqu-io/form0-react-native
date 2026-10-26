import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createRecordEvaluator } from 'form0-core';
import {
  instrumentRecordEvaluator,
  createPhaseDiagnosticEntry,
} from '../scripts/prepare-device-phase-profile.mjs';
import { profilePreparation } from './device/preparation-profile.js';
import { field, repeatable } from './fixtures/diagnostic-conformance.js';

const sourceURL = new URL('./engine/record-evaluator.js', import.meta.resolve('form0-core'));
const source = await readFile(sourceURL, 'utf8');
const instrumented = instrumentRecordEvaluator(source);
const portable = instrumented.replace(
  /from '([^']+)'/g,
  (_, relative) => `from '${new URL(relative, sourceURL).href}'`
);
const { createRecordEvaluator: phaseFactory } = await import(
  'data:text/javascript,' + encodeURIComponent(portable)
);
const fixture = (invalid) => ({
  schema: {
    form: {
      name: 'Phase equivalence',
      elements: [
        field('NumericField', 'tax', { format: 'float' }),
        field('CalculatedField', 'grand', { calculate: "REPEATABLESUM($lines, 'total')" }),
        repeatable('lines', [
          field('NumericField', 'amount'),
          field('CalculatedField', 'total', { calculate: '$amount * (1 + $tax)' }),
        ]),
      ],
      events: {
        code: `ON('validate-repeatable', 'lines', function () {
          if ($amount > ${invalid ? 150 : 1000}) INVALID('Amount too large');
        });`,
      },
    },
  },
  snapshot: {
    values: { tax: 0.2, grand: 330 },
    repeatable: {
      lines: [
        { id: 0, values: { amount: 100, total: 110 }, attachments: [{ id: 0, path: 'a.jpg' }] },
        { id: 'B', values: { amount: 200, total: 220 }, custom: { accepted: true } },
      ],
    },
    updated_at_server: '2026-10-01T00:00:00Z',
  },
});

test('phase generation fails explicitly when candidate source anchors change', () => {
  assert.throws(() => instrumentRecordEvaluator('unrecognized source'), /anchor changed/);
  assert.throws(() => instrumentRecordEvaluator(source + source), /anchor changed/);
});

test('native production diagnostic stays bundled and initializes only when requested', async () => {
  let requires = 0;
  const context = vm.createContext({
    process: { env: { NODE_ENV: 'production' } },
    require(specifier) {
      requires++;
      assert.equal(specifier, './diagnostic-core-20261026/src/engine/record-evaluator.js');
      return { createRecordEvaluator: phaseFactory };
    },
  });
  vm.runInContext(createPhaseDiagnosticEntry('fixture-hash'), context);
  assert.equal(vm.runInContext('typeof location', context), 'undefined');
  assert.equal(requires, 0);
  const loaded = await context.__form0DevicePhaseDiagnostic.load();
  assert.equal(requires, 1);
  assert.equal(loaded.createRecordEvaluator, phaseFactory);
  assert.equal(context.__form0DevicePhaseDiagnostic.loading, 'bundled-require');
});

for (const security of [undefined, { mode: 'safe' }])
  for (const invalid of [false, true])
    test(`diagnostic phases preserve full results in ${security?.mode || 'trusted'}, invalid=${invalid}`, async () => {
      const { schema, snapshot } = fixture(invalid);
      const before = structuredClone(snapshot);
      const calls = new Map();
      const observer = {
        start(name) {
          const entry = calls.get(name) || { starts: 0, ends: 0 };
          calls.set(name, entry);
          entry.starts++;
          return () => {
            entry.ends++;
          };
        },
      };
      const control = createRecordEvaluator({ schema, security });
      const diagnostic = phaseFactory({ schema, security, __phaseObserver: observer });
      for (let attempt = 0; attempt < 2; attempt++) {
        const expected = await control.prepareSubmission(snapshot, { managedEvents: true });
        const actual = await diagnostic.prepareSubmission(snapshot, { managedEvents: true });
        assert.deepEqual(actual, expected);
        assert.equal(actual.status, invalid ? 'blocked' : 'ready');
        assert.equal(actual.snapshot.values.grand, 360);
      }
      assert.deepEqual(snapshot, before);
      assert.equal(calls.get('managedContextAndRegistration').starts, 6);
      for (const [name, entry] of calls) assert.equal(entry.starts, entry.ends, name);
    });

test('device report separates an instrumented warm probe from uninstrumented controls', async () => {
  const { schema, snapshot } = fixture(false);
  const result = await profilePreparation({ schema, snapshot, instrumentedFactory: phaseFactory });
  assert.equal(result.samples.length, 4);
  assert.equal(result.phaseProbe.instrumented, true);
  assert.equal(result.phaseProbe.phases.managedContextAndRegistration.calls, 3);
  assert.equal(result.phaseProbe.phases.calculations.calls, 1);
  assert.equal('snapshot' in result.phaseProbe, false);
  for (const phase of Object.values(result.phaseProbe.phases)) {
    assert.ok(phase.activeMs >= 0);
    assert.ok(phase.yieldWaitMs >= 0);
  }
});
