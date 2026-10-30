import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubmissionReporter } from '../src/utils/submission-diagnostics.js';

function capture(t, getOptions = () => undefined) {
  const errors = [],
    info = [];
  t.mock.method(console, 'error', (...args) => errors.push(args));
  t.mock.method(console, 'info', (...args) => info.push(args));
  return {
    reporter: createSubmissionReporter('form0-react-native', getOptions),
    errors,
    info,
  };
}

test('save failures report the original rejection without attaching record data', (t) => {
  const { reporter, errors, info } = capture(t);
  const error = new TypeError('Offline');
  reporter.failure('Submit', 'onSubmit', error);
  assert.deepEqual(errors, [['[form0-react-native] Submit failed during onSubmit.', error]]);
  assert.deepEqual(info, []);
});

test('preferences remain current and validation reporting is independent of save failures', (t) => {
  let options;
  const { reporter, errors, info } = capture(t, () => options);
  reporter.blocked('Submit');
  assert.deepEqual(info, []);
  options = { saveFailures: false, validationBlocks: true };
  reporter.failure('Draft save', 'onSave', 'Offline');
  reporter.blocked('Row save');
  assert.deepEqual(errors, []);
  assert.deepEqual(info, [['[form0-react-native] Row save blocked by validation.']]);
  options = {};
  reporter.failure('Draft save', 'onSave', 'Offline');
  assert.deepEqual(errors, [['[form0-react-native] Draft save failed during onSave.', 'Offline']]);
});

test('preparation reports operational failures without payloads or paths', (t) => {
  const { reporter, errors } = capture(t);
  reporter.result('Submit', 'preparation', {
    status: 'failed',
    eligible: false,
    payload: { private: 'record' },
    issues: [
      {
        code: 'save_preparation_failed',
        message: 'Save hook failed',
        instancePath: ['private-id'],
      },
    ],
  });
  assert.deepEqual(errors, [
    [
      '[form0-react-native] Submit failed during preparation.',
      [{ code: 'save_preparation_failed', message: 'Save hook failed' }],
    ],
  ]);
});

test('validation blocks are optional and draft validation does not imply a blocked save', (t) => {
  const { reporter, errors, info } = capture(t, () => ({
    validationBlocks: true,
  }));
  reporter.result('Submit', 'preparation', {
    status: 'completed',
    eligible: false,
    validationSummary: { hasErrors: true },
  });
  reporter.result('Draft save', 'preparation', {
    status: 'completed',
    eligible: true,
    validationSummary: { hasErrors: true },
  });
  assert.deepEqual(info, [['[form0-react-native] Submit blocked by validation.']]);
  assert.deepEqual(errors, []);
});

test('successful acknowledgement, confirmation and cancellation stay quiet', (t) => {
  const { reporter, errors, info } = capture(t, () => ({
    validationBlocks: true,
  }));
  for (const status of ['completed', 'requires_decision', 'cancelled']) {
    reporter.result('Submit', 'preparation', {
      status,
      eligible: status === 'completed',
    });
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(info, []);
});

test('acknowledgement failures are distinguished from persistence rejections', (t) => {
  const { reporter, errors } = capture(t);
  reporter.result('Submit', 'acknowledgement', {
    status: 'failed',
    issues: [{ code: 'stale_preparation', message: 'The attempt has ended.' }],
  });
  assert.match(errors[0][0], /acknowledgement/);
});

test('throwing console methods or preference access cannot interrupt the operation', (t) => {
  t.mock.method(console, 'error', () => {
    throw new Error('Console failed');
  });
  t.mock.method(console, 'info', () => {
    throw new Error('Console failed');
  });
  const reporter = createSubmissionReporter('form0-react-native', () => ({
    validationBlocks: true,
  }));
  assert.doesNotThrow(() => reporter.failure('Submit', 'onSubmit', new Error('Original')));
  assert.doesNotThrow(() => reporter.blocked('Submit'));
  const badPreference = createSubmissionReporter('form0-react-native', () => {
    throw new Error('Preference failed');
  });
  assert.doesNotThrow(() => badPreference.failure('Submit', 'onSubmit', 'Original'));
});
