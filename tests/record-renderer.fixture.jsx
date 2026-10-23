import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

/** Run against the packed Native adapter; actual Hermes/device acceptance is separate. */
export function runNativeRecordRendererTests(FormRenderer, field, repeatable, security) {
  afterEach(cleanup);
  const testCase = (name, run) => it(`${name} (${security?.mode || 'trusted'})`, run);
  const schema = (confirm = false) => ({
    form: {
      name: 'Invoice',
      ...(confirm ? { repeatable_recalculation: 'confirm' } : {}),
      elements: [
        field('NumericField', 'tax', { format: 'float' }),
        field('CalculatedField', 'grand', {
          calculate: "REPEATABLESUM($lines, 'total')",
        }),
        repeatable('lines', [
          field('NumericField', 'amount'),
          field('CalculatedField', 'total', {
            calculate: '$amount * (1 + $tax)',
          }),
        ]),
      ],
    },
  });
  const initial = () => ({
    raw_values: { tax: 0.2, grand: 330 },
    repeatable: {
      lines: [
        {
          id: 0,
          values: { amount: 100, total: 110 },
          attachment: { media_id: 'kept' },
        },
        { id: 'B', values: { amount: 200, total: 220 } },
      ],
    },
  });
  testCase(
    'Native returning to View after persistence failure retains selected unsaved values',
    async () => {
      const form = schema(),
        seed = initial(),
        original = structuredClone(seed);
      const save = vi.fn().mockRejectedValue(new Error('Storage unavailable'));
      const snapshots = vi.fn();
      const props = {
        schema: form,
        initialSnapshot: seed,
        onSubmit: save,
        onSnapshotChange: snapshots,
        engineOptions: { security, diagnostics: { console: false } },
      };
      const mounted = render(<FormRenderer {...props} mode="edit" />);
      fireEvent.click(await screen.findByText('Submit'));
      await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
      await screen.findByText('360');
      mounted.rerender(<FormRenderer {...props} mode="readonly" />);
      await screen.findByText('Edit');
      expect(screen.getByText('360')).toBeTruthy();
      expect(
        snapshots.mock.calls.at(-1)[0].repeatable.lines.map((row) => row.values.total)
      ).toEqual([120, 240]);
      expect(snapshots.mock.calls.at(-1)[1].dirty).toBe(true);
      expect(seed).toEqual(original);
    }
  );
  testCase(
    'Native root view preserves supplied totals and load/edit receive the executing mode',
    async () => {
      const form = schema();
      const seen = vi.fn();
      form.form.events = {
        code: "ON('load-record', function(e) { seen(e.type, e.mode); }); ON('edit-record', function(e) { seen(e.type, e.mode); });",
      };
      const seed = initial();
      seed.raw_values.grand = 333;
      const original = structuredClone(seed);
      render(
        <FormRenderer
          schema={form}
          initialSnapshot={seed}
          mode="readonly"
          engineOptions={{
            security,
            helpers: { seen },
            diagnostics: { console: false },
            events: { lifecycle: true, recordKind: 'existing' },
          }}
        />
      );
      await waitFor(() => expect(seen.mock.calls).toEqual([['load-record', 'readonly']]));
      expect(screen.getByText('333')).toBeTruthy();
      fireEvent.click(screen.getByText('Edit'));
      expect(await screen.findByText('330')).toBeTruthy();
      await waitFor(() =>
        expect(seen.mock.calls).toEqual([
          ['load-record', 'readonly'],
          ['edit-record', 'edit'],
        ])
      );
      expect(seed).toEqual(original);
    }
  );
  testCase('Native view load rejects setter and alert before host delegation', async () => {
    const form = schema();
    form.form.events = {
      code: "ON('load-record', function(e) { e.mode = 'edit'; ALERT('Forbidden alert'); SETVALUE('tax', 9); });",
    };
    const delegate = vi.fn(),
      warning = vi.fn();
    let controller;
    render(
      <FormRenderer
        schema={form}
        initialSnapshot={initial()}
        mode="readonly"
        engineOptions={{
          security,
          diagnostics: { console: false },
          onOperations: delegate,
          onWarning: warning,
          events: { lifecycle: true, recordKind: 'existing' },
          onEventController: (value) => (controller = value),
        }}
      />
    );
    await waitFor(() => expect(controller).toBeTruthy());
    expect(warning).toHaveBeenCalled();
    expect(screen.getByText('330')).toBeTruthy();
    expect(screen.queryByText('Forbidden alert')).toBeNull();
    expect(delegate).not.toHaveBeenCalled();
    let result;
    await act(async () => {
      result = await controller.dispatch({
        type: 'load-record',
        metadata: { mode: 'edit' },
      });
    });
    expect(result.issues[0].code).toBe('readonly_operation_not_allowed');
    expect(delegate).not.toHaveBeenCalled();
  });
  testCase(
    'Native viewing preserves accepted calculations and editing isolates Cancel and Save',
    async () => {
      let controller;
      const snapshots = vi.fn();
      const seed = initial();
      const original = structuredClone(seed);
      render(
        <FormRenderer
          schema={schema(true)}
          initialSnapshot={seed}
          onSnapshotChange={snapshots}
          submissionOptions={{ allowRetain: true }}
          engineOptions={{
            security,
            diagnostics: { console: false },
            events: { lifecycle: true, recordKind: 'existing' },
            onEventController: (value) => (controller = value),
          }}
        />
      );
      await waitFor(() => expect(controller).toBeTruthy());
      fireEvent.click(screen.getByText('lines'));
      fireEvent.click((await screen.findAllByText('View'))[0]);
      await screen.findByText('lines 1');
      fireEvent.click(screen.getAllByText('View')[0]);
      expect(await screen.findByDisplayValue('100')).toBeTruthy();
      expect(await screen.findByText('110')).toBeTruthy();
      expect(screen.getByDisplayValue('100').readOnly).toBe(true);
      expect(screen.queryByText('Save')).toBeNull();
      fireEvent.click(screen.getByText('Edit'));
      expect(await screen.findByText('120')).toBeTruthy();
      expect(screen.getByText('Save')).toBeTruthy();
      const assertAccepted = () => {
        const snapshot = snapshots.mock.calls.at(-1)[0];
        expect(snapshot.raw_values.grand).toBe(330);
        expect(snapshot.repeatable.lines.map((row) => row.values.total)).toEqual([110, 220]);
      };
      assertAccepted();
      fireEvent.click(screen.getByText('Cancel'));
      await waitFor(() => {
        expect(screen.queryByText('Discard') || !screen.queryByDisplayValue('100')).toBeTruthy();
      });
      if (screen.queryByText('Discard')) fireEvent.click(screen.getByText('Discard'));
      await waitFor(() => expect(screen.queryByDisplayValue('100')).toBeNull());
      assertAccepted();
      expect(seed).toEqual(original);
      let review;
      await act(async () => {
        review = await controller.prepareSave({ intent: 'submit' });
      });
      expect(review.status).toBe('requires_decision');
      const changes = await controller.getSaveChanges({
        preparationId: review.preparationId,
      });
      expect(changes.changes.map((change) => [change.before, change.after])).toEqual([
        [330, 360],
        [110, 120],
        [220, 240],
      ]);
      await act(async () => {
        await controller.prepareSave({
          intent: 'submit',
          decision: { reviewId: review.reviewId, action: 'cancel' },
        });
      });
      fireEvent.click(screen.getAllByText('View')[0]);
      await screen.findByDisplayValue('100');
      fireEvent.click(screen.getByText('Edit'));
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => {
        const snapshot = snapshots.mock.calls.at(-1)[0];
        expect(snapshot.raw_values.grand).toBe(340);
        expect(snapshot.repeatable.lines.map((row) => row.values.total)).toEqual([120, 220]);
      });
      expect(seed).toEqual(original);
    }
  );
  testCase(
    'Native opening controls preserve row classification and explicit direct editing',
    async () => {
      for (const entryMode of ['readonly', 'edit']) {
        const form = schema();
        form.form.elements[2].elements.push(field('TextField', 'row_trace'));
        form.form.events = {
          code: [
            "ON('load-repeatable', 'lines', function (event) { if (event.mode === 'edit') SETVALUE('row_trace', 'load'); });",
            "ON('edit-repeatable', 'lines', function () { SETVALUE('row_trace', $row_trace + ':edit'); });",
            "ON('new-repeatable', 'lines', function () { SETVALUE('row_trace', $row_trace + ':new'); });",
          ].join('\n'),
        };
        const openingSeed = initial();
        openingSeed.repeatable.lines[0].values.row_trace = 'accepted';
        render(
          <FormRenderer
            schema={form}
            initialSnapshot={openingSeed}
            repeatableEntryMode={entryMode}
            engineOptions={{
              security,
              diagnostics: { console: false },
              events: { lifecycle: true, recordKind: 'existing' },
            }}
          />
        );
        fireEvent.click(await screen.findByText('lines'));
        fireEvent.click(screen.getByText('View'));
        await screen.findByText('lines 1');
        fireEvent.click(screen.getAllByText('View')[0]);
        const input = await screen.findByDisplayValue('100');
        expect(input.readOnly).toBe(entryMode === 'readonly');
        if (entryMode === 'readonly') {
          await screen.findByDisplayValue('accepted');
          expect(screen.queryByText('Save')).toBeNull();
          fireEvent.click(screen.getByText('Edit'));
        }
        await screen.findByDisplayValue(entryMode === 'readonly' ? 'accepted:edit' : 'load:edit');
        expect(input.readOnly).toBe(false);
        fireEvent.click(screen.getByText('Cancel'));
        await screen.findByText('Discard');
        fireEvent.click(screen.getByText('Discard'));
        await screen.findByText('lines 1');
        fireEvent.click(screen.getByText('+ Add'));
        await screen.findByDisplayValue('load:new');
        expect(screen.queryByText('Edit')).toBeNull();
        expect(screen.getByText('Save')).toBeTruthy();
        cleanup();
      }
    }
  );
  testCase(
    'Native read-only ancestors permit nested browsing and prevent editing overrides',
    async () => {
      for (const rootReadOnly of [true, false]) {
        const form = schema();
        form.form.elements[2].elements.push(repeatable('children', [field('TextField', 'detail')]));
        const seed = initial();
        seed.repeatable.lines[0].repeatable = {
          children: [{ id: 0, values: { detail: 'Nested' } }],
        };
        render(
          <FormRenderer
            schema={form}
            initialSnapshot={seed}
            mode={rootReadOnly ? 'readonly' : 'edit'}
            repeatableEntryMode={rootReadOnly ? 'edit' : 'readonly'}
            engineOptions={{ security, diagnostics: { console: false } }}
          />
        );
        fireEvent.click(await screen.findByText('lines'));
        fireEvent.click(screen.getByRole('button', { name: 'View', exact: true }));
        await screen.findByText('lines 1');
        fireEvent.click(screen.getAllByText('View')[0]);
        expect((await screen.findByDisplayValue('100')).readOnly).toBe(true);
        expect(Boolean(screen.queryByRole('button', { name: 'Edit', exact: true }))).toBe(
          !rootReadOnly
        );
        fireEvent.click(screen.getByText('children'));
        fireEvent.click(screen.getByRole('button', { name: 'View', exact: true }));
        await screen.findByText('children 1');
        expect(screen.queryByRole('button', { name: 'Remove', exact: true })).toBeNull();
        expect(screen.queryByRole('button', { name: '+ Add', exact: true })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'View', exact: true }));
        expect((await screen.findByDisplayValue('Nested')).readOnly).toBe(true);
        expect(screen.queryByRole('button', { name: 'Edit', exact: true })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Save', exact: true })).toBeNull();
        cleanup();
      }
    }
  );
  testCase(
    'Native automatic submission uses the exact refreshed tree with legacy events disabled',
    async () => {
      const onSubmit = vi.fn();
      let controller;
      const seed = initial(),
        original = structuredClone(seed);
      render(
        <FormRenderer
          schema={schema()}
          initialSnapshot={seed}
          onSubmit={onSubmit}
          engineOptions={{
            security,
            diagnostics: { console: false },
            onEventController: (value) => (controller = value),
          }}
        />
      );
      await waitFor(() => expect(controller).toBeTruthy());
      fireEvent.click(screen.getByText('Submit'));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      const [record, meta] = onSubmit.mock.calls[0];
      expect(record.form_values.grand).toBe(360);
      expect(meta.repeatable.lines.map((row) => row.values.total)).toEqual([120, 240]);
      expect(meta.repeatable.lines[0].id).toBe(0);
      expect(meta.repeatable.lines[0].attachment.media_id).toBe('kept');
      expect(seed).toEqual(original);
    }
  );
  testCase(
    'Native all-or-none retention persists pending metadata only after callback success',
    async () => {
      const onSubmit = vi
        .fn()
        .mockRejectedValueOnce(new Error('Offline write failed'))
        .mockResolvedValueOnce();
      render(
        <FormRenderer
          schema={schema(true)}
          initialSnapshot={initial()}
          onSubmit={onSubmit}
          submissionOptions={{ allowRetain: true }}
          engineOptions={{ security, diagnostics: { console: false } }}
        />
      );
      await screen.findByText('Submit');
      fireEvent.click(screen.getByText('Submit'));
      await screen.findByText('Update child calculations?');
      fireEvent.click(screen.getByText('Keep existing values and continue'));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(screen.queryByText('Some saved child calculations still need updating.')).toBeNull();
      fireEvent.click(screen.getByText('Submit'));
      await screen.findByText('Update child calculations?');
      fireEvent.click(screen.getByText('Keep existing values and continue'));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
      expect(onSubmit.mock.calls[1][0].form_values.grand).toBe(330);
      expect(
        await screen.findByText('Some saved child calculations still need updating.')
      ).toBeTruthy();
    }
  );
  testCase(
    'Native programmatic preparation is UI-free, cancellable, and invalid root drafts remain eligible',
    async () => {
      let controller;
      const form = schema(true);
      form.form.elements.unshift(field('TextField', 'required_note', { required: true }));
      render(
        <FormRenderer
          schema={form}
          initialSnapshot={initial()}
          engineOptions={{
            security,
            diagnostics: { console: false },
            onEventController: (value) => (controller = value),
          }}
        />
      );
      await waitFor(() => expect(controller).toBeTruthy());
      let review, cancelled, draft;
      await act(async () => {
        review = await controller.prepareSave({ intent: 'submit' });
      });
      expect(review.status).toBe('requires_decision');
      expect(screen.queryByText('Update child calculations?')).toBeNull();
      await act(async () => {
        cancelled = await controller.prepareSave({
          intent: 'submit',
          decision: { reviewId: review.reviewId, action: 'cancel' },
        });
      });
      expect(cancelled.status).toBe('cancelled');
      await act(async () => {
        draft = await controller.prepareSave({ intent: 'draft' });
      });
      expect(draft.eligible).toBe(true);
      expect(draft.validationSummary.hasErrors).toBe(true);
      expect(draft.payload.repeatable.lines.map((row) => row.values.total)).toEqual([110, 220]);
    }
  );
  testCase(
    'Native failed draft persistence releases its preparation without acknowledging pending freshness',
    async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Draft persistence failed'));
      let controller;
      render(
        <FormRenderer
          schema={schema(true)}
          initialSnapshot={initial()}
          onSave={onSave}
          primaryActionMode="save"
          engineOptions={{
            security,
            diagnostics: { console: false },
            onEventController: (value) => {
              controller = value;
            },
          }}
        />
      );
      await waitFor(() => expect(controller).toBeTruthy());
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      const [snapshot, meta] = onSave.mock.calls[0];
      expect(snapshot.repeatable.lines.map((row) => row.values.total)).toEqual([110, 220]);
      expect(meta.freshness.status).toBe('pending');
      await waitFor(async () =>
        expect(
          (
            await controller.getSaveChanges({
              preparationId: meta.preparationId,
            })
          ).status
        ).toBe('failed')
      );
    }
  );
}
