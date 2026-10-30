import assert from 'node:assert/strict';
import { createEventFailureReporter } from '../../src/utils/event-diagnostics.js';
import { createEventSession } from '../../src/utils/managed-events.js';

export function eventReportingConformance(test) {
  const failed = {
    status: 'failed',
    issues: [
      {
        code: 'event_execution_failed',
        message: 'Synthetic failure',
        instancePath: [{ instanceId: 'private' }],
      },
    ],
  };
  const context = {
    eventType: 'change',
    fieldKey: 'rating',
    scope: 'root',
    metadata: { value: 'private' },
  };
  test('event reporting uses live options and projects only diagnostic context', () => {
    const original = console.error;
    const output = [];
    let options;
    console.error = (...args) => output.push(args);
    try {
      const report = createEventFailureReporter('binding', () => options);
      report(failed, context);
      options = { failures: false };
      report(failed, context);
      options = { failures: true };
      report(failed, context);
      assert.equal(output.length, 2);
      assert.deepEqual(output[0], [
        '[binding] Event failed.',
        {
          eventType: 'change',
          fieldKey: 'rating',
          scope: 'root',
          issues: [{ code: 'event_execution_failed', message: 'Synthetic failure' }],
        },
      ]);
      assert.equal(JSON.stringify(output).includes('private'), false);
      for (const code of ['scope_closed', 'stale_generation', 'cancelled'])
        report({ status: 'failed', issues: [{ code }] }, context);
      report({ status: 'completed', validationIssues: [{ message: 'Business rule' }] }, context);
      report({ status: 'cancelled', issues: [] }, context);
      assert.equal(output.length, 2);
    } finally {
      console.error = original;
    }
  });
  test('throwing consoles and configuration observers cannot interrupt dispatch', () => {
    const original = console.error;
    try {
      console.error = () => {
        throw new Error('console failure');
      };
      assert.doesNotThrow(() => createEventFailureReporter('binding', () => ({}))(failed, context));
      assert.doesNotThrow(() =>
        createEventFailureReporter('binding', () => {
          throw new Error('options failure');
        })(failed, context)
      );
    } finally {
      console.error = original;
    }
  });
  function fixture(onFailure) {
    let alive = true;
    const session = createEventSession({ recordKind: 'existing' }, onFailure);
    const controller = session.start();
    const handle = session.register({
      scopeId: 'root',
      adapter: {
        isCurrent: () => alive,
        settle: async () => {},
        read: async () => ({ values: {} }),
        validate: () => ({ hasErrors: false, orderedIssues: [] }),
        dataSignature: () => '',
        canEdit: () => true,
        onValidation: () => {},
        trigger: () => ({
          operations: [{ operation: 'SETVALUE' }],
          issues: [],
          validationIssues: [],
        }),
        process: () => {
          throw new TypeError('Synthetic operation rejection');
        },
      },
    });
    return {
      session,
      controller,
      handle,
      retire: () => {
        alive = false;
      },
    };
  }
  test('failed automatic changes report once and return the same structured failure', async () => {
    const output = [];
    const f = fixture((...args) => output.push(args));
    const result = await f.handle.change('change', 'rating', {}, () => {});
    assert.equal(result.status, 'failed');
    assert.equal(output.length, 1);
    assert.equal(output[0][0], result);
    assert.deepEqual(output[0][1], { eventType: 'change', fieldKey: 'rating', scope: 'root' });
    f.session.end();
  });
  test('save preparation returns failures without duplicate event reports', async () => {
    const output = [];
    const f = fixture((...args) => output.push(args));
    const result = await f.controller.prepareSave({ intent: 'submit' });
    assert.equal(result.status, 'failed');
    assert.equal(output.length, 0);
    f.session.end();
  });
  test('retired in-flight work stays quiet and retains generation protection', async () => {
    let release;
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    const output = [];
    const f = fixture((...args) => output.push(args));
    const work = f.handle.change('change', 'rating', {}, () => pending);
    await Promise.resolve();
    f.retire();
    release();
    assert.equal((await work).status, 'failed');
    assert.equal(output.length, 0);
    f.session.end();
  });
  test('failed direct input updates report without running event operations', async () => {
    const output = [];
    const f = fixture((...args) => output.push(args));
    const result = await f.handle.change('change', 'rating', {}, () => {
      throw new TypeError('Bad input structure');
    });
    assert.equal(result.issues[0].code, 'value_update_failed');
    assert.equal(output.length, 1);
    f.session.end();
  });
  test('throwing diagnostic observers leave event failures inspectable', async () => {
    const f = fixture(() => {
      throw new Error('observer failed');
    });
    const result = await f.controller.dispatch({ type: 'change', fieldKey: 'rating' });
    assert.equal(result.status, 'failed');
    assert.match(result.issues[0].message, /Synthetic operation rejection/);
    f.session.end();
  });
}
