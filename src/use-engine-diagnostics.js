import { useCallback, useEffect, useRef, useContext } from 'react';
import { RecordCoordinatorContext, attachRecordEngine } from './record-context.jsx';
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
  const recordCoordinator = useContext(RecordCoordinatorContext);
  const engineRef = useRef(null);
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
    engineRef.current?.endRecordScope?.();
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
        const { recordSource, ...engineConfig } = config;
        const engine = createDiagnosticEngine({
          ...engineConfig,
          eventScope: {
            scopeId: scope.scopeId,
            instancePath: attributionRef.current.instancePath,
          },
          helpers: optionsRef.current.helpers,
          security: optionsRef.current.security,
          onWarning: (warning) =>
            scope.isActive?.() ? optionsRef.current.onWarning?.(warning) : undefined,
          onDiagnostics: (snapshot) => scope.accept(snapshot),
        });
        const setValues = engine.setValues;
        engine.setValues = (updates) => {
          const result = setValues(updates);
          recordSource?.notify?.(engine);
          return result;
        };
        engineRef.current = engine;
        if (recordCoordinator) {
          if (!attributionRef.current.instancePath.length)
            recordCoordinator.setSchema(config.schema);
          attachRecordEngine(
            engine,
            recordCoordinator,
            attributionRef.current.instancePath,
            recordSource,
            (snapshot) => scope.accept(snapshot)
          );
        }
        return engine;
      } catch (error) {
        endScope();
        throw error;
      }
    },
    [startScope, endScope, recordCoordinator]
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
  const getScope = useCallback(
    () =>
      scopeRef.current?.isActive?.()
        ? {
            scopeId: scopeRef.current.scopeId,
            instancePath: attributionRef.current.instancePath,
          }
        : null,
    []
  );
  useEffect(() => endScope, [endScope]);
  return {
    createEngine,
    startScope,
    endScope,
    acceptWorkerDiagnostics,
    forwardWarning,
    getScope,
  };
}
