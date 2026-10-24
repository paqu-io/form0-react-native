import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import {
  createRecordBackend,
  createRecordCoordinator,
  createEditorSignature,
} from '../src/utils/record-coordinator.js';
import { ownedCollectionSignature } from '../src/utils/managed-events.js';
import { createRecordScheduler } from '../src/utils/record-scheduling.js';
import { field, repeatable } from './fixtures/diagnostic-conformance.js';
import { createStructuredRecordAsync, flattenFields } from 'form0-core';

const fixture = () => ({
  schema: {
    form: {
      name: 'Native scheduling',
      elements: [
        field('CalculatedField', 'total', {
          calculate: "REPEATABLESUM($rows, 'amount')",
        }),
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

test('cancellation during the real asynchronous serializer never becomes a preparation error or payload', async (t) => {
  const { schema, snapshot } = fixture();
  const abort = new AbortController();
  const coordinator = createRecordCoordinator({ schema });
  t.after(() => coordinator.dispose());
  coordinator.bind([], { read: () => snapshot, apply() {} });
  coordinator.setBackend({
    prepare: async () => ({
      status: 'ready',
      eligible: true,
      snapshot,
      changeCount: 0,
      issues: [],
    }),
    release() {},
  });
  let checkpoints = 0;
  const result = await coordinator.prepare(
    { intent: 'submit', signal: abort.signal },
    {
      serialize: async (selected, _intent, _summary, scheduling) => ({
        payload: await createStructuredRecordAsync(
          selected,
          flattenFields(schema.form.elements),
          {
            originalElements: schema.form.elements,
          },
          {
            ...scheduling,
            budgetMs: 0,
            yieldToHost: async () => {
              if (++checkpoints === 2) abort.abort();
            },
          }
        ),
        meta: {},
      }),
    }
  );
  assert.equal(result.status, 'cancelled');
  assert.equal(result.eligible, false);
  assert.equal(result.payload, null);
  assert.deepEqual(result.issues, []);
});

test('releasing a backend while preparation yields cannot recreate its report', async (t) => {
  const { schema, snapshot } = fixture();
  const backend = createRecordBackend({ schema });
  t.after(() => backend.dispose());
  let released = false;
  const result = await backend.prepare(snapshot, {
    budgetMs: 0,
    yieldToHost: async () => {
      if (!released) {
        released = true;
        backend.release();
      }
    },
  });
  assert.equal(result.eligible, false);
  assert.equal(result.issues[0].code, 'stale_preparation');
  assert.equal(backend.getChanges().total, 0);
});

for (const interruption of ['none', 'cancel', 'edit', 'dispose'])
  test(`Native full controller yields around save/serialization and guards ${interruption}`, async (t) => {
    let clock = 0;
    t.mock.method(globalThis.performance, 'now', () => clock);
    const events = [];
    const signal = new AbortController();
    let current = { values: { amount: 1 }, repeatable: {} };
    const coordinator = createRecordCoordinator({ schema: fixture().schema });
    t.after(() => coordinator.dispose());
    setGlobal(t, 'requestIdleCallback', (callback) =>
      setImmediate(() => {
        events.push('yield');
        if (events.includes('serialize')) {
          if (interruption === 'cancel') signal.abort();
          if (interruption === 'edit') current.values.amount = 9;
          if (interruption === 'dispose') coordinator.dispose();
        }
        callback();
      })
    );
    setGlobal(t, 'cancelIdleCallback', (handle) => clearImmediate(handle));
    coordinator.bind([], {
      read: () => {
        clock += 20;
        return current;
      },
      apply: (snapshot) => {
        events.push('apply');
        current = structuredClone(snapshot);
      },
    });
    coordinator.setBackend({
      async prepare(snapshot) {
        events.push('evaluate');
        clock += 20;
        return {
          status: 'ready',
          eligible: true,
          snapshot: structuredClone(snapshot),
          changeCount: 0,
          issues: [],
        };
      },
      release() {},
    });
    const result = await coordinator.prepare(
      { intent: 'submit', signal: signal.signal },
      {
        managedEvents: true,
        saveHook: async () => {
          events.push('hook');
          clock += 20;
        },
        serialize: async (snapshot) => {
          events.push('serialize');
          clock += 20;
          return { payload: structuredClone(snapshot), meta: {} };
        },
      }
    );
    for (const [before, after] of [
      ['evaluate', 'apply'],
      ['apply', 'hook'],
      ['hook', 'serialize'],
    ])
      assert.ok(
        events.slice(events.indexOf(before) + 1, events.indexOf(after)).includes('yield'),
        `${before} → ${after} must let host work run.`
      );
    assert.ok(events.slice(events.indexOf('serialize') + 1).includes('yield'));
    assert.equal(events.filter((event) => event === 'hook').length, 1);
    if (interruption === 'none') {
      assert.equal(result.eligible, true);
      assert.equal(result.payload.values.amount, 1);
    } else {
      assert.equal(result.eligible, false);
      assert.equal(result.payload ?? null, null);
      if (interruption === 'cancel') assert.equal(result.status, 'cancelled');
      else
        assert.equal(
          result.issues[0].code,
          interruption === 'edit' ? 'values_changed' : 'stale_preparation'
        );
    }
  });

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
  const preparation = backend.prepare(input.snapshot, {
    budgetMs: 0,
    signal: controller.signal,
  });
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
  const result = await backend.prepare(input.snapshot, {
    signal: controller.signal,
    budgetMs: 0,
  });
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

test('owned collection signatures reuse only immutable child trees and read live values/metadata', () => {
  let reads = 0;
  const row = { values: { amount: 10 } };
  Object.defineProperty(row.values, 'observed', {
    enumerable: true,
    get: () => {
      reads++;
      return 10;
    },
  });
  let snapshot = { id: 0, values: { total: 10 }, repeatable: { rows: [row] } };
  const signature = createEditorSignature(() => snapshot);
  const first = signature();
  assert.equal(reads, 1);
  ownedCollectionSignature(snapshot.repeatable);
  assert.equal(reads, 1, 'UI and preparation share the same immutable-tree signature');
  assert.equal(signature(), first);
  assert.equal(reads, 1, 'unchanged owned collections must not be rescanned');
  snapshot.values.total = 20;
  const edited = signature();
  assert.notEqual(edited, first, 'mutable engine values are checked on every call');
  assert.equal(reads, 1);
  snapshot.id = 'changed';
  assert.notEqual(signature(), edited, 'record metadata is checked on every call');
  snapshot = {
    ...snapshot,
    repeatable: { rows: [{ values: { amount: 20 } }] },
  };
  const accepted = signature();
  assert.notEqual(accepted, edited);
  snapshot = { ...snapshot, repeatable: { rows: [] } };
  assert.notEqual(signature(), accepted, 'accepting/removing rows replaces the owned tree');
  snapshot = {
    values: { media: new Blob(['test'], { type: 'text/plain' }) },
    repeatable: {},
  };
  const media = signature();
  snapshot.values.media = new Blob(['other'], { type: 'application/json' });
  assert.notEqual(signature(), media, 'fresh value signatures retain media metadata semantics');
});

test('generic coordinators still detect in-place child mutations without the owned-tree adapter', async (t) => {
  const { schema, snapshot } = fixture();
  const coordinator = createRecordCoordinator({ schema });
  t.after(() => coordinator.dispose());
  coordinator.bind([], { read: () => snapshot, apply() {} });
  const first = coordinator.signature();
  snapshot.repeatable.rows[0].values.amount = 99;
  assert.notEqual(coordinator.signature(), first);
});
