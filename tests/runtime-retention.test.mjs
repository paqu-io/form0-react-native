import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRecordCoordinator,
  applyClearedFieldUpdates,
} from '../src/utils/record-coordinator.js';
import { buildStructuredSubmission } from '../src/utils/submission.js';
import { field, repeatable } from './fixtures/diagnostic-conformance.js';

for (const security of [undefined, { mode: 'safe' }])
  test(`Native retention and strict option (${security?.mode || 'trusted'})`, async () => {
    const schema = {
      form: {
        name: 'Retention',
        elements: [
          field('NumericField', 'show_rows'),
          {
            ...repeatable('rows', [
              field('TextField', 'secret', { visible_preserve_value: false }),
              field('TextField', 'keep'),
            ]),
            visible: false,
            visible_conditions: {
              field_id: 'show_rows',
              operator: 'equal_to',
              value: 1,
            },
          },
          field('TextField', 'hidden', { visible: false }),
        ],
      },
    };
    let snapshot = {
      values: { show_rows: 0, hidden: 9 },
      repeatable: {
        rows: [{ id: 0, values: { secret: 'secret', keep: 'keep' } }],
      },
    };
    const coordinator = createRecordCoordinator({
      schema,
      security,
      getOptions: () => ({ submissionOptions: { validateHiddenValues: true } }),
    });
    coordinator.bind([], {
      read: () => snapshot,
      apply: (next) => {
        snapshot = next;
      },
    });
    try {
      assert.equal(coordinator.hasCollections(), true);
      const evaluated = await coordinator.evaluate();
      snapshot = applyClearedFieldUpdates(
        { ...snapshot, ...evaluated.state },
        evaluated.clearedFields
      );
      assert.equal(snapshot.repeatable.rows[0].values.secret, null);
      assert.equal(snapshot.repeatable.rows[0].values.keep, 'keep');
      assert.equal(snapshot.repeatable.rows[0].id, 0);
      const built = buildStructuredSubmission({
        schema,
        values: snapshot.values,
        repeatable: snapshot.repeatable,
      });
      assert.equal(built.structuredRecord.form_values.rows[0].form_values.secret, null);
      assert.equal(built.repeatable.rows[0].values.secret, null);
      const serialize = async (selected) => ({ payload: selected, meta: {} });
      assert.equal(
        (await coordinator.prepare({ intent: 'submit' }, { serialize })).eligible,
        false
      );
      assert.equal((await coordinator.prepare({ intent: 'draft' }, { serialize })).eligible, true);
    } finally {
      coordinator.dispose();
    }
  });
