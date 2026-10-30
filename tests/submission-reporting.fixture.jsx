import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/** Real Native renderer with a DOM platform adapter; device acceptance remains separate. */
export function runNativeSubmissionReportingTests(FormRenderer, field, repeatable, security) {
  let errorLog, validationLog;
  beforeEach(() => {
    errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    validationLog = vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  const fixture = () => ({
    form: {
      name: 'Native reporting',
      elements: [
        field('NumericField', 'quantity', { required: true }),
        repeatable('rows', [field('TextField', 'name', { required: true })]),
      ],
    },
  });
  const testCase = (name, run) => it(`${name} (${security?.mode || 'trusted'})`, run);
  async function mount(extra, lifecycle = true) {
    let controller;
    const props = {
      schema: fixture(),
      initialValues: { quantity: 2 },
      engineOptions: {
        security,
        events: { lifecycle, recordKind: 'new' },
        diagnostics: { console: false },
        onEventController: (next) => {
          controller = next;
        },
      },
      ...extra,
    };
    const view = render(<FormRenderer {...props} />);
    await waitFor(() => expect(controller).toBeTruthy());
    return { props, view };
  }
  for (const intent of ['submit', 'save'])
    for (const lifecycle of [true, false]) {
      for (const asynchronous of [true, false]) {
        testCase(
          `${intent} reports ${asynchronous ? 'rejection' : 'throw'} once and preserves retry, lifecycle=${lifecycle}`,
          async () => {
            const error = new TypeError('Synthetic callback failure');
            const callback = vi
              .fn()
              .mockImplementationOnce(() => {
                if (asynchronous) return Promise.reject(error);
                throw error;
              })
              .mockResolvedValueOnce();
            const snapshots = vi.fn();
            await mount(
              {
                [intent === 'save' ? 'onSave' : 'onSubmit']: callback,
                primaryActionMode: intent,
                onSnapshotChange: snapshots,
              },
              lifecycle
            );
            const input = await screen.findByDisplayValue('2');
            fireEvent.change(input, { target: { value: '3' } });
            const button = () => screen.getByText(intent === 'save' ? 'Save' : 'Submit');
            await act(async () => fireEvent.click(button()));
            await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
            expect(errorLog.mock.calls).toEqual([
              [
                `[form0-react-native] ${intent === 'save' ? 'Draft save failed during onSave' : 'Submit failed during onSubmit'}.`,
                error,
              ],
            ]);
            expect(screen.getByDisplayValue('3')).toBeTruthy();
            expect(snapshots.mock.calls.at(-1)[1].dirty).toBe(true);
            await act(async () => fireEvent.click(button()));
            await waitFor(() => expect(callback).toHaveBeenCalledTimes(2));
            await waitFor(() => expect(snapshots.mock.calls.at(-1)[1].dirty).toBe(false));
            expect(errorLog).toHaveBeenCalledTimes(1);
            expect(validationLog).not.toHaveBeenCalled();
          }
        );
      }
    }
  for (const intent of ['submit', 'save']) {
    testCase(
      `${intent} can suppress reporting and uses the current preference while pending`,
      async () => {
        let reject;
        const pending = new Promise((_resolve, fail) => {
          reject = fail;
        });
        const callback = vi.fn().mockReturnValueOnce(pending).mockRejectedValueOnce('Offline');
        const { props, view } = await mount({
          [intent === 'save' ? 'onSave' : 'onSubmit']: callback,
          primaryActionMode: intent,
        });
        const button = () => screen.getByText(intent === 'save' ? 'Save' : 'Submit');
        await act(async () => fireEvent.click(button()));
        await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
        view.rerender(<FormRenderer {...props} submissionDiagnostics={{ saveFailures: false }} />);
        await act(async () => reject(new Error('Offline')));
        await act(async () => fireEvent.click(button()));
        await waitFor(() => expect(callback).toHaveBeenCalledTimes(2));
        expect(errorLog).not.toHaveBeenCalled();
      }
    );
  }
  for (const lifecycle of [true, false])
    for (const validationBlocks of [undefined, true]) {
      testCase(
        `invalid Submit uses optional validation logging (${validationBlocks}, lifecycle=${lifecycle})`,
        async () => {
          const onSubmit = vi.fn();
          await mount(
            {
              onSubmit,
              initialValues: {},
              submissionDiagnostics: { validationBlocks },
            },
            lifecycle
          );
          await act(async () => fireEvent.click(screen.getByText('Submit')));
          expect(onSubmit).not.toHaveBeenCalled();
          expect(errorLog).not.toHaveBeenCalled();
          expect(validationLog.mock.calls).toEqual(
            validationBlocks ? [['[form0-react-native] Submit blocked by validation.']] : []
          );
          expect(await screen.findByText(/required/i)).toBeTruthy();
        }
      );
    }
  testCase('invalid drafts remain saveable and do not report validation blocks', async () => {
    const onSave = vi.fn();
    await mount({
      onSave,
      primaryActionMode: 'save',
      initialValues: {},
      submissionDiagnostics: { validationBlocks: true },
    });
    await act(async () => fireEvent.click(screen.getByText('Save')));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][1].validationSummary.hasErrors).toBe(true);
    expect(errorLog).not.toHaveBeenCalled();
    expect(validationLog).not.toHaveBeenCalled();
  });
  for (const validationBlocks of [undefined, true]) {
    testCase(`row Save follows the validation preference (${validationBlocks})`, async () => {
      await mount({ submissionDiagnostics: { validationBlocks } });
      fireEvent.click(screen.getByText('rows'));
      fireEvent.click(screen.getByRole('button', { name: 'View', exact: true }));
      fireEvent.click(await screen.findByRole('button', { name: /Add$/ }));
      await act(async () => fireEvent.click(await screen.findByText('Save')));
      expect(await screen.findByText(/required/i)).toBeTruthy();
      expect(validationLog.mock.calls).toEqual(
        validationBlocks ? [['[form0-react-native] Row save blocked by validation.']] : []
      );
      expect(errorLog).not.toHaveBeenCalled();
    });
  }
}
