import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

export function runEventReportingTests(FormRenderer, field, repeatable, platform, defaults = {}) {
  let errors;
  beforeEach(() => {
    errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  const choices = [{ value: '1', label: 'One' }];
  const inputs = (prefix = '') => [
    field('NumericField', prefix + 'trigger', { default_value: 0 }),
    field('NumericField', prefix + 'quantity', { default_value: 3 }),
    field('SingleChoiceField', prefix + 'rating', {
      choices,
      allow_other: false,
      is_searchable: false,
      is_searchable_mode: null,
    }),
    field('MultiChoiceField', prefix + 'tags', {
      choices,
      allow_other: false,
      is_searchable: false,
      is_searchable_mode: null,
    }),
    field('CalculatedField', prefix + 'double', { calculate: '$' + prefix + 'quantity * 2' }),
  ];
  async function mount(code, extra = {}, security) {
    let controller;
    const { engineOptions: extraEngineOptions, ...extraProps } = extra;
    const updates = vi.fn();
    const diagnostics = vi.fn();
    const engineOptions = {
      security,
      events: { recordKind: 'existing' },
      diagnostics: { console: false },
      onUpdate: updates,
      onDiagnostics: diagnostics,
      onEventController: (next) => (controller = next),
    };
    const props = {
      schema: {
        form: {
          name: 'Event reporting',
          elements: [...inputs(), repeatable('rows', inputs('row_'))],
          events: { code },
        },
      },
      initialValues: { trigger: 0, quantity: 3 },
      initialSnapshot: {
        raw_values: { trigger: 0, quantity: 3 },
        repeatable: {
          rows: [{ id: 0, values: { row_trigger: 10, row_quantity: 3 }, repeatable: {} }],
        },
      },
      repeatableEntryMode: 'edit',
      engineOptions,
      ...defaults,
      ...extraProps,
    };
    props.engineOptions = { ...engineOptions, ...defaults.engineOptions, ...extraEngineOptions };
    const view = render(<FormRenderer {...props} />);
    await waitFor(() => expect(controller).toBeTruthy());
    return {
      props,
      view,
      updates,
      diagnostics,
      get controller() {
        return controller;
      },
      latest(prefix = '') {
        return updates.mock.calls
          .map(([state]) => state)
          .filter((s) => Object.hasOwn(s.values, prefix + 'trigger'))
          .at(-1);
      },
    };
  }
  const reports = () =>
    errors.mock.calls.filter(([message]) => message.startsWith(`[${platform}] Event`));
  for (const security of [undefined, { mode: 'safe' }]) {
    const mode = security?.mode || 'trusted';
    for (const [target, value, expected] of [
      ['rating', '1', /string ID/],
      ['tags', "'1'", /array of string IDs/],
      ['double', '9', /input field/],
      ['typo', '9', /owned/],
    ]) {
      it(`${platform} reports rejected ${target} once and keeps the operation batch atomic (${mode})`, async () => {
        const fixture = await mount(
          `ON('change', 'trigger', function() { SETVALUE('quantity', 9); SETVALUE('${target}', ${value}); });`,
          {},
          security
        );
        const count = fixture.diagnostics.mock.calls.length;
        await act(async () =>
          fireEvent.change(screen.getByDisplayValue('0'), { target: { value: '2' } })
        );
        await waitFor(() => expect(reports()).toHaveLength(1));
        expect(reports()[0][1]).toMatchObject({
          eventType: 'change',
          fieldKey: 'trigger',
          scope: 'root',
        });
        expect(reports()[0][1].issues[0].message).toMatch(expected);
        expect(fixture.latest().values.quantity).toBe(3);
        expect(fixture.latest().values.double).toBe(6);
        expect(fixture.latest().values.rating.choice).toEqual([]);
        expect(fixture.diagnostics.mock.calls.length).toBe(count + 1);
      });
    }
    it(`${platform} keeps numeric setters numeric and accepts string choice IDs (${mode})`, async () => {
      const fixture = await mount(
        "ON('change', 'trigger', function() { SETVALUE('quantity', 1); SETVALUE('rating', '1'); SETVALUE('tags', ['1']); });",
        {},
        security
      );
      const count = fixture.diagnostics.mock.calls.length;
      await act(async () =>
        fireEvent.change(screen.getByDisplayValue('0'), { target: { value: '2' } })
      );
      await waitFor(() => expect(fixture.latest().values.quantity).toBe(1));
      expect(fixture.latest().values.double).toBe(2);
      expect(fixture.latest().values.rating.choice[0].value).toBe('1');
      expect(fixture.latest().values.tags.choices[0].value).toBe('1');
      expect(fixture.diagnostics.mock.calls.length).toBe(count + 2);
      expect(reports()).toEqual([]);
    });
    it(`${platform} reports failures in a row without writing an ancestor (${mode})`, async () => {
      const fixture = await mount(
        "ON('change', 'row_trigger', function() { SETVALUE('quantity', 9); });",
        {},
        security
      );
      if (platform === 'form0-react-native') fireEvent.click(await screen.findByText('rows'));
      fireEvent.click(await screen.findByRole('button', { name: 'View', exact: true }));
      await act(async () => {});
      fireEvent.click(screen.getAllByRole('button', { name: 'View', exact: true })[0]);
      const rowInput = await screen.findByDisplayValue('10');
      await act(async () => fireEvent.change(rowInput, { target: { value: '11' } }));
      await waitFor(() => expect(reports()).toHaveLength(1));
      expect(reports()[0][1]).toMatchObject({
        eventType: 'change',
        fieldKey: 'row_trigger',
        scope: 'row',
      });
      expect(fixture.latest().values.quantity).toBe(3);
      expect(fixture.latest('row_').values.row_quantity).toBe(3);
    });
  }
  it(`${platform} preserves unknown string selections as ordinary validation data`, async () => {
    const fixture = await mount(
      "ON('change', 'trigger', function() { SETVALUE('rating', 'unknown'); SETVALUE('tags', ['unknown']); });"
    );
    let result;
    await act(async () => {
      result = await fixture.controller.dispatch({ type: 'change', fieldKey: 'trigger' });
    });
    expect(result.status).toBe('completed');
    expect(fixture.latest().values.rating.choice[0].value).toBe('unknown');
    expect(fixture.latest().values.tags.choices[0].value).toBe('unknown');
    expect(fixture.latest().errors.rating).toMatch(/invalid value/i);
    expect(fixture.latest().errors.tags).toMatch(/invalid value/i);
    expect(reports()).toEqual([]);
  });
  it(`${platform} reports initialization failures with their event context`, async () => {
    await mount("ON('load-record', function() { SETVALUE('rating', 1); });");
    expect(reports()).toHaveLength(1);
    expect(reports()[0][1].eventType).toBe('load-record');
  });
  it(`${platform} changes the reporting preference without another evaluation or controller`, async () => {
    const fixture = await mount("ON('change', 'trigger', function() { SETVALUE('rating', 1); });");
    const controller = fixture.controller;
    const count = fixture.diagnostics.mock.calls.length;
    fixture.view.rerender(
      <FormRenderer {...fixture.props} eventDiagnostics={{ failures: false }} />
    );
    expect(fixture.controller).toBe(controller);
    expect(fixture.diagnostics.mock.calls.length).toBe(count);
    await act(async () => controller.dispatch({ type: 'change', fieldKey: 'trigger' }));
    expect(reports()).toEqual([]);
    fixture.view.rerender(<FormRenderer {...fixture.props} />);
    let result;
    await act(async () => {
      result = await controller.dispatch({ type: 'change', fieldKey: 'trigger' });
    });
    expect(result.status).toBe('failed');
    expect(reports()).toHaveLength(1);
  });
  it(`${platform} reports rejected async operation delegation once using the current preference`, async () => {
    let reject;
    const onOperations = vi.fn(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        })
    );
    const fixture = await mount(
      "ON('change', 'trigger', function() { SETVALUE('rating', '1'); });",
      { engineOptions: { onOperations } }
    );
    let pending;
    act(() => {
      pending = fixture.controller.dispatch({ type: 'change', fieldKey: 'trigger' });
    });
    await waitFor(() => expect(onOperations).toHaveBeenCalled());
    fixture.view.rerender(
      <FormRenderer {...fixture.props} eventDiagnostics={{ failures: false }} />
    );
    await act(async () => {
      reject(new Error('Synthetic delegate failure'));
      await pending;
    });
    expect(reports()).toEqual([]);
    onOperations.mockRejectedValueOnce(new Error('Second delegate failure'));
    fixture.view.rerender(<FormRenderer {...fixture.props} />);
    await act(async () => fixture.controller.dispatch({ type: 'change', fieldKey: 'trigger' }));
    expect(reports()).toHaveLength(1);
    expect(reports()[0][1].issues[0].message).toBe('Second delegate failure');
    expect(JSON.stringify(reports())).not.toMatch(/raw_values|repeatable|instanceId|valueToSet/);
  });
  it(`${platform} leaves save preparation failures to the submission reporter`, async () => {
    const onSubmit = vi.fn();
    await mount("ON('save-record', function() { SETVALUE('rating', 1); });", { onSubmit });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Submit/ })));
    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() => expect(errors).toHaveBeenCalledTimes(1));
    expect(errors.mock.calls[0][0]).toBe(`[${platform}] Submit failed during preparation.`);
    expect(reports()).toEqual([]);
  });
  it(`${platform} reports ordinary handler exceptions but keeps INVALID findings quiet`, async () => {
    const fixture = await mount(
      "ON('change', 'trigger', function() { throw new Error('Synthetic handler failure'); }); ON('validate-record', function() { INVALID('Expected business validation'); });",
      { onSubmit: vi.fn() }
    );
    await act(async () => fixture.controller.dispatch({ type: 'change', fieldKey: 'trigger' }));
    expect(reports()).toHaveLength(1);
    expect(reports()[0][1].issues[0].message).toMatch(/Synthetic handler failure/);
    errors.mockClear();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Submit/ })));
    expect(reports()).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
  });
}
