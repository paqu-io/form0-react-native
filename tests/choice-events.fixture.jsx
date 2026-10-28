import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

// Exercise actual renderer event adapters, rather than calling a normalizer directly.
export function runChoiceEventRendererTests(FormRenderer, field, repeatable, platform) {
  afterEach(cleanup);
  const choices = [
    { value: 'red', label: 'Red' },
    { value: 'blue', label: 'Blue' },
  ];
  const inputs = (prefix) => [
    field('NumericField', `${prefix}trigger`, { default_value: prefix ? 10 : 0 }),
    field('SingleChoiceField', `${prefix}single`, {
      choices,
      allow_other: true,
      is_searchable: false,
      is_searchable_mode: null,
    }),
    field('MultiChoiceField', `${prefix}multi`, {
      choices,
      allow_other: true,
      is_searchable: false,
      is_searchable_mode: null,
    }),
    field('BooleanField', `${prefix}boolean`, { choices, third_option_enabled: false }),
    field('CalculatedField', `${prefix}selection`, { calculate: `CHOICEVALUE($${prefix}single)` }),
  ];
  for (const security of [undefined, { mode: 'safe' }])
    for (const lifecycle of [false, true]) {
      for (const nested of [false, true])
        it(`${platform} SETVALUE choice shorthand in ${nested ? 'a row' : 'root'} (${security?.mode || 'trusted'}, lifecycle ${lifecycle})`, async () => {
          const schema = {
            form: {
              name: 'Choice event regression',
              elements: [...inputs(''), repeatable('rows', inputs('row_'))],
              events: {
                code: ['', 'row_']
                  .map(
                    (prefix) => `ON('change', '${prefix}trigger', function() {
        SETVALUE('${prefix}single', $${prefix}trigger === ${prefix ? 12 : 2}
          ? { choice: [{ value: 'blue', label: 'Azure', custom: 'keep' }], other: [] }
          : 'red');
        SETVALUE('${prefix}multi', ['red', 'blue']);
        SETVALUE('${prefix}boolean', 'blue');
      });`
                  )
                  .join('\n'),
              },
            },
          };
          const seed = {
            raw_values: { trigger: 0 },
            repeatable: {
              rows: [
                { id: 0, values: { row_trigger: 10 }, repeatable: {} },
                {
                  id: 'sibling',
                  values: {
                    row_trigger: 10,
                    row_single: {
                      choice: [{ value: 'blue', label: 'Blue', custom: 'keep' }],
                      other: [],
                    },
                  },
                  repeatable: {},
                },
              ],
            },
          };
          const original = structuredClone(seed);
          const updates = vi.fn();
          const snapshots = vi.fn();
          let controller;
          render(
            <FormRenderer
              schema={schema}
              initialSnapshot={seed}
              onSnapshotChange={snapshots}
              repeatableEntryMode="edit"
              engineOptions={{
                security,
                diagnostics: { console: false },
                events: { lifecycle, recordKind: 'existing' },
                onUpdate: updates,
                onEventController: (next) => {
                  if (next) controller = next;
                },
              }}
            />
          );
          await waitFor(() => expect(controller).toBeTruthy());
          if (nested) {
            if (platform === 'Native') fireEvent.click(await screen.findByText('rows'));
            fireEvent.click(await screen.findByRole('button', { name: 'View', exact: true }));
            fireEvent.click(screen.getAllByRole('button', { name: 'View', exact: true })[0]);
          }
          const prefix = nested ? 'row_' : '';
          fireEvent.change(await screen.findByDisplayValue(nested ? '10' : '0'), {
            target: { value: nested ? '11' : '1' },
          });
          const latest = () =>
            updates.mock.calls
              .map(([state]) => state)
              .filter((state) => Object.hasOwn(state.values, `${prefix}trigger`))
              .at(-1);
          if (nested && !lifecycle) {
            // Legacy opt-out does not dispatch managed row changes.
            await waitFor(() => expect(latest()?.values.row_trigger).toBe(11));
            expect(latest().values.row_single?.choice || []).toEqual([]);
            expect(latest().values.row_single?.other || []).toEqual([]);
            expect(seed).toEqual(original);
            return;
          }
          await waitFor(() =>
            expect(latest()?.values[`${prefix}single`]?.choice?.[0]?.value).toBe('red')
          );
          expect(latest().values[`${prefix}multi`].choices.map((choice) => choice.value)).toEqual([
            'red',
            'blue',
          ]);
          expect(latest().values[`${prefix}boolean`].choice[0].value).toBe('blue');
          expect(latest().values[`${prefix}selection`]).toBe('red');
          expect(latest().errors).toEqual({});
          // Complete choice objects retain labels and per-entry metadata.
          fireEvent.change(screen.getByDisplayValue(nested ? '11' : '1'), {
            target: { value: nested ? '12' : '2' },
          });
          await waitFor(() => expect(latest().values[`${prefix}selection`]).toBe('blue'));
          expect(latest().values[`${prefix}single`]).toEqual({
            choice: [{ value: 'blue', label: 'Azure', custom: 'keep' }],
            other: [],
          });
          if (nested) {
            fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
            await waitFor(() =>
              expect(snapshots.mock.calls.at(-1)[0].repeatable.rows[0].values.row_selection).toBe(
                'blue'
              )
            );
            const rows = snapshots.mock.calls.at(-1)[0].repeatable.rows;
            expect(rows[0].id).toBe(0);
            expect(rows[1]).toEqual(original.repeatable.rows[1]);
          }
          expect(seed).toEqual(original);
        });
    }
}
