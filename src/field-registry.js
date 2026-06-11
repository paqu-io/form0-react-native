import { FIELD_SPECS } from 'form0-core';
import { defaultFieldComponents, placeholderBackedFieldTypes } from './field-components/index.js';

const NON_RENDERED_TYPES = new Set(['Section', 'RepeatableSection', 'BuildingPlanSection']);
const ENGINE_FIELD_TYPES = Object.keys(FIELD_SPECS);
const SUPPORTED_FIELD_TYPES = ENGINE_FIELD_TYPES.filter((type) => !NON_RENDERED_TYPES.has(type));
const KNOWN_FIELD_TYPES = Object.freeze([...SUPPORTED_FIELD_TYPES]);
const KNOWN_FIELD_TYPES_SET = new Set(KNOWN_FIELD_TYPES);
const IS_DEV =
  typeof process !== 'undefined' && process?.env && process.env.NODE_ENV !== 'production';

function assertValidRegistration(type, component) {
  if (typeof type !== 'string' || type.length === 0) {
    throw new Error('form0-react-native: registerFieldComponent requires a field type string.');
  }
  if (!KNOWN_FIELD_TYPES_SET.has(type)) {
    throw new Error(
      [
        `form0-react-native: unknown field type "${type}".`,
        'Only field types defined in form0-core FIELD_SPECS are supported.',
      ].join(' ')
    );
  }
  if (typeof component !== 'function') {
    throw new Error(
      `form0-react-native: registerFieldComponent for "${type}" requires a component.`
    );
  }
}

function createInternalRegistryState({
  includeDefaults = true,
  trackMissingTypes = includeDefaults,
  warnOnUnregisteredTypes = true,
} = {}) {
  const state = {
    includeDefaults,
    trackMissingTypes,
    warnOnUnregisteredTypes,
    registry: new Map(),
    warnedFieldTypes: new Set(),
    missingDefaultFieldTypes: new Set(),
    lastMissingWarningKey: null,
    lastPlaceholderWarningKey: null,
  };

  if (includeDefaults) {
    registerDefaultFieldComponentsInState(state);
  }

  recomputeMissingFieldTypes(state);
  return state;
}

function registerFieldComponentInState(state, type, component) {
  assertValidRegistration(type, component);
  state.registry.set(type, component);
  state.warnedFieldTypes.delete(type);
  recomputeMissingFieldTypes(state);
}

function unregisterFieldComponentInState(state, type) {
  state.registry.delete(type);
  recomputeMissingFieldTypes(state);
}

function getFieldComponentFromState(state, type) {
  const component = state.registry.get(type);
  if (!component && type && state.warnOnUnregisteredTypes && !state.warnedFieldTypes.has(type)) {
    if (IS_DEV) {
      console.warn(`form0-react-native: no renderer registered for "${type}".`);
    }
    state.warnedFieldTypes.add(type);
  }
  return component;
}

function resetFieldComponentsInState(state) {
  state.registry.clear();
  state.warnedFieldTypes.clear();
  if (state.includeDefaults) {
    registerDefaultFieldComponentsInState(state);
  }
  recomputeMissingFieldTypes(state);
  warnAboutPlaceholderBackedFieldTypes(state);
}

function listRegisteredFieldTypesFromState(state) {
  return Array.from(state.registry.keys());
}

function getMissingFieldComponentTypesFromState(state) {
  if (!state.trackMissingTypes) {
    return KNOWN_FIELD_TYPES.filter((type) => !state.registry.has(type));
  }
  return Array.from(state.missingDefaultFieldTypes);
}

function registerDefaultFieldComponentsInState(state) {
  Object.entries(defaultFieldComponents).forEach(([type, component]) => {
    assertValidRegistration(type, component);
    state.registry.set(type, component);
  });
}

function recomputeMissingFieldTypes(state) {
  if (!state.trackMissingTypes) {
    state.missingDefaultFieldTypes.clear();
    state.lastMissingWarningKey = null;
    return;
  }

  state.missingDefaultFieldTypes.clear();
  KNOWN_FIELD_TYPES.forEach((type) => {
    if (!state.registry.has(type)) {
      state.missingDefaultFieldTypes.add(type);
    }
  });
  warnAboutMissingDefaultFieldTypes(state);
}

function warnAboutMissingDefaultFieldTypes(state) {
  if (!state.trackMissingTypes || state.missingDefaultFieldTypes.size === 0) {
    state.lastMissingWarningKey = null;
    return;
  }
  if (!IS_DEV) {
    state.lastMissingWarningKey = null;
    return;
  }

  const missing = Array.from(state.missingDefaultFieldTypes).sort();
  const warningKey = missing.join(',');
  if (warningKey === state.lastMissingWarningKey) {
    return;
  }
  state.lastMissingWarningKey = warningKey;

  console.warn(
    [
      'form0-react-native:',
      'no built-in renderer registered for field type(s):',
      missing.join(', '),
      '.',
      'Use registerFieldComponent(type, component) to provide renderers.',
    ].join(' ')
  );
}

function warnAboutPlaceholderBackedFieldTypes(state) {
  if (!IS_DEV || !state.includeDefaults) {
    state.lastPlaceholderWarningKey = null;
    return;
  }

  const placeholderTypes = placeholderBackedFieldTypes.filter(
    (type) => state.registry.get(type) === defaultFieldComponents[type]
  );
  if (placeholderTypes.length === 0) {
    state.lastPlaceholderWarningKey = null;
    return;
  }

  const warningKey = placeholderTypes.join(',');
  if (warningKey === state.lastPlaceholderWarningKey) {
    return;
  }

  state.lastPlaceholderWarningKey = warningKey;
  console.warn(
    [
      'form0-react-native:',
      'the default renderer for field type(s)',
      placeholderTypes.join(', '),
      'is still a placeholder.',
      'Provide custom renderers for production use until first-class native components ship.',
    ].join(' ')
  );
}

function createRegistryAPI(state) {
  return {
    registerFieldComponent(type, component) {
      registerFieldComponentInState(state, type, component);
    },
    unregisterFieldComponent(type) {
      unregisterFieldComponentInState(state, type);
    },
    resetFieldComponents() {
      resetFieldComponentsInState(state);
    },
    getFieldComponent(type) {
      return getFieldComponentFromState(state, type);
    },
    listRegisteredFieldTypes() {
      return listRegisteredFieldTypesFromState(state);
    },
    getMissingFieldComponentTypes() {
      return getMissingFieldComponentTypesFromState(state);
    },
  };
}

export function createFieldRegistry(options = {}) {
  const {
    includeDefaults = true,
    trackMissingTypes = includeDefaults,
    warnOnUnregisteredTypes = IS_DEV,
    renderers,
  } = options;

  const state = createInternalRegistryState({
    includeDefaults,
    trackMissingTypes,
    warnOnUnregisteredTypes,
  });

  if (renderers && typeof renderers === 'object') {
    Object.entries(renderers).forEach(([type, component]) => {
      registerFieldComponentInState(state, type, component);
    });
  }

  warnAboutPlaceholderBackedFieldTypes(state);

  return createRegistryAPI(state);
}

const defaultFieldRegistry = createFieldRegistry({
  includeDefaults: true,
  trackMissingTypes: IS_DEV,
  warnOnUnregisteredTypes: IS_DEV,
});

export const {
  registerFieldComponent,
  unregisterFieldComponent,
  resetFieldComponents,
  getFieldComponent,
  listRegisteredFieldTypes,
  getMissingFieldComponentTypes,
} = defaultFieldRegistry;

export { defaultFieldRegistry, KNOWN_FIELD_TYPES };
