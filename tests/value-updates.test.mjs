import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_SPECS } from 'form0-core';
import { auditField } from './fixtures/consumer-compatibility.js';
import { normalizeUpdates, normalizeLoadedValue, scopeFields } from '../src/utils/value-updates.js';
import { normalizeChoiceOperationValue } from '../src/utils/choice-operation-values.js';

const choices = [
  { value: 'it', label: 'Italy' },
  { value: 'fr', label: 'France' },
];
const single = auditField(FIELD_SPECS, 'SingleChoiceField', 'country', {
  choices,
});
const multi = auditField(FIELD_SPECS, 'MultiChoiceField', 'countries', {
  choices,
});
const fields = new Map([
  ['country', single],
  ['countries', multi],
]);

test('Native setters and SETVALUE share strict field shapes and defensive metadata preservation', () => {
  const source = {
    choice: [{ value: 'it', label: 'Italia', extra: { keep: true } }],
    other: [],
    meta: { keep: true },
  };
  const normalized = normalizeUpdates(fields, {
    country: source,
    countries: ['fr'],
  });
  assert.equal(normalized.countries.choices[0].label, 'France');
  assert.deepEqual(normalizeChoiceOperationValue(single, source), source);
  normalized.country.choice[0].extra.keep = false;
  assert.equal(source.choice[0].extra.keep, true);
  for (const invalid of [
    { country: 0 },
    { country: false },
    { country: ['it'] },
    { countries: 'fr' },
    { country: 'it', typo: 1 },
  ])
    assert.throws(() => normalizeUpdates(fields, invalid), TypeError);
  assert.throws(() => normalizeUpdates(fields, { country: 'it' }, 'readonly'), TypeError);
  assert.deepEqual(normalizeLoadedValue(single, { choice: 'invalid' }), {
    choice: 'invalid',
  });
  assert.equal(normalizeLoadedValue(single, 'it').choice[0].label, 'Italy');
});

test('Native ownership lookup excludes ancestors and siblings from row setters', () => {
  const row = auditField(FIELD_SPECS, 'RepeatableSection', 'rows', {
    elements: [multi],
  });
  const schema = { form: { elements: [single, row] } };
  const local = scopeFields(schema, [{ repeatableKey: 'rows' }]);
  assert.equal(local.has('country'), false);
  assert.equal(local.has('countries'), true);
  assert.throws(() => normalizeUpdates(local, { country: 'it' }), TypeError);
  assert.equal(normalizeUpdates(local, { countries: ['it'] }).countries.choices[0].value, 'it');
});
