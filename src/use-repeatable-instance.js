import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFormEngine } from 'form0-core';
import {
  buildRepeatableInfo,
  cloneDeep,
  createEmptyRepeatableInstance,
} from './utils/repeatable-manager.js';
import {
  addRepeatableInstanceToState,
  buildRepeatableParentValues,
  getRepeatableInstance as getRepeatableInstanceFromState,
  getRepeatableInstances as getRepeatableInstancesFromState,
  removeRepeatableInstanceFromState,
  setRepeatableInstancesInState,
  updateRepeatableInstanceInState,
} from './utils/repeatable-state.js';

const createEmptyState = (repInfo) => {
  const values = {};
  if (repInfo?.fields) {
    for (const [fieldName] of repInfo.fields) {
      values[fieldName] = null;
    }
  }
  return {
    values,
    visible: {},
    required: {},
    read_only: {},
    errors: {},
  };
};

const buildInstanceSeedSignature = (instance = {}) =>
  JSON.stringify({
    values: instance?.values || {},
    repeatable: instance?.repeatable || {},
  });

export function useRepeatableInstanceEngine({
  schema,
  repInfo,
  baseValues = {},
  initialInstance = {},
  options = {},
}) {
  const [state, setState] = useState(() => createEmptyState(repInfo));
  const [engineReadyVersion, setEngineReadyVersion] = useState(0);
  const [repeatableState, setRepeatableState] = useState(
    () => cloneDeep(initialInstance?.repeatable || {})
  );
  const engineRef = useRef(null);
  const baseValuesRef = useRef(baseValues || {});
  const valuesRef = useRef(initialInstance?.values || {});
  const repeatableStateRef = useRef(cloneDeep(initialInstance?.repeatable || {}));
  const optionsRef = useRef(options || {});
  const warningCleanupRef = useRef(null);
  const initialSeedSignature = useMemo(
    () => buildInstanceSeedSignature(initialInstance),
    [initialInstance]
  );
  const baseValuesSignature = useMemo(() => JSON.stringify(baseValues || {}), [baseValues]);

  useEffect(() => {
    valuesRef.current = cloneDeep(initialInstance?.values || {});
    const nextRepeatableState = cloneDeep(initialInstance?.repeatable || {});
    repeatableStateRef.current = nextRepeatableState;
    setRepeatableState(nextRepeatableState);
  }, [initialSeedSignature]);

  useEffect(() => {
    repeatableStateRef.current = repeatableState;
  }, [repeatableState]);

  useEffect(() => {
    optionsRef.current = options || {};
  }, [options]);

  const fieldNames = useMemo(() => {
    if (!repInfo?.fields) return [];
    return Array.from(repInfo.fields.keys());
  }, [repInfo]);
  const fieldNameSet = useMemo(() => new Set(fieldNames), [fieldNames]);

  const reduceEngineState = useCallback(
    (engineState) => {
      if (!engineState) {
        return createEmptyState(repInfo);
      }
      const pick = (map = {}) => {
        const slice = {};
        fieldNames.forEach((name) => {
          if (Object.prototype.hasOwnProperty.call(map, name)) {
            slice[name] = map[name];
          }
        });
        return slice;
      };
      return {
        values: pick(engineState.values || {}),
        errors: pick(engineState.errors || {}),
        visible: pick(engineState.visible || {}),
        required: pick(engineState.required || {}),
        read_only: pick(engineState.read_only || {}),
      };
    },
    [fieldNames, repInfo]
  );

  const buildEngine = useCallback(
    (instanceValues) => {
      const mergedValues = {
        ...(baseValuesRef.current || {}),
        ...(instanceValues || {}),
      };
      const engine = createFormEngine({
        schema,
        initialValues: mergedValues,
        helpers: optionsRef.current.helpers,
        security: optionsRef.current.security,
      });
      engine.eval();
      return engine;
    },
    [schema]
  );

  const syncState = useCallback(
    (engine) => {
      if (!engine) {
        setState(createEmptyState(repInfo));
        return;
      }
      const engineState = reduceEngineState(engine.getState());
      setState(engineState);
      valuesRef.current = engineState.values;
    },
    [reduceEngineState, repInfo]
  );

  const rebuildEngine = useCallback(
    (instanceValues = valuesRef.current) => {
      if (!schema || !repInfo) {
        engineRef.current = null;
        setState(createEmptyState(repInfo));
        return;
      }
      const engine = buildEngine(instanceValues);
      engineRef.current = engine;
      syncState(engine);
      setEngineReadyVersion((version) => version + 1);
    },
    [buildEngine, repInfo, schema, syncState]
  );

  useEffect(() => {
    rebuildEngine(valuesRef.current);
  }, [rebuildEngine]);

  useEffect(() => {
    baseValuesRef.current = baseValues || {};
    if (!engineRef.current) {
      return;
    }
    rebuildEngine(valuesRef.current);
  }, [baseValuesSignature, rebuildEngine]);

  const filterUpdates = useCallback(
    (updates = {}) => {
      if (!updates || typeof updates !== 'object') return {};
      if (fieldNameSet.size === 0) return { ...updates };
      const filtered = {};
      Object.entries(updates).forEach(([key, value]) => {
        if (fieldNameSet.has(key)) {
          filtered[key] = value;
        }
      });
      return filtered;
    },
    [fieldNameSet]
  );

  const setValues = useCallback(
    (updates = {}) => {
      const filtered = filterUpdates(updates);
      if (!engineRef.current || Object.keys(filtered).length === 0) return;
      const engineState = engineRef.current.getState();
      let dirty = false;
      Object.entries(filtered).forEach(([field, value]) => {
        if (engineState.values[field] !== value) {
          engineState.values[field] = value;
          dirty = true;
        }
      });
      if (dirty) {
        engineRef.current.eval();
        syncState(engineRef.current);
      }
    },
    [filterUpdates, syncState]
  );

  const setValue = useCallback(
    (field, value) => {
      if (!field) return;
      setValues({ [field]: value });
    },
    [setValues]
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
            'form0-react-native: unhandled repeatable operation received. Provide engineOptions.onOperations to customize it.',
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
        console.warn('form0-react-native: triggerEvent failed inside repeatable editor.', error);
        return [];
      }
    },
    [processOperations]
  );

  const repeatableMetadata = useMemo(() => {
    if (!repInfo?.field?.elements) {
      return {
        repeatableSectionTree: new Map(),
        fieldOwnership: new Map(),
        sectionFields: new Set(),
        byPreferredKey: new Map(),
      };
    }
    return buildRepeatableInfo(repInfo.field.elements);
  }, [repInfo]);

  const setRepeatableSlice = useCallback((updater) => {
    setRepeatableState((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = updater(base);
      repeatableStateRef.current = next;
      return next;
    });
  }, []);

  const getRepeatableInstances = useCallback(
    (repeatableKey, parentPath = []) => {
      return getRepeatableInstancesFromState(repeatableStateRef.current, repeatableKey, parentPath);
    },
    []
  );

  const getRepeatableInstance = useCallback(
    (repeatableKey, instanceId, parentPath = []) => {
      return getRepeatableInstanceFromState(
        repeatableStateRef.current,
        repeatableKey,
        instanceId,
        parentPath
      );
    },
    []
  );

  const addRepeatableInstance = useCallback(
    (repeatableKey, { parentPath = [], seedValues = {}, instanceId } = {}) => {
      const childRepInfo = repeatableMetadata.byPreferredKey.get(repeatableKey);
      if (!childRepInfo) {
        console.warn(`form0-react-native: unknown nested RepeatableSection "${repeatableKey}"`);
        return null;
      }
      const newInstance = createEmptyRepeatableInstance(childRepInfo);
      if (instanceId) {
        newInstance.id = instanceId;
      }
      newInstance.values = { ...newInstance.values, ...(seedValues || {}) };
      setRepeatableSlice((draft) => {
        return addRepeatableInstanceToState(draft, repeatableKey, newInstance, parentPath);
      });
      return newInstance;
    },
    [repeatableMetadata, setRepeatableSlice]
  );

  const updateRepeatableInstance = useCallback(
    (repeatableKey, instanceId, updater, parentPath = []) => {
      setRepeatableSlice((draft) => {
        return updateRepeatableInstanceInState(draft, repeatableKey, instanceId, updater, parentPath);
      });
    },
    [setRepeatableSlice]
  );

  const removeRepeatableInstance = useCallback(
    (repeatableKey, instanceId, parentPath = []) => {
      setRepeatableSlice((draft) => {
        return removeRepeatableInstanceFromState(draft, repeatableKey, instanceId, parentPath);
      });
    },
    [setRepeatableSlice]
  );

  const setRepeatableInstances = useCallback(
    (repeatableKey, instances = [], parentPath = []) => {
      setRepeatableSlice((draft) => {
        return setRepeatableInstancesInState(draft, repeatableKey, instances, parentPath);
      });
    },
    [setRepeatableSlice]
  );

  const buildParentValuesForPath = useCallback(
    (path = []) => {
      return buildRepeatableParentValues({
        seedValues: {
          ...(baseValuesRef.current || {}),
          ...(valuesRef.current || {}),
        },
        repeatableState: repeatableStateRef.current,
        path,
      });
    },
    []
  );

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
    submit: () => cloneDeep(state.values),
    triggerEvent,
    processOperations,
    repeatable: repeatableState,
    addRepeatableInstance,
    updateRepeatableInstance,
    removeRepeatableInstance,
    setRepeatableInstances,
    getRepeatableInstances,
    getRepeatableInstance,
    repeatableMetadata,
    buildParentValues: buildParentValuesForPath,
    engineReadyVersion,
  };
}
