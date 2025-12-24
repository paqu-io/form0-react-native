import React, { createContext, useContext, useMemo, useRef } from 'react';
import { createFieldRegistry, defaultFieldRegistry } from './field-registry.js';

export const FieldRegistryContext = createContext(defaultFieldRegistry);

function useStableRendererMap(renderers) {
  const mapRef = useRef(null);
  const keysRef = useRef(null);

  if (!renderers || typeof renderers !== 'object') {
    mapRef.current = null;
    keysRef.current = null;
    return null;
  }

  const entries = Object.entries(renderers).sort(([a], [b]) => {
    if (a === b) return 0;
    return a > b ? 1 : -1;
  });

  let changed = false;

  if (!mapRef.current || !keysRef.current) {
    changed = true;
  } else if (keysRef.current.length !== entries.length) {
    changed = true;
  } else {
    for (let i = 0; i < entries.length; i += 1) {
      const [type, component] = entries[i];
      if (keysRef.current[i] !== type || mapRef.current.get(type) !== component) {
        changed = true;
        break;
      }
    }
  }

  if (changed) {
    const nextMap = new Map();
    entries.forEach(([type, component]) => {
      nextMap.set(type, component);
    });
    mapRef.current = nextMap;
    keysRef.current = entries.map(([type]) => type);
  }

  return mapRef.current;
}

export function FieldRegistryProvider({
  children,
  registry,
  renderers,
  includeDefaults = true,
  trackMissingTypes,
  warnOnUnregisteredTypes,
} = {}) {
  const stableRendererMap = useStableRendererMap(renderers);

  const contextValue = useMemo(() => {
    if (registry) {
      if (stableRendererMap) {
        stableRendererMap.forEach((component, type) => {
          registry.registerFieldComponent(type, component);
        });
      }
      return registry;
    }

    const instance = createFieldRegistry({
      includeDefaults,
      trackMissingTypes,
      warnOnUnregisteredTypes,
    });

    if (stableRendererMap) {
      stableRendererMap.forEach((component, type) => {
        instance.registerFieldComponent(type, component);
      });
    }

    return instance;
  }, [registry, stableRendererMap, includeDefaults, trackMissingTypes, warnOnUnregisteredTypes]);

  return (
    <FieldRegistryContext.Provider value={contextValue}>
      {children}
    </FieldRegistryContext.Provider>
  );
}

export function useFieldRegistry() {
  return useContext(FieldRegistryContext);
}
