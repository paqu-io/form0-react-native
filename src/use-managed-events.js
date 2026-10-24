import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createEventSession,
  eventDataSignature,
  ownedCollectionSignature,
} from './utils/managed-events.js';

function notify(observer, value) {
  try {
    const result = observer?.(value);
    if (result && typeof result.then === 'function') Promise.resolve(result).catch(() => {});
  } catch {
    /* Host observers do not affect editor initialization. */
  }
}

/** Configuration belongs to an editor session; callbacks remain live. */
export function useEventSession(options, generation) {
  const session = useMemo(() => createEventSession(options?.events), [generation]);
  const controllerRef = useRef(null);
  const observerRef = useRef(null);
  const announce = useCallback(
    (initialized = true) => {
      session.initialized = initialized;
      controllerRef.current = initialized ? session.getController() : null;
      notify(observerRef.current, controllerRef.current);
    },
    [session]
  );
  useEffect(() => {
    controllerRef.current = session.start();
    session.initialized = false;
    return () => {
      session.end();
      notify(observerRef.current, null);
      controllerRef.current = null;
    };
  }, [session]);
  useEffect(() => {
    if (observerRef.current === options?.onEventController) return;
    if (observerRef.current && session.initialized) notify(observerRef.current, null);
    observerRef.current = options?.onEventController;
    if (session.initialized) notify(observerRef.current, controllerRef.current);
  }, [options?.onEventController, session]);
  return { session, announce };
}

/** Root/row adapters share scheduling, lifecycle and fresh custom-finding ownership. */
export function useManagedEventScope({
  session,
  announce,
  getBinding,
  mode,
  recordKind,
  fieldKey,
  active = true,
  validate,
  serialize,
  data,
  initialEventValues,
}) {
  // Collection state is owned by the renderer and replaced on edits/acceptance. Values
  // below remain checked every render because engine value maps themselves are mutable.
  const dataChangeSignature = useMemo(() => ownedCollectionSignature(data), [data]);
  const [findings, setFindings] = useState([]);
  const [preparationSummary, setPreparationSummary] = useState(null);
  const [preparationIssues, setPreparationIssues] = useState([]);
  const preparationSignature = useRef(null);
  const propsRef = useRef({
    mode,
    validate,
    serialize,
    data,
    dataChangeSignature,
  });
  propsRef.current = { mode, validate, serialize, data, dataChangeSignature };
  const handleRef = useRef(null);
  const binding = getBinding();
  const scopeId = active ? binding?.scopeId : null;
  const lifecycleRef = useRef(null);
  useEffect(() => {
    if (!session || !scopeId) return;
    const captured = getBinding();
    if (!captured || captured.scopeId !== scopeId) return;
    const handle = session.register({
      scopeId,
      instancePath: captured.instancePath,
      fieldKey,
      adapter: {
        ...captured,
        dataSignature: () => {
          const values = eventDataSignature(captured.snapshot()?.values) ?? '';
          return `${values.length}:${values}${propsRef.current.dataChangeSignature}`;
        },
        canEdit: () => propsRef.current.mode === 'edit',
        validate: (state) => propsRef.current.validate(state),
        serialize: (state, intent, summary, scheduling) =>
          propsRef.current.serialize(state, intent, summary, scheduling),
        onValidation: (next) => setFindings(next),
        onPreparation: (result) => {
          preparationSignature.current =
            captured.recordCoordinator?.preparedSignature() ||
            captured.recordCoordinator?.signature();
          setPreparationSummary(result.validationSummary || null);
          setPreparationIssues(result.issues || []);
        },
      },
    });
    handleRef.current = handle;
    const lifecycle = { handle, loaded: false, previousMode: null };
    lifecycleRef.current = lifecycle;
    async function initialize() {
      if (session.config.lifecycle) {
        if (initialEventValues) await captured.refreshReads(initialEventValues);
        const result = await handle.dispatch(
          captured.instancePath.length ? 'load-repeatable' : 'load-record'
        );
        if (lifecycleRef.current !== lifecycle) return;
        if (result.status !== 'completed') {
          lifecycle.loaded = true;
          lifecycle.previousMode = propsRef.current.mode;
          announce?.();
          return;
        }
      }
      lifecycle.loaded = true;
      if (session.config.lifecycle && propsRef.current.mode === 'edit') {
        await handle.dispatch(
          `${recordKind === 'new' ? 'new' : 'edit'}-${captured.instancePath.length ? 'repeatable' : 'record'}`
        );
      }
      lifecycle.previousMode = propsRef.current.mode;
      if (lifecycleRef.current === lifecycle) announce?.();
    }
    initialize().catch(() => {});
    return () => {
      handle.retire();
      announce?.(false);
      if (handleRef.current === handle) handleRef.current = null;
      if (lifecycleRef.current === lifecycle) lifecycleRef.current = null;
    };
  }, [session, scopeId, getBinding, fieldKey, recordKind, announce]);
  useEffect(() => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle?.loaded || !session?.config.lifecycle) return;
    if (mode === 'edit' && lifecycle.previousMode !== 'edit')
      lifecycle.handle.dispatch(
        `${recordKind === 'new' ? 'new' : 'edit'}-${fieldKey ? 'repeatable' : 'record'}`
      );
    lifecycle.previousMode = mode;
  }, [mode, session, fieldKey, recordKind]);
  useEffect(() => {
    handleRef.current?.dataChanged();
    const coordinator = getBinding()?.recordCoordinator;
    const currentSignature = coordinator?.changed();
    if (
      preparationSignature.current &&
      preparationSignature.current !== (currentSignature || coordinator?.signature())
    )
      setPreparationSummary(null);
  }, [dataChangeSignature, eventDataSignature(binding?.snapshot()?.values)]);
  const dispatch = useCallback(
    (type, metadata = {}, targetField = fieldKey) =>
      handleRef.current?.dispatch(type, metadata, targetField) ||
      Promise.resolve({
        status: 'failed',
        issues: [{ code: 'scope_closed', message: 'The editor is not available.' }],
      }),
    [fieldKey]
  );
  const change = useCallback(
    (type, fieldName, metadata, update) =>
      handleRef.current?.change(type, fieldName, metadata, update),
    []
  );
  const prepare = useCallback(
    (intent = 'submit') =>
      handleRef.current?.prepare(intent) ||
      Promise.resolve({
        eligible: false,
        payload: null,
        issues: [{ code: 'scope_closed', message: 'The editor is not available.' }],
      }),
    []
  );
  const captureClose = useCallback(() => {
    const target = handleRef.current;
    return async (cancel = false) => {
      if (!session?.config.lifecycle) return { status: 'completed', issues: [] };
      if (!target)
        return {
          status: 'failed',
          issues: [{ code: 'scope_closed', message: 'The editor has ended.' }],
        };
      const suffix = fieldKey ? 'repeatable' : 'record';
      if (cancel) {
        const result = await target.dispatch(`cancel-${suffix}`);
        if (result.status !== 'completed') return result;
      }
      return target.dispatch(`unload-${suffix}`);
    };
  }, [fieldKey, session]);
  const close = useCallback((cancel = false) => captureClose()(cancel), [captureClose]);
  const interaction = useCallback(
    (type, targetField, metadata = {}) => {
      if (session?.config.fieldInteractions.includes(type))
        return dispatch(type, metadata, targetField);
    },
    [dispatch, session]
  );
  return {
    record: Boolean(binding?.recordCoordinator),
    summary: preparationSummary,
    issues: preparationIssues,
    controller: session?.getController(),
    findings,
    dispatch,
    change,
    prepare,
    close,
    captureClose,
    interaction,
    lifecycle: session?.config.lifecycle === true,
  };
}
