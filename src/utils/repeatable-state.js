import { cloneDeep } from './repeatable-manager.js';

function normalizeState(state) {
  return state && typeof state === 'object' ? state : {};
}

export function resolveRepeatableContainer(state, path = [], { createIfMissing = false } = {}) {
  let container = normalizeState(state);
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
}

export function getRepeatableInstances(state, repeatableKey, parentPath = []) {
  const container = resolveRepeatableContainer(state, parentPath);
  const list = container?.[repeatableKey];
  return Array.isArray(list) ? list : [];
}

export function getRepeatableInstance(state, repeatableKey, instanceId, parentPath = []) {
  const list = getRepeatableInstances(state, repeatableKey, parentPath);
  return list.find((instance) => instance.id === instanceId) || null;
}

export function setRepeatableInstancesInState(state, repeatableKey, instances = [], parentPath = []) {
  const base = normalizeState(state);
  const draft = cloneDeep(base);
  const container = resolveRepeatableContainer(draft, parentPath, { createIfMissing: true }) || draft;
  container[repeatableKey] = Array.isArray(instances) ? cloneDeep(instances) : [];
  return draft;
}

export function addRepeatableInstanceToState(state, repeatableKey, instance, parentPath = []) {
  const base = normalizeState(state);
  const draft = cloneDeep(base);
  const container = resolveRepeatableContainer(draft, parentPath, { createIfMissing: true }) || draft;
  if (!Array.isArray(container[repeatableKey])) {
    container[repeatableKey] = [];
  }
  container[repeatableKey].push(instance);
  return draft;
}

export function updateRepeatableInstanceInState(
  state,
  repeatableKey,
  instanceId,
  updater,
  parentPath = []
) {
  const base = normalizeState(state);
  const draft = cloneDeep(base);
  const container = resolveRepeatableContainer(draft, parentPath);
  if (!container) {
    return base;
  }

  const list = container[repeatableKey];
  if (!Array.isArray(list)) {
    return base;
  }

  const index = list.findIndex((instance) => instance.id === instanceId);
  if (index === -1) {
    return base;
  }

  const current = list[index];
  list[index] =
    typeof updater === 'function' ? updater(cloneDeep(current)) : { ...current, ...updater };
  return draft;
}

export function removeRepeatableInstanceFromState(state, repeatableKey, instanceId, parentPath = []) {
  const base = normalizeState(state);
  const draft = cloneDeep(base);
  const container = resolveRepeatableContainer(draft, parentPath);
  if (!container) {
    return base;
  }

  const list = container[repeatableKey];
  if (!Array.isArray(list)) {
    return base;
  }

  const index = list.findIndex((instance) => instance.id === instanceId);
  if (index === -1) {
    return base;
  }

  list.splice(index, 1);
  return draft;
}

export function buildRepeatableParentValues({
  seedValues = {},
  repeatableState = {},
  path = [],
}) {
  let merged = { ...(seedValues || {}) };
  const traversePath = [];

  path.forEach(({ key, id }) => {
    const instance = getRepeatableInstance(repeatableState, key, id, traversePath);
    if (instance?.values) {
      merged = { ...merged, ...instance.values };
    }
    traversePath.push({ key, id });
  });

  return merged;
}
