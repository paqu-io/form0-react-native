import test from 'node:test';
import assert from 'node:assert/strict';
import { createFormEngine } from 'form0-core';
import {
  addRepeatableInstanceToState,
  buildRepeatableParentValues,
  getRepeatableInstance,
  getRepeatableInstances,
  removeRepeatableInstanceFromState,
  setRepeatableInstancesInState,
  updateRepeatableInstanceInState,
} from '../src/utils/repeatable-state.js';

const nestedRepeatableSchema = {
  form: {
    name: 'Gingerello',
    elements: [
      makeTextField({
        key: 'root-text',
        label: 'Text field',
        data_name: 'text_field',
      }),
      makeRepeatableSection({
        key: 'repeatable-key',
        label: 'Repeatable',
        data_name: 'repeatable',
        elements: [
          makeTextField({
            key: 'repeatable-text',
            label: 'Text field',
            data_name: 'text_field_2',
          }),
          makeNumericField({
            key: 'repeatable-number',
            label: 'Numeric field',
            data_name: 'numeric_field',
          }),
          makeCalculatedField({
            key: 'repeatable-calculated',
            label: 'Calculated field',
            data_name: 'calculated_field',
            calculate: '$numeric_field+55',
          }),
          makeRepeatableSection({
            key: 'child-repeatable-key',
            label: 'Repeatable',
            data_name: 'repeatable_2',
            elements: [
              makeNumericField({
                key: 'child-repeatable-number',
                label: 'Numeric field',
                data_name: 'numeric_field_2',
              }),
              makeCalculatedField({
                key: 'child-repeatable-calculated',
                label: 'Calculated field',
                data_name: 'calculated_field_2',
                calculate: '$calculated_field+$numeric_field_2',
              }),
            ],
          }),
        ],
      }),
    ],
  },
};

function makeTextField(overrides = {}) {
  return {
    key: overrides.key || 'text-field',
    type: 'TextField',
    label: overrides.label || 'Text field',
    display: 'default',
    pattern: null,
    visible: true,
    required: false,
    data_name: overrides.data_name || 'text_field',
    read_only: false,
    description: null,
    default_value: null,
    description_mode: null,
    supporting_image: false,
    visible_conditions: null,
    pattern_description: null,
    required_conditions: null,
    read_only_conditions: null,
    supporting_image_path: null,
    supporting_image_display: null,
    ...overrides,
  };
}

function makeNumericField(overrides = {}) {
  return {
    key: overrides.key || 'numeric-field',
    type: 'NumericField',
    label: overrides.label || 'Numeric field',
    format: 'integer',
    display: 'default',
    visible: true,
    required: false,
    data_name: overrides.data_name || 'numeric_field',
    read_only: false,
    description: null,
    default_value: null,
    description_mode: null,
    supporting_image: false,
    visible_conditions: null,
    required_conditions: null,
    read_only_conditions: null,
    supporting_image_path: null,
    supporting_image_display: null,
    min: null,
    max: null,
    ...overrides,
  };
}

function makeCalculatedField(overrides = {}) {
  return {
    key: overrides.key || 'calculated-field',
    type: 'CalculatedField',
    label: overrides.label || 'Calculated field',
    display: {
      style: 'text',
    },
    visible: true,
    required: false,
    calculate: overrides.calculate || '0',
    data_name: overrides.data_name || 'calculated_field',
    read_only: true,
    description: null,
    description_mode: null,
    supporting_image: false,
    visible_conditions: null,
    supporting_image_path: null,
    supporting_image_display: null,
    ...overrides,
  };
}

function makeRepeatableSection(overrides = {}) {
  return {
    key: overrides.key || 'repeatable-section',
    type: 'RepeatableSection',
    label: overrides.label || 'Repeatable',
    display: 'drilldown',
    visible: true,
    data_name: overrides.data_name || 'repeatable',
    description: null,
    description_mode: null,
    location_enabled: false,
    location_required: false,
    visible_conditions: null,
    elements: overrides.elements || [],
    ...overrides,
  };
}

test('repeatable state helpers create, update, and remove nested instances immutably', () => {
  const parentInstance = {
    id: 'parent-1',
    values: {
      text_field_2: 'Parent one',
      numeric_field: 10,
      calculated_field: 65,
    },
    repeatable: {},
  };
  const childInstance = {
    id: 'child-1',
    values: {
      numeric_field_2: 7,
      calculated_field_2: 72,
    },
    repeatable: {},
  };

  const withParent = addRepeatableInstanceToState({}, 'repeatable', parentInstance, []);
  assert.equal(getRepeatableInstances(withParent, 'repeatable').length, 1);
  assert.deepEqual(getRepeatableInstance(withParent, 'repeatable', 'parent-1')?.values, parentInstance.values);

  const withChild = addRepeatableInstanceToState(withParent, 'repeatable_2', childInstance, [
    { key: 'repeatable', id: 'parent-1' },
  ]);
  assert.equal(
    getRepeatableInstances(withChild, 'repeatable_2', [{ key: 'repeatable', id: 'parent-1' }]).length,
    1,
  );

  const updatedChild = updateRepeatableInstanceInState(
    withChild,
    'repeatable_2',
    'child-1',
    (current) => ({
      ...current,
      values: {
        ...current.values,
        numeric_field_2: 9,
        calculated_field_2: 74,
      },
    }),
    [{ key: 'repeatable', id: 'parent-1' }],
  );
  assert.equal(
    getRepeatableInstance(updatedChild, 'repeatable_2', 'child-1', [
      { key: 'repeatable', id: 'parent-1' },
    ])?.values?.numeric_field_2,
    9,
  );

  const replacedParentList = setRepeatableInstancesInState(updatedChild, 'repeatable', [parentInstance], []);
  assert.equal(getRepeatableInstances(replacedParentList, 'repeatable').length, 1);

  const withoutChild = removeRepeatableInstanceFromState(updatedChild, 'repeatable_2', 'child-1', [
    { key: 'repeatable', id: 'parent-1' },
  ]);
  assert.equal(
    getRepeatableInstances(withoutChild, 'repeatable_2', [{ key: 'repeatable', id: 'parent-1' }]).length,
    0,
  );
});

test('nested repeatable parent values include the live unsaved parent calculation inputs', () => {
  const rootValues = {
    text_field: 'Root value',
  };

  const initialParentEngine = createFormEngine({
    schema: nestedRepeatableSchema,
    initialValues: {
      ...rootValues,
      text_field_2: 'Parent',
      numeric_field: 10,
    },
  });
  initialParentEngine.eval();
  assert.equal(initialParentEngine.getState().values.calculated_field, 65);

  const liveParentState = {
    repeatable: [
      {
        id: 'parent-1',
        values: {
          text_field_2: 'Parent',
          numeric_field: 20,
          calculated_field: 75,
        },
        repeatable: {},
      },
    ],
  };

  const childBaseValues = buildRepeatableParentValues({
    seedValues: rootValues,
    repeatableState: liveParentState,
    path: [{ key: 'repeatable', id: 'parent-1' }],
  });

  assert.equal(childBaseValues.numeric_field, 20);
  assert.equal(childBaseValues.calculated_field, 75);

  const childEngine = createFormEngine({
    schema: nestedRepeatableSchema,
    initialValues: {
      ...childBaseValues,
      numeric_field_2: 7,
    },
  });
  childEngine.eval();

  assert.equal(
    childEngine.getState().values.calculated_field_2,
    82,
    'The nested child calculation should use the live parent calculated value, not the last saved snapshot',
  );
});
