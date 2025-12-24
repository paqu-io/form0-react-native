import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFormEngine, validateSchema } from 'form0-core';
import { ensureKeys } from './utils/ensure-keys';

const createEmptyState = () => ({
  values: {},
  visible: {},
  required: {},
  read_only: {},
  errors: {},
});

const cloneDeep = (value) => {
  if (value == null) return value;
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

function hasMissingKeys(elements) {
  if (!Array.isArray(elements)) return false;
  for (const el of elements) {
    if (!el) continue;
    if (!el.key && el.data_name) {
      return true;
    }
    if (el.type === 'Section' && hasMissingKeys(el.elements || [])) {
      return true;
    }
  }
  return false;
}

function prepareSchema(schema) {
  if (!schema) return null;
  const copy = cloneDeep(schema);
  if (copy?.form?.elements && hasMissingKeys(copy.form.elements)) {
    ensureKeys(copy.form.elements);
  }
  if (copy?.form) {
    validateSchema(copy.form);
  }
  return copy;
}

export function useFormEngine(schema, initialValues = {}, overrideValues) {
  const [state, setState] = useState(createEmptyState);
  const engineRef = useRef(null);
  const initialValuesRef = useRef(initialValues || {});
  const overrideValuesRef = useRef(overrideValues || null);
  const initialValuesSignature = useMemo(
    () => JSON.stringify(initialValues || {}),
    [initialValues]
  );
  const overrideSignature = useMemo(
    () => (overrideValues ? JSON.stringify(overrideValues) : null),
    [overrideValues]
  );

  const preparedSchema = useMemo(() => prepareSchema(schema), [schema]);

  useEffect(() => {
    initialValuesRef.current = initialValues || {};
  }, [initialValues]);

  useEffect(() => {
    overrideValuesRef.current = overrideValues || null;
  }, [overrideValues]);

  const syncState = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) {
      setState(createEmptyState());
      return;
    }
    const nextState = engine.getState();
    setState({
      values: { ...(nextState.values || {}) },
      visible: { ...(nextState.visible || {}) },
      required: { ...(nextState.required || {}) },
      read_only: { ...(nextState.read_only || {}) },
      errors: { ...(nextState.errors || {}) },
    });
  }, []);

  const rebuildEngine = useCallback(
    (seedValues = initialValuesRef.current) => {
      if (!preparedSchema) {
        engineRef.current = null;
        setState(createEmptyState());
        return;
      }
      const engine = createFormEngine({
        schema: preparedSchema,
        initialValues: { ...(seedValues || {}) },
      });
      engine.eval();
      engineRef.current = engine;
      syncState();
    },
    [preparedSchema, syncState]
  );

  useEffect(() => {
    rebuildEngine(initialValuesRef.current);
  }, [rebuildEngine, initialValuesSignature]);

  useEffect(() => {
    if (!engineRef.current || !overrideValuesRef.current) return;
    const updates = overrideValuesRef.current;
    Object.entries(updates).forEach(([field, value]) => {
      engineRef.current.getState().values[field] = value;
    });
    engineRef.current.eval();
    syncState();
  }, [overrideSignature, syncState]);

  const setValues = useCallback(
    (updates = {}) => {
      const engine = engineRef.current;
      if (!engine || !updates || typeof updates !== 'object') return;
      const stateRef = engine.getState();
      let dirty = false;
      Object.entries(updates).forEach(([field, value]) => {
        if (stateRef.values[field] !== value) {
          stateRef.values[field] = value;
          dirty = true;
        }
      });
      if (dirty) {
        engine.eval();
        syncState();
      }
    },
    [syncState]
  );

  const setValue = useCallback(
    (field, value) => {
      if (!field) return;
      setValues({ [field]: value });
    },
    [setValues]
  );

  const reset = useCallback(
    (nextValues = initialValuesRef.current) => {
      rebuildEngine(nextValues || {});
    },
    [rebuildEngine]
  );

  const submit = useCallback(() => {
    const engine = engineRef.current;
    return engine?.getState()?.values ? cloneDeep(engine.getState().values) : {};
  }, []);

  return {
    ...state,
    setValue,
    setValues,
    reset,
    submit,
    schema: preparedSchema,
    engine: engineRef.current,
  };
}
