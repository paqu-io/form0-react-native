import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { createRecordBackend } from '../src/utils/record-coordinator.js';
import { createRecordScheduler } from '../src/utils/record-scheduling.js';
import { field, repeatable } from './fixtures/diagnostic-conformance.js';

const fixture = () => ({
  schema: {
    form: {
      name: 'Native scheduling',
      elements: [
        field('CalculatedField', 'total', { calculate: "REPEATABLESUM($rows, 'amount')" }),
        repeatable('rows', [field('NumericField', 'amount')]),
      ],
    },
  },
  snapshot: {
    values: { total: 0 },
    repeatable: { rows: [{ id: 0, values: { amount: 10 } }] },
  },
});

function setGlobal(t, name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, value });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  });
}

test('Native backend yields through host idle tasks instead of frame-delayed zero timers', async (t) => {
  const input = fixture();
  const backend = createRecordBackend({ schema: input.schema });
  let idleCalls = 0,
    timerCalls = 0;
  const originalTimer = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (...args) => {
    timerCalls++;
    return originalTimer(...args);
  });
  const idleDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'requestIdleCallback');
  Object.defineProperty(globalThis, 'requestIdleCallback', {
    configurable: true,
    value(callback, options) {
      idleCalls++;
      assert.ok(options.timeout > 0);
      return setImmediate(() => callback({ timeRemaining: () => 8, didTimeout: false }));
    },
  });
  t.after(() => {
    backend.dispose();
    if (idleDescriptor) Object.defineProperty(globalThis, 'requestIdleCallback', idleDescriptor);
    else delete globalThis.requestIdleCallback;
  });
  const result = await backend.prepare(input.snapshot, { budgetMs: 0 });
  assert.equal(result.eligible, true);
  assert.equal(result.snapshot.values.total, 10);
  assert.ok(idleCalls > 0, 'Native host tasks must be used when available');
  assert.equal(timerCalls, 0, 'Each work slice must not incur the delayed timer path');
  const scoped = await backend.evaluateScope(input.snapshot, { budgetMs: 0 });
  assert.equal(scoped.status, 'evaluated');
  assert.equal(scoped.state.values.total, 10);
  assert.equal(input.snapshot.values.total, 0);
  assert.equal(timerCalls, 0);
});

test('input can cancel a pending idle task, including handle zero, without retaining listeners', async (t) => {
  const input = fixture(),
    controller = new AbortController();
  const backend = createRecordBackend({ schema: input.schema });
  let pending, cancelled;
  setGlobal(t, 'requestIdleCallback', (callback) => {
    pending = callback;
    return 0;
  });
  setGlobal(t, 'cancelIdleCallback', (handle) => {
    cancelled = handle;
  });
  t.after(() => backend.dispose());
  const preparation = backend.prepare(input.snapshot, { budgetMs: 0, signal: controller.signal });
  // This is a host task, rather than a microtask chained to the preparation.
  await new Promise((resolve) =>
    setImmediate(() => {
      controller.abort();
      resolve();
    })
  );
  const result = await preparation;
  assert.equal(result.status, 'cancelled');
  assert.equal(result.eligible, false);
  assert.equal(cancelled, 0);
  assert.deepEqual(getEventListeners(controller.signal, 'abort'), []);
  pending(); // A late host callback cannot resume a completed cancellation.
});

test('completed idle waits detach abort listeners and aborted waits schedule no work', async (t) => {
  const controller = new AbortController();
  let calls = 0;
  setGlobal(t, 'requestIdleCallback', (callback) => {
    calls++;
    return setImmediate(callback);
  });
  const scheduler = createRecordScheduler({ signal: controller.signal });
  for (let index = 0; index < 20; index++) await scheduler.yieldToHost();
  assert.equal(calls, 20);
  assert.deepEqual(getEventListeners(controller.signal, 'abort'), []);
  controller.abort();
  await scheduler.yieldToHost();
  assert.equal(calls, 20);
});

test('host scheduling failure removes listeners and returns an execution failure', async (t) => {
  const controller = new AbortController(),
    input = fixture();
  setGlobal(t, 'requestIdleCallback', () => {
    throw new Error('Host scheduling failed');
  });
  const backend = createRecordBackend({ schema: input.schema });
  t.after(() => backend.dispose());
  const result = await backend.prepare(input.snapshot, { signal: controller.signal, budgetMs: 0 });
  assert.equal(result.status, 'failed');
  assert.equal(result.eligible, false);
  assert.match(result.issues[0].message, /Host scheduling failed/);
  assert.deepEqual(getEventListeners(controller.signal, 'abort'), []);
});

test('explicit host yields override automatic selection; older hosts retain the timer fallback', async (t) => {
  const input = fixture();
  let calls = 0;
  setGlobal(t, 'requestIdleCallback', () => {
    throw new Error('Automatic yield must be overridden');
  });
  const backend = createRecordBackend({ schema: input.schema });
  t.after(() => backend.dispose());
  const result = await backend.prepare(input.snapshot, {
    budgetMs: 0,
    yieldToHost: () => {
      calls++;
    },
  });
  assert.equal(result.eligible, true);
  assert.ok(calls > 0);
  setGlobal(t, 'requestIdleCallback', undefined);
  assert.equal(createRecordScheduler().strategy, 'timer');
  await createRecordScheduler().yieldToHost();
});
