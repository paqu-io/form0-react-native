import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildValidationSummary,
  collectValidatableFields,
  getFirstValidationIssue,
  getRepeatableAddLabel,
} from '../src/utils/repeatable-validation.js';

const validationElements = [
  {
    type: 'Section',
    label: 'Main section',
    data_name: 'main_section',
    elements: [
      {
        type: 'TextField',
        label: 'Required text',
        data_name: 'required_text',
      },
      {
        type: 'NumericField',
        label: 'Broken number',
        data_name: 'broken_number',
      },
    ],
  },
  {
    type: 'RepeatableSection',
    label: 'Nested repeatable',
    data_name: 'nested_repeatable',
    elements: [
      {
        type: 'TextField',
        label: 'Nested child text',
        data_name: 'nested_child_text',
      },
    ],
  },
];

test('validation helpers ignore repeatable children by default and return ordered visible issues', () => {
  const fields = collectValidatableFields(validationElements, {
    includeRepeatableChildren: false,
  });

  assert.deepEqual(
    fields.map((field) => field.data_name),
    ['required_text', 'broken_number'],
  );

  const summary = buildValidationSummary(fields, {
    getValue: (field) => {
      if (field.data_name === 'required_text') {
        return '';
      }
      return 12;
    },
    isVisible: (field) => field.data_name !== 'broken_number',
    isRequired: (field) => field.data_name === 'required_text',
    getError: () => null,
  });

  assert.equal(summary.hasErrors, true);
  assert.equal(summary.requiredFieldErrors.length, 1);
  assert.equal(summary.generalErrors.length, 0);
  assert.equal(getFirstValidationIssue(summary)?.fieldName, 'required_text');
});

test('validation helpers block save on engine errors and prefer the displayed issue ordering', () => {
  const fields = collectValidatableFields(validationElements, {
    includeRepeatableChildren: true,
  });

  assert.ok(fields.some((field) => field.data_name === 'nested_child_text'));

  const summary = buildValidationSummary(fields, {
    getValue: (field) => {
      if (field.data_name === 'required_text') {
        return '';
      }
      return 10;
    },
    isVisible: () => true,
    isRequired: (field) => field.data_name === 'required_text',
    getError: (field) =>
      field.data_name === 'broken_number' ? 'Numeric format is invalid' : null,
  });

  assert.equal(summary.hasErrors, true);
  assert.equal(summary.generalErrors[0]?.fieldName, 'broken_number');
  assert.equal(summary.requiredFieldErrors[0]?.fieldName, 'required_text');
  assert.equal(
    getFirstValidationIssue(summary)?.fieldName,
    'required_text',
    'The first invalid field should remain the first visible field in schema order',
  );
});

test('repeatable add label respects schema overrides and otherwise stays generic', () => {
  assert.equal(
    getRepeatableAddLabel({ label: 'Photos', add_label: 'Add photo' }),
    'Add photo',
  );
  assert.equal(getRepeatableAddLabel({ label: 'Rooms' }), 'Add');
  assert.equal(getRepeatableAddLabel({}), 'Add');
});
