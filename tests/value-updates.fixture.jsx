// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FIELD_SPECS, buildRepeatableMetadata } from 'form0-core';
import { useFormEngine } from '../src/use-form-engine.js';
import { useRepeatableInstanceEngine } from '../src/use-repeatable-instance.js';
import { RecordCoordinatorContext } from '../src/record-context.jsx';
import { createRecordCoordinator } from '../src/utils/record-coordinator.js';
import { auditField } from './fixtures/consumer-compatibility.js';

afterEach(cleanup);
const choices = [
  { value: 'it', label: 'Italy' },
  { value: 'fr', label: 'France' },
];
const f = (type, name, extra = {}) => auditField(FIELD_SPECS, type, name, extra);
const schema = {
  form: {
    name: 'Setter regression',
    elements: [
      f('NumericField', 'width'),
      f('NumericField', 'height'),
      f('CalculatedField', 'area', { calculate: '$width * $height' }),
      f('SingleChoiceField', 'country', { choices }),
      f('MultiChoiceField', 'countries', { choices }),
      f('RepeatableSection', 'rows', {
        elements: [
          f('NumericField', 'quantity'),
          f('SingleChoiceField', 'row_country', { choices }),
          f('CalculatedField', 'row_total', { calculate: '$quantity * $width' }),
        ],
      }),
    ],
  },
};
const seed = { width: 3, height: 10, country: 'it', countries: ['fr'] };
const options = { diagnostics: { console: false } };

for (const security of [undefined, { mode: 'safe' }]) {
  it(`root programmatic updates normalize, calculate once and reject whole invalid batches (${security?.mode || 'trusted'})`, async () => {
    const diagnostics = vi.fn();
    const config = { ...options, security, onDiagnostics: diagnostics };
    const hook = renderHook(() => useFormEngine(schema, seed, undefined, config));
    await waitFor(() => expect(hook.result.current.values.area).toBe(30));
    const count = diagnostics.mock.calls.length;
    act(() =>
      hook.result.current.setValues({ width: 4, height: 5, country: 'fr', countries: ['it'] })
    );
    expect(hook.result.current.values.area).toBe(20);
    expect(hook.result.current.values.country.choice[0].label).toBe('France');
    expect(hook.result.current.values.countries.choices[0].label).toBe('Italy');
    expect(diagnostics.mock.calls.length).toBe(count + 1);
    const before = structuredClone(hook.result.current.values);
    for (const updates of [
      undefined,
      null,
      [],
      { width: 9, typo: 3 },
      { width: 9, country: false },
      { countries: 'it' },
      { country: ['it'] },
      { area: 999 },
      { row_country: 'it' },
    ])
      expect(() => act(() => hook.result.current.setValues(updates))).toThrow(TypeError);
    expect(hook.result.current.values).toEqual(before);
    act(() => hook.result.current.setValue('country', 'xx'));
    expect(hook.result.current.values.country.choice[0].value).toBe('xx');
    expect(hook.result.current.errors.country).toMatch(/invalid value/);
    expect(seed.country).toBe('it');
  });
}

it('readonly setters reject while trusted host overrides preserve accepted calculations', async () => {
  const source = { ...seed, area: 999 };
  const hook = renderHook(
    ({ overrides }) => useFormEngine(schema, source, overrides, options, 'readonly'),
    {
      initialProps: { overrides: { country: 'it' } },
    }
  );
  await waitFor(() => expect(hook.result.current.values.area).toBe(999));
  expect(() => act(() => hook.result.current.setValue('width', 4))).toThrow(TypeError);
  hook.rerender({ overrides: { country: 'fr' } });
  await waitFor(() => expect(hook.result.current.values.country.choice[0].value).toBe('fr'));
  expect(hook.result.current.values.area).toBe(999);
});

it('a row updates only local inputs, preserving ancestor reads and immutable caller metadata', async () => {
  const repInfo = buildRepeatableMetadata(schema.form.elements).repeatableSectionTree.get('rows');
  const initialInstance = { id: 0, values: { quantity: 2, row_country: 'it' }, repeatable: {} };
  const path = [{ repeatableKey: 'rows', instanceId: 0, index: 0, identity: 'id' }];
  const hook = renderHook(() =>
    useRepeatableInstanceEngine({
      schema,
      repInfo,
      baseValues: seed,
      initialInstance,
      diagnosticInstancePath: path,
      options,
    })
  );
  await waitFor(() => expect(hook.result.current.values.row_total).toBe(6));
  act(() => hook.result.current.setValues({ quantity: 4, row_country: 'fr' }));
  expect(hook.result.current.values.row_total).toBe(12);
  expect(hook.result.current.values.row_country.choice[0].label).toBe('France');
  expect(() => act(() => hook.result.current.setValues({ quantity: 9, width: 8 }))).toThrow(
    TypeError
  );
  expect(hook.result.current.values.quantity).toBe(4);
  expect(initialInstance.values.row_country).toBe('it');
});

it('setters exposed on an observed engine use the existing scoped coordinator', async () => {
  const collectionSchema = structuredClone(schema);
  collectionSchema.form.elements.push(
    f('CalculatedField', 'aggregate', { calculate: "REPEATABLESUM($rows, 'quantity')" })
  );
  const coordinator = createRecordCoordinator({
    schema: collectionSchema,
    seed: { values: seed, repeatable: {} },
  });
  let engine;
  const config = {
    ...options,
    onUpdate: (_state, current) => {
      engine = current;
    },
  };
  const wrapper = ({ children }) => (
    <RecordCoordinatorContext.Provider value={coordinator}>
      {children}
    </RecordCoordinatorContext.Provider>
  );
  const hook = renderHook(() => useFormEngine(collectionSchema, seed, undefined, config), {
    wrapper,
  });
  await waitFor(() => expect(hook.result.current.values.area).toBe(30));
  const evaluate = vi.spyOn(coordinator, 'evaluate');
  act(() => engine.setValues({ width: 4, height: 5 }));
  await waitFor(() => expect(hook.result.current.values.area).toBe(20));
  expect(evaluate).toHaveBeenCalledTimes(1);
  coordinator.dispose();
});

it('schema replacement refreshes choice labels and invalidates the previous input type', async () => {
  const hook = renderHook(({ definition }) => useFormEngine(definition, seed, undefined, options), {
    initialProps: { definition: schema },
  });
  await waitFor(() => expect(hook.result.current.values.country.choice[0].label).toBe('Italy'));
  const changed = structuredClone(schema);
  const index = changed.form.elements.findIndex((entry) => entry.data_name === 'country');
  changed.form.elements[index] = f('MultiChoiceField', 'country', {
    choices: [{ value: 'it', label: 'Italia' }],
  });
  hook.rerender({ definition: changed });
  await waitFor(() => expect(hook.result.current.errors.country).toBeTruthy());
  expect(() => act(() => hook.result.current.setValue('country', 'it'))).toThrow(TypeError);
  act(() => hook.result.current.setValue('country', ['it']));
  expect(hook.result.current.values.country.choices[0].label).toBe('Italia');
});

it('legacy operation batches reject a missing target and retain last-write-wins for valid targets', async () => {
  const fixture = structuredClone(schema);
  fixture.form.events = {
    code: "ON('change', 'width', function(){ SETVALUE('width', 9); SETVALUE('', 1); }); ON('change', 'height', function(){ SETVALUE('width', 4); SETVALUE('width', 5); SETVALUE('country', 'it'); SETVALUE('country', 'fr'); });",
  };
  const diagnostics = vi.fn();
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const hook = renderHook(() =>
    useFormEngine(fixture, seed, undefined, { ...options, onDiagnostics: diagnostics })
  );
  try {
    await waitFor(() => expect(hook.result.current.values.area).toBe(30));
    const count = diagnostics.mock.calls.length;
    act(() => hook.result.current.triggerEvent('change', 'width'));
    expect(hook.result.current.values.width).toBe(3);
    expect(diagnostics.mock.calls.length).toBe(count);
    act(() => hook.result.current.triggerEvent('change', 'height'));
    expect(hook.result.current.values.width).toBe(5);
    expect(hook.result.current.values.area).toBe(50);
    expect(hook.result.current.values.country.choice[0].value).toBe('fr');
    expect(diagnostics.mock.calls.length).toBe(count + 1);
  } finally {
    warning.mockRestore();
  }
});
