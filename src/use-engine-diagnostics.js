import { useCallback, useEffect, useRef } from 'react';
import {
  createBindingDiagnosticScope,
  createDiagnosticEngine,
} from './utils/engine-diagnostics.js';

/** Private bridge shared by root and row hooks; observers are read at delivery time. */
export function useEngineDiagnostics(
  options,
  fieldNames,
  instancePath = [],
  active = true,
  generation
) {
  const optionsRef = useRef(options || {});
  const attributionRef = useRef({ fieldNames, instancePath });
  const scopeRef = useRef(null);
  const activeRef = useRef(active);
  const generationRef = useRef(generation);
  useEffect(() => {
    optionsRef.current = options || {};
    activeRef.current = active;
    if (!active || generationRef.current !== generation) {
      scopeRef.current?.end();
      scopeRef.current = null;
    }
    generationRef.current = generation;
    attributionRef.current = { fieldNames, instancePath };
    scopeRef.current?.setConsole(options?.diagnostics?.console);
  });
  const endScope = useCallback(() => {
    scopeRef.current?.end();
    scopeRef.current = null;
  }, []);
  const startScope = useCallback(() => {
    endScope();
    if (!activeRef.current) return { scopeId: 'inactive', accept: () => false };
    const scope = createBindingDiagnosticScope({
      ...attributionRef.current,
      getOptions: () => optionsRef.current,
    });
    scopeRef.current = scope;
    return scope;
  }, [endScope]);
  const createEngine = useCallback(
    (config) => {
      const scope = startScope();
      try {
        return createDiagnosticEngine({
          ...config,
          helpers: optionsRef.current.helpers,
          security: optionsRef.current.security,
          onWarning: (warning) =>
            scope.isActive?.() ? optionsRef.current.onWarning?.(warning) : undefined,
          onDiagnostics: (snapshot) => scope.accept(snapshot),
        });
      } catch (error) {
        endScope();
        throw error;
      }
    },
    [startScope, endScope]
  );
  const acceptWorkerDiagnostics = useCallback((payload) => {
    const scope = scopeRef.current;
    return scope && scope.scopeId === payload?.scopeId
      ? scope.accept(payload.diagnostics, payload.evaluationId)
      : false;
  }, []);
  const forwardWarning = useCallback(
    (warning) =>
      scopeRef.current?.isActive?.() ? optionsRef.current.onWarning?.(warning) : undefined,
    []
  );
  useEffect(() => endScope, [endScope]);
  return {
    createEngine,
    startScope,
    endScope,
    acceptWorkerDiagnostics,
    forwardWarning,
  };
}
