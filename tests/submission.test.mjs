import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStructuredSubmission } from '../src/utils/submission.js';

const submissionSchema = {
  form: {
    name: 'Submission demo',
    status_field: {
      data_name: 'status_field',
      default_value: 'draft',
    },
    elements: [
      {
        key: 'text-field',
        type: 'TextField',
        label: 'Text field',
        data_name: 'text_field',
      },
      {
        key: 'status-field',
        type: 'SingleChoiceField',
        label: 'Status field',
        data_name: 'status_field',
      },
      {
        key: 'photo-field',
        type: 'PhotoField',
        label: 'Photo field',
        data_name: 'photo_field',
      },
      {
        key: 'signature-field',
        type: 'SignatureField',
        label: 'Signature field',
        data_name: 'signature_field',
      },
      {
        key: 'repeatable-key',
        type: 'RepeatableSection',
        label: 'Repeatable',
        data_name: 'repeatable',
        elements: [
          {
            key: 'repeatable-text',
            type: 'TextField',
            label: 'Repeatable text',
            data_name: 'repeatable_text',
          },
        ],
      },
    ],
  },
};

test('structured submission returns web-aligned meta and preserves media identifiers', () => {
  const values = {
    text_field: 'Vitto',
    status_field: 'active',
    created_at_client: '2026-06-09T17:49:29.123Z',
    photo_field: [
      {
        url: 'file:///tmp/photo.jpg',
        photo_id: 'photo-1',
        media_id: 'photo-1',
      },
    ],
    signature_field: {
      data: 'abc',
      signature_id: 'signature-1',
      media_id: 'signature-1',
    },
  };
  const repeatable = {
    'repeatable-key': [
      {
        id: 'repeatable-1',
        values: {
          repeatable_text: 'Nested value',
        },
        repeatable: {},
      },
    ],
  };

  const submission = buildStructuredSubmission({
    schema: submissionSchema,
    values,
    repeatable,
    fieldKeyMode: 'data-name',
  });

  assert.equal(submission.rawValues.status_field, 'active');
  assert.equal(submission.rawValues.created_at_client, '2026-06-09T17:49:29.123Z');
  assert.ok(typeof submission.timestamps.updated_at_client === 'string');
  assert.equal(submission.timestamps.created_at_server, null);
  assert.deepEqual(submission.repeatable, repeatable);
  assert.equal(submission.structuredRecord['@status'], 'active');
  assert.equal(submission.structuredRecord.form_values.text_field, 'Vitto');
  assert.equal(
    submission.structuredRecord.form_values.photo_field[0].photo_id,
    'photo-1',
  );
  assert.equal(
    submission.structuredRecord.form_values.signature_field.signature_id,
    'signature-1',
  );
  assert.equal(submission.structuredRecord.form_values.repeatable.length, 1);
  assert.equal(
    submission.structuredRecord.form_values.repeatable[0].form_values.repeatable_text,
    'Nested value',
  );
});
