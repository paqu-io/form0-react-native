import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FIELD_SPECS, getBuiltinDefinitions } from 'form0-core';
import {
  builtinFixture,
  fieldFixture,
  attachAuditEvents,
  BUILTIN_CASES,
  SPECIAL_BUILTINS,
  FIELD_CASES,
  fixtureFieldTypes,
} from './fixtures/consumer-compatibility.js';
export function runConsumerCompatibility(FormRenderer, platform) {
  afterEach(cleanup);
  it(`${platform} audit manifest covers both installed catalogs and the actual field schema`, () => {
    expect(
      [...BUILTIN_CASES.map(([name]) => name), ...Object.keys(SPECIAL_BUILTINS)].sort()
    ).toEqual(
      getBuiltinDefinitions()
        .map((x) => x.name)
        .sort()
    );
    expect(Object.keys(FIELD_CASES).sort()).toEqual(Object.keys(FIELD_SPECS).sort());
    expect(fixtureFieldTypes(fieldFixture(FIELD_SPECS).schema)).toEqual(
      Object.keys(FIELD_SPECS).sort()
    );
  });
  for (const security of [undefined, { mode: 'safe' }])
    it(`${platform} closed row INVALID stays scoped and permits a root draft ${security?.mode || 'trusted'}`, async () => {
      const fixture = attachAuditEvents(FIELD_SPECS, builtinFixture(FIELD_SPECS), 'builtins');
      fixture.snapshot.repeatable.rows[0].values.cost = -1;
      let controller;
      render(
        <FormRenderer
          schema={fixture.schema}
          initialSnapshot={{
            raw_values: fixture.snapshot.values,
            repeatable: fixture.snapshot.repeatable,
          }}
          engineOptions={{
            security,
            diagnostics: { console: false },
            events: { lifecycle: true, recordKind: 'existing' },
            onEventController: (value) => (controller = value),
          }}
        />
      );
      await waitFor(() => expect(controller).toBeTruthy());
      await act(async () => {
        const submit = await controller.prepareSave({ intent: 'submit' });
        expect(submit.eligible).toBe(false);
        const finding = submit.validationSummary.scopeIssues.find(
          (x) => x.message === 'Row cost is invalid'
        );
        expect(finding.instancePath[0].instanceId).toBe(0);
        expect(finding.fieldName).toBeUndefined();
        const draft = await controller.prepareSave({ intent: 'draft' });
        expect(draft.eligible).toBe(true);
        expect(draft.validationSummary.hasErrors).toBe(true);
      });
    });
  for (const security of [undefined, { mode: 'safe' }])
    for (const kind of ['builtins', 'fields'])
      it(`${platform} catalog compatibility ${kind} ${security?.mode || 'trusted'}`, async () => {
        const fixture = attachAuditEvents(
          FIELD_SPECS,
          kind === 'builtins' ? builtinFixture(FIELD_SPECS) : fieldFixture(FIELD_SPECS),
          kind
        );
        const unexpectedInteraction = vi.fn();
        if (kind === 'fields')
          fixture.schema.form.events.code += ['single', 'multi']
            .flatMap((name) =>
              ['focus', 'blur', 'click'].map(
                (type) => `\nON('${type}', '${name}', function() { unexpectedInteraction(); });`
              )
            )
            .join('');
        let controller, latest;
        const snapshots = vi.fn();
        render(
          <FormRenderer
            schema={fixture.schema}
            initialSnapshot={{
              raw_values: fixture.snapshot.values,
              repeatable: fixture.snapshot.repeatable,
            }}
            onSnapshotChange={snapshots}
            engineOptions={{
              security,
              helpers: { unexpectedInteraction },
              diagnostics: { console: false },
              events: { lifecycle: true, recordKind: 'existing' },
              onEventController: (value) => (controller = value),
              onUpdate: (state) => {
                if (state.values.cost == null) latest = state;
              },
            }}
          />
        );
        await waitFor(() => expect(controller).toBeTruthy());
        if (kind === 'builtins') {
          await waitFor(() => expect(latest?.values.builtin_repeatablesum).toBe(30));
          for (const [name, , expected] of BUILTIN_CASES)
            expect(latest.values['builtin_' + name.toLowerCase()], name).toEqual(expected);
          for (const trace of ['x', 'xx']) {
            let pending;
            act(() => {
              pending = controller.dispatch({ type: 'change', fieldKey: 'amount' });
            });
            await screen.findByText('One presentation');
            fireEvent.click(screen.getByRole('button', { name: 'OK', exact: true }));
            await act(async () => {
              expect((await pending).issues).toEqual([]);
            });
            await waitFor(() => expect(latest.values.event_trace).toBe(trace));
          }
          const result = JSON.parse(latest.values.event_summary);
          for (const [name, , expected] of BUILTIN_CASES.filter(
            ([n]) => !['SETRESULT', 'REPEATABLEVALUES', 'REPEATABLESUM'].includes(n)
          ))
            expect(result[name], name + ' event').toEqual(expected);
        } else {
          const stage = await screen.findByDisplayValue('0');
          for (const number of [1, 2, 3]) {
            fireEvent.change(stage, { target: { value: String(number) } });
            await waitFor(() =>
              expect(latest?.values.text).toBe(
                number === 1 ? 'Changed' : number === 2 ? '' : 'Accepted'
              )
            );
            const expected =
              number === 1
                ? fixture.changed
                : number === 2
                  ? fixture.cleared
                  : fixture.snapshot.values;
            for (const [key, value] of Object.entries(expected).filter(([key]) => key !== 'stage'))
              expect(latest.values[key], key + ' stage ' + number).toEqual(value);
            if (number === 2) {
              await act(async () => {
                expect((await controller.prepareSave({ intent: 'submit' })).eligible).toBe(false);
                expect((await controller.prepareSave({ intent: 'draft' })).eligible).toBe(true);
              });
            }
          }
          let prepared;
          await act(async () => {
            prepared = await controller.prepareSave({ intent: 'submit' });
          });
          expect(prepared.eligible).toBe(true);
          expect(prepared.payload.form_values.links).toEqual([{ record_id: '0' }]);
          expect(prepared.payload.form_values.signature.signature_id).toBe('sig');
          expect(prepared.payload.form_values.rows[0].id).toBe(0);
          if (platform === 'Native') {
            fireEvent.click(screen.getByRole('button', { name: 'Red', exact: true }));
            fireEvent.click(await screen.findByRole('button', { name: 'Other', exact: true }));
          } else
            fireEvent.change(screen.getByLabelText(/^single\b/), {
              target: { value: '__other__' },
            });
          const other = await screen.findByPlaceholderText('Please specify...');
          fireEvent.change(other, { target: { value: 'Teal' } });
          await waitFor(() => expect(latest.values.single.other[0]?.label).toBe('Teal'));
          fireEvent.change(other, { target: { value: '' } });
          await waitFor(() => expect(latest.values.single.other[0]?.label).not.toBe('Teal'));
          expect(
            screen.queryByPlaceholderText('Please specify...'),
            'Clearing Other keeps the selected input editable'
          ).toBeTruthy();
          await act(async () => {
            expect((await controller.prepareSave({ intent: 'submit' })).eligible).toBe(false);
          });
          fireEvent.change(screen.getByPlaceholderText('Please specify...'), {
            target: { value: 'Blueish' },
          });
          await waitFor(() => expect(latest.values.single.other[0]?.label).toBe('Blueish'));
          await act(async () => {
            expect((await controller.prepareSave({ intent: 'submit' })).eligible).toBe(true);
          });
          expect(unexpectedInteraction).not.toHaveBeenCalled();
        }
      });
}
