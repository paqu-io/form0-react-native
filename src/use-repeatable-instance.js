import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFormEngine } from 'form0-core';
import {
  buildRepeatableInfo,
  cloneDeep,
  createEmptyRepeatableInstance,
} from './utils/repeatable-manager.js';

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
  const initialSignature = useMemo(
    () => JSON.stringify(initialInstance?.values || {}),
    [initialInstance]
  );

  useEffect(() => {
    baseValuesRef.current = baseValues || {};
  }, [baseValues]);

  useEffect(() => {
    valuesRef.current = initialInstance?.values || {};
    setRepeatableState(cloneDeep(initialInstance?.repeatable || {}));
  }, [initialSignature, initialInstance]);

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

  const resolveRepeatableContainer = useCallback(
    (state, path = [], { createIfMissing = false } = {}) => {
      let container = state || {};
      if (!Array.isArray(path) || path.length === 0) {
        return container;
      }
      for (const segment of path) {
        if (!segment || typeof segment.key !== 'string') {
          return null;
        }
        const list = container?.[segment.key];
        if (!Array.isArray(list)) {
          return null;
        }
        const targetIndex = list.findIndex((instance) => instance.id === segment.id);
        if (targetIndex === -1) {
          return null;
        }
        const target = list[targetIndex];
        if (!target.repeatable || typeof target.repeatable !== 'object') {
          if (createIfMissing) {
            target.repeatable = {};
          } else {
            return null;
          }
        }
        container = target.repeatable;
      }
      return container;
    },
    []
  );

  const setRepeatableSlice = useCallback((updater) => {
    setRepeatableState((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const draft = cloneDeep(base);
      updater(draft);
      return draft;
    });
  }, []);

  const getRepeatableInstances = useCallback(
    (repeatableKey, parentPath = []) => {
      const container = resolveRepeatableContainer(repeatableState, parentPath);
      const list = container?.[repeatableKey];
      return Array.isArray(list) ? list : [];
    },
    [repeatableState, resolveRepeatableContainer]
  );

  const getRepeatableInstance = useCallback(
    (repeatableKey, instanceId, parentPath = []) => {
      const list = getRepeatableInstances(repeatableKey, parentPath);
      return list.find((instance) => instance.id === instanceId) || null;
    },
    [getRepeatableInstances]
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
        const container =
          resolveRepeatableContainer(draft, parentPath, { createIfMissing: true }) || draft;
        if (!Array.isArray(container[repeatableKey])) {
          container[repeatableKey] = [];
        }
        container[repeatableKey].push(newInstance);
      });
      return newInstance;
    },
    [repeatableMetadata, resolveRepeatableContainer, setRepeatableSlice]
  );

  const updateRepeatableInstance = useCallback(
    (repeatableKey, instanceId, updater, parentPath = []) => {
      setRepeatableSlice((draft) => {
        const container = resolveRepeatableContainer(draft, parentPath);
        if (!container) {
          return;
        }
        const list = container[repeatableKey];
        if (!Array.isArray(list)) {
          return;
        }
        const index = list.findIndex((instance) => instance.id === instanceId);
        if (index === -1) {
          return;
        }
        const current = list[index];
        const nextInstance =
          typeof updater === 'function'
            ? updater(cloneDeep(current))
            : { ...current, ...updater };
        list[index] = nextInstance;
      });
    },
    [resolveRepeatableContainer, setRepeatableSlice]
  );

  const removeRepeatableInstance = useCallback(
    (repeatableKey, instanceId, parentPath = []) => {
      setRepeatableSlice((draft) => {
        const container = resolveRepeatableContainer(draft, parentPath);
        if (!container) {
          return;
        }
        const list = container[repeatableKey];
        if (!Array.isArray(list)) {
          return;
        }
        const index = list.findIndex((instance) => instance.id === instanceId);
        if (index === -1) {
          return;
        }
        list.splice(index, 1);
      });
    },
    [resolveRepeatableContainer, setRepeatableSlice]
  );

  const setRepeatableInstances = useCallback(
    (repeatableKey, instances = [], parentPath = []) => {
      setRepeatableSlice((draft) => {
        const container =
          resolveRepeatableContainer(draft, parentPath, { createIfMissing: true }) || draft;
        container[repeatableKey] = Array.isArray(instances) ? cloneDeep(instances) : [];
      });
    },
    [resolveRepeatableContainer, setRepeatableSlice]
  );

  const buildParentValuesForPath = useCallback(
    (path = []) => {
      let merged = { ...(baseValuesRef.current || {}) };
      const traversePath = [];
      path.forEach(({ key, id }) => {
        const instance = getRepeatableInstance(key, id, traversePath);
        if (instance?.values) {
          merged = { ...merged, ...instance.values };
        }
        traversePath.push({ key, id });
      });
      return merged;
    },
    [getRepeatableInstance]
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
