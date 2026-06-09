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

export function useRepeatableInstanceEngine({
  schema,
  repInfo,
  baseValues = {},
  initialInstance = {},
}) {
  const [state, setState] = useState(() => createEmptyState(repInfo));
  const [repeatableState, setRepeatableState] = useState(
    () => cloneDeep(initialInstance?.repeatable || {})
  );
  const engineRef = useRef(null);
  const baseValuesRef = useRef(baseValues || {});
  const valuesRef = useRef(initialInstance?.values || {});
  const repeatableStateRef = useRef(cloneDeep(initialInstance?.repeatable || {}));
  const initialSignature = useMemo(
    () => JSON.stringify(initialInstance?.values || {}),
    [initialInstance]
  );
  const baseValuesSignature = useMemo(() => JSON.stringify(baseValues || {}), [baseValues]);

  useEffect(() => {
    valuesRef.current = initialInstance?.values || {};
    const nextRepeatableState = cloneDeep(initialInstance?.repeatable || {});
    repeatableStateRef.current = nextRepeatableState;
    setRepeatableState(nextRepeatableState);
  }, [initialSignature, initialInstance]);

  useEffect(() => {
    repeatableStateRef.current = repeatableState;
  }, [repeatableState]);

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

  return {
    ...state,
    setValue,
    setValues,
    submit: () => cloneDeep(state.values),
    repeatable: repeatableState,
    addRepeatableInstance,
    updateRepeatableInstance,
    removeRepeatableInstance,
    setRepeatableInstances,
    getRepeatableInstances,
    getRepeatableInstance,
    repeatableMetadata,
    buildParentValues: buildParentValuesForPath,
  };
}
