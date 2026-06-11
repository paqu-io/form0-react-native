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

export function useFormEngine(schema, initialValues = {}, overrideValues, options = {}) {
  const [state, setState] = useState(createEmptyState);
  const [engineReadyVersion, setEngineReadyVersion] = useState(0);
  const engineRef = useRef(null);
  const initialValuesRef = useRef(initialValues || {});
  const overrideValuesRef = useRef(overrideValues || null);
  const optionsRef = useRef(options || {});
  const warningCleanupRef = useRef(null);
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

  useEffect(() => {
    optionsRef.current = options || {};
  }, [options]);

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
        helpers: optionsRef.current.helpers,
        security: optionsRef.current.security,
      });
      engine.eval();
      engineRef.current = engine;
      syncState();
      setEngineReadyVersion((version) => version + 1);
    },
    [preparedSchema, syncState]
  );

  useEffect(() => {
    rebuildEngine(initialValuesRef.current);
  }, [rebuildEngine, initialValuesSignature]);

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

  const defaultProcessOperations = useCallback(
    (operations = []) => {
      if (!Array.isArray(operations) || operations.length === 0) {
        return;
      }

      const pendingValueUpdates = {};

      operations.forEach((operation) => {
        if (!operation || typeof operation !== 'object') {
          return;
        }

        const { type, operation: operationName, params = {} } = operation;
        if (type === 'FIELD_OPERATION' && operationName === 'SETVALUE') {
          const { fieldDataName, valueToSet } = params || {};
          if (typeof fieldDataName !== 'string' || fieldDataName.length === 0) {
            console.warn('form0-react-native: SETVALUE operation missing fieldDataName.', operation);
            return;
          }
          pendingValueUpdates[fieldDataName] = cloneDeep(valueToSet);
          return;
        }

        if (type === 'UI_OPERATION' || type === 'FIELD_OPERATION') {
          console.warn(
            'form0-react-native: unhandled operation received. Provide engineOptions.onOperations to customize it.',
            operation
          );
        }
      });

      if (Object.keys(pendingValueUpdates).length > 0) {
        setValues(pendingValueUpdates);
      }
    },
    [setValues]
  );

  const processOperations = useCallback(
    (operations = [], meta = {}) => {
      if (!Array.isArray(operations) || operations.length === 0) {
        return;
      }

      const handler = optionsRef.current.onOperations;
      if (typeof handler === 'function') {
        handler(operations, meta, defaultProcessOperations);
        return;
      }

      defaultProcessOperations(operations, meta);
    },
    [defaultProcessOperations]
  );

  const triggerEvent = useCallback(
    (eventType, fieldKey = null, metadata = {}) => {
      if (typeof eventType !== 'string' || eventType.length === 0) {
        console.warn('form0-react-native: triggerEvent requires a non-empty eventType string.');
        return [];
      }

      if (!engineRef.current) {
        return [];
      }

      try {
        const operations = engineRef.current.trigger(eventType, fieldKey, metadata) || [];
        if (operations.length > 0) {
          processOperations(operations, { eventType, fieldKey, metadata });
        }
        return operations;
      } catch (error) {
        console.warn('form0-react-native: triggerEvent failed.', error);
        return [];
      }
    },
    [processOperations]
  );

  useEffect(() => {
    if (!overrideValuesRef.current || !engineRef.current) {
      return;
    }
    setValues(overrideValuesRef.current);
  }, [overrideSignature, setValues]);

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

  useEffect(() => {
    const handler = optionsRef.current.onUpdate;
    if (typeof handler === 'function' && engineRef.current) {
      handler({ ...state }, engineRef.current);
    }
  }, [state]);

  useEffect(() => {
    if (warningCleanupRef.current) {
      warningCleanupRef.current();
      warningCleanupRef.current = null;
    }

    const warningHandler = optionsRef.current.onWarning;
    if (typeof warningHandler !== 'function') {
      return;
    }

    const warningSystem = engineRef.current?.getWarningSystem?.();
    if (!warningSystem || typeof warningSystem.addWarningHandler !== 'function') {
      return;
    }

    const proxy = (warning) => {
      const latest = optionsRef.current.onWarning;
      if (typeof latest === 'function') {
        latest(warning);
      }
    };

    warningSystem.addWarningHandler(proxy);
    warningCleanupRef.current = () => warningSystem.removeWarningHandler(proxy);

    return () => {
      if (warningCleanupRef.current) {
        warningCleanupRef.current();
        warningCleanupRef.current = null;
      } else {
        warningSystem.removeWarningHandler(proxy);
      }
    };
  }, [engineReadyVersion, options?.onWarning]);

  useEffect(() => {
    return () => {
      if (warningCleanupRef.current) {
        warningCleanupRef.current();
        warningCleanupRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    setValue,
    setValues,
    reset,
    submit,
    triggerEvent,
    processOperations,
    schema: preparedSchema,
    engine: engineRef.current,
    engineReadyVersion,
  };
}
