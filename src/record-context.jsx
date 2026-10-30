import React, { createContext, useEffect, useMemo, useRef } from 'react';
import { eventDataSignature } from './utils/managed-events.js';
import {
  createRecordCoordinator,
  applyRecordState,
  applyClearedFieldUpdates,
  createEditorSignature,
} from './utils/record-coordinator.js';

const appliedTrees = new WeakMap();

/** A prepared selection already contains this editor's evaluated state. Consume once on paint. */
export function consumeAppliedRecordTree(engine, tree) {
  const applied = appliedTrees.get(engine) === tree;
  appliedTrees.delete(engine);
  return applied;
}

export const RecordCoordinatorContext = createContext(null);

export function RecordCoordinatorProvider({
  children,
  schema,
  engineOptions,
  initialSnapshot,
  initialValues,
  initialFreshness,
  submissionOptions,
}) {
  const props = useRef(null);
  props.current = { initialFreshness, submissionOptions };
  const seedSignature = useMemo(
    () => eventDataSignature(initialSnapshot || { values: initialValues || {}, repeatable: {} }),
    [initialSnapshot, initialValues]
  );
  const coordinator = useMemo(
    () =>
      createRecordCoordinator({
        schema,
        helpers: engineOptions?.helpers,
        security: engineOptions?.security,
        getOptions: () => props.current,
        seed: initialSnapshot || {
          values: initialValues || {},
          repeatable: {},
        },
      }),
    [schema, seedSignature, engineOptions?.helpers, engineOptions?.security]
  );
  useEffect(() => () => coordinator.dispose(), [coordinator]);
  return (
    <RecordCoordinatorContext.Provider value={coordinator}>
      {children}
    </RecordCoordinatorContext.Provider>
  );
}

/** Live engines remain event owners; collection-aware calculation uses the shared record context. */
export function attachRecordEngine(engine, coordinator, path, source, report) {
  let active = true;
  let pending = Promise.resolve();
  let sequence = 0;
  const read = () => ({
    ...(source?.metadata?.() || {}),
    values: source?.pickValues
      ? source.pickValues(engine.getState().values)
      : engine.getState().values,
    repeatable: source?.repeatable?.() || {},
  });
  const apply = async (snapshot) => {
    applyRecordState(engine, snapshot);
    const repeatable = snapshot.repeatable || {};
    appliedTrees.set(engine, repeatable);
    source?.setRepeatable?.(repeatable);
    source?.notify?.(engine);
  };
  const release = coordinator.bind(path, {
    read,
    signature: createEditorSignature(read),
    apply,
    acknowledged: () => source?.acknowledged?.(),
  });
  engine.recordCoordinator = coordinator;
  engine.endRecordScope = () => {
    active = false;
    release();
  };
  engine.applyRecordSnapshot = apply;
  if (!coordinator.hasCollections()) return engine;
  engine.eval = () => {
    const version = ++sequence;
    coordinator.changed();
    const capturedRepeatable = source?.repeatable?.();
    pending = coordinator.evaluate(path, { interactionMode: engine.getMode() }).then((result) => {
      if (
        !active ||
        version !== sequence ||
        (result.clearedFields?.length && source?.repeatable?.() !== capturedRepeatable)
      )
        return;
      if (result.status !== 'evaluated') {
        throw new Error(result.issues?.[0]?.message || 'Record scope evaluation failed.');
      }
      const before = source?.repeatable?.() || {};
      const updated = applyClearedFieldUpdates(
        { ...result.state, repeatable: before },
        result.clearedFields,
        path
      );
      applyRecordState(engine, updated);
      if (updated.repeatable !== before) {
        appliedTrees.set(engine, updated.repeatable);
        source?.setRepeatable?.(updated.repeatable);
      }
      report(result.diagnostics || []);
      source?.notify?.(engine);
    });
    pending.catch(() => {});
    return pending;
  };
  engine.readState = async () => {
    await pending;
    return engine.getState();
  };
  return engine;
}

/** Worker transport uses the same host coordinator; complete proposals stay in its worker backend. */
export function attachRecordWorker(client, coordinator, path, source = {}) {
  const read = () => ({
    ...(source.metadata?.() || {}),
    values: source.pickValues
      ? source.pickValues(client.getState()?.values || {})
      : client.getState()?.values || {},
    repeatable: source.repeatable?.() || {},
  });
  const release = coordinator.bind(path, {
    read,
    signature: createEditorSignature(read),
    async apply(snapshot) {
      await client.applyRecordState(snapshot);
      const repeatable = snapshot.repeatable || {};
      appliedTrees.set(client, repeatable);
      source.setRepeatable?.(repeatable);
    },
    acknowledged: source.acknowledged,
  });
  client.recordCoordinator = coordinator;
  client.getRetentionContext = () => source.repeatable?.();
  client.onRetentionClears = (fields) => {
    const before = read();
    const updated = applyClearedFieldUpdates(before, fields, path);
    if (updated.repeatable !== before.repeatable) {
      appliedTrees.set(client, updated.repeatable);
      source.setRepeatable?.(updated.repeatable);
    }
  };
  const terminate = client.terminate.bind(client);
  client.terminate = () => {
    release();
    terminate();
  };
  if (!path.length)
    coordinator.setBackend({
      evaluateScope: (snapshot, options) => client.evaluateRecordScope(snapshot, options),
      prepare: (snapshot, options) => client.prepareRecord(snapshot, options),
      getChanges: (page) => client.recordChanges(page),
      release: () => client.releaseRecord(),
      dispose: () => client.releaseRecord(),
    });
  if (coordinator.hasCollections())
    for (const method of ['eval', 'setValues']) {
      const original = client[method].bind(client);
      client[method] = async (...args) => {
        coordinator.changed();
        await client.syncRecordContext(coordinator.capture(path), path);
        return original(...args);
      };
    }
}
