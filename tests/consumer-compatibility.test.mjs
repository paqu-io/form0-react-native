import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_SPECS, getBuiltinDefinitions, createRecordEvaluator } from 'form0-core';
import {
  BUILTIN_CASES,
  SPECIAL_BUILTINS,
  FIELD_CASES,
  fixtureFieldTypes,
  builtinFixture,
  fieldFixture,
} from './fixtures/consumer-compatibility.js';
test('consumer audit manifest covers the installed core builtin and field catalogs', () => {
  assert.deepEqual(
    [...BUILTIN_CASES.map(([name]) => name), ...Object.keys(SPECIAL_BUILTINS)].sort(),
    getBuiltinDefinitions()
      .map((x) => x.name)
      .sort()
  );
  assert.deepEqual(Object.keys(FIELD_CASES).sort(), Object.keys(FIELD_SPECS).sort());
  assert.deepEqual(
    fixtureFieldTypes(fieldFixture(FIELD_SPECS).schema),
    Object.keys(FIELD_SPECS).sort(),
    'Every field type must occur in the actual schema'
  );
});
for (const security of [undefined, { mode: 'safe' }])
  test(`Native environment catalog conformance ${security?.mode || 'trusted'}`, async () => {
    const fixture = builtinFixture(FIELD_SPECS);
    const result = await createRecordEvaluator({
      schema: fixture.schema,
      security,
      diagnostics: { console: false },
    }).evaluate(fixture.snapshot);
    for (const [name, , expected] of BUILTIN_CASES)
      assert.deepEqual(result.snapshot.values['builtin_' + name.toLowerCase()], expected, name);
    const fields = fieldFixture(FIELD_SPECS);
    const prepared = await createRecordEvaluator({
      schema: fields.schema,
      security,
      diagnostics: { console: false },
    }).prepareSubmission(fields.snapshot);
    assert.equal(prepared.status, 'ready');
  });
