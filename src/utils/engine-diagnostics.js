import { createFormEngine, WarningSystem } from 'form0-core';
import { createDiagnosticReporter } from './calculation-diagnostics.js';

const copy = (value) => JSON.parse(JSON.stringify(value));
let nextScopeId = 0;
const labels = {
  'diagnostics.error': 'Error',
  'diagnostics.warning': 'Warning',
  'diagnostics.runtime': 'runtime',
  'diagnostics.code': 'Code',
  'diagnostics.source': 'Source',
  'diagnostics.phase': 'Phase',
  'diagnostics.suggestion': 'Suggestion',
  'diagnostics.and': 'and',
};
function translate(key, vars = {}) {
  if (key === 'diagnostics.heading') return `[form0] Calculation diagnostics: ${vars.summary}`;
  if (key === 'diagnostics.finding')
    return `[form0] ${vars.severity} in ${vars.field}: ${vars.message}`;
  if (key === 'diagnostics.resolved')
    return `[form0] Previous calculation findings cleared: ${vars.count}.`;
  if (key === 'diagnostics.position') return `position ${vars.index}`;
  if (key === 'diagnostics.oneError') return '1 error';
  if (key === 'diagnostics.oneWarning') return '1 warning';
  if (key === 'diagnostics.errors') return `${vars.count} errors`;
  if (key === 'diagnostics.warnings') return `${vars.count} warnings`;
  return labels[key] || key;
}
function scopeLabel(path) {
  return path.length
    ? path
        .map(
          (p) =>
            `${p.repeatableKey}[${p.instanceId == null ? `position ${p.index + 1}` : p.instanceId}]`
        )
        .join(' / ')
    : 'root';
}
function safely(call, onFailure = () => {}) {
  try {
    const result = call();
    if (result && typeof result.then === 'function') Promise.resolve(result).catch(onFailure);
  } catch {
    onFailure();
  }
}

/** Reporting-only scope. It never mutates an engine or a saved record. */
export function createBindingDiagnosticScope({
  fieldNames,
  instancePath = [],
  getOptions = () => ({}),
  emit,
} = {}) {
  const scopeId = `form0-scope-${++nextScopeId}`;
  const path = copy(instancePath);
  const owned = fieldNames == null ? null : new Set(fieldNames);
  let evaluationId = 0;
  let active = true;
  let enabled = getOptions()?.diagnostics?.console !== false;
  const output =
    emit ||
    ((event) => {
      const method =
        event.severity === 'error' ? 'error' : event.severity === 'warning' ? 'warn' : 'info';
      const prefix = event.kind === 'diagnostic' ? '' : `[${scopeLabel(path)}] `;
      console[method](prefix + event.text);
    });
  const reporter = createDiagnosticReporter({ translate, emit: output });
  const metadata = (kind) => ({
    scopeId,
    instancePath: copy(path),
    evaluationId,
    kind,
  });
  function notify(snapshot, kind) {
    const handler = getOptions()?.onDiagnostics;
    if (typeof handler !== 'function') return;
    safely(
      () => handler(copy(snapshot), metadata(kind)),
      () => {
        if (enabled)
          safely(() =>
            output({
              kind: 'observer-failure',
              text: '[form0] onDiagnostics observer failed.',
            })
          );
      }
    );
  }
  function setConsole(value) {
    const next = value !== false;
    if (next && !enabled) reporter.reset({ keepSnapshot: true });
    enabled = next;
  }
  return {
    scopeId,
    isActive: () => active,
    setConsole,
    accept(snapshot = [], sequence = evaluationId + 1) {
      if (!active || !Number.isInteger(sequence) || sequence <= evaluationId) return false;
      evaluationId = sequence;
      setConsole(getOptions()?.diagnostics?.console);
      const findings = snapshot
        .filter((d) => !owned || owned.has(d.fieldName))
        .map((d) => ({
          ...copy(d),
          context: { ...copy(d.context || {}), instancePath: copy(path) },
        }));
      reporter.report(findings, { enabled });
      notify(findings, 'evaluation');
      return true;
    },
    getDiagnostics: () => reporter.getDiagnostics(),
    end() {
      if (!active) return;
      active = false;
      setConsole(getOptions()?.diagnostics?.console);
      if (enabled && reporter.getDiagnostics().length)
        safely(() =>
          output({
            kind: 'scope-ended',
            text: '[form0] Calculation diagnostic scope ended.',
          })
        );
      reporter.reset();
      notify([], 'scope-ended');
    },
  };
}

/** Attach legacy warnings before construction/evaluation without changing throttling. */
export function createDiagnosticEngine({ onWarning, ...options }) {
  const warningSystem = new WarningSystem();
  if (typeof onWarning === 'function') warningSystem.addWarningHandler(onWarning);
  return createFormEngine({
    ...options,
    warningSystem,
    diagnostics: { console: false },
  });
}

/** Complete paths use the same attribution shape as CLI preview. */
export function buildDiagnosticInstancePath({
  parentInstancePath = [],
  parentPath = [],
  parentIndices = [],
  repeatableKey,
  instance,
  index = 0,
}) {
  const relative = parentPath.map((part, i) => ({
    repeatableKey: part.key,
    instanceId: part.id ?? null,
    index: Number.isInteger(parentIndices[i]) && parentIndices[i] >= 0 ? parentIndices[i] : 0,
    identity: part.id == null ? 'position' : 'id',
  }));
  // Canvas callers may already supply the complete parent path.
  const prefix =
    relative.length >= parentInstancePath.length &&
    parentInstancePath.length &&
    parentInstancePath.every(
      (part, i) =>
        part.repeatableKey === relative[i].repeatableKey &&
        part.instanceId === relative[i].instanceId
    );
  const parents = prefix ? relative : [...parentInstancePath, ...relative];
  const instanceId = instance?.id ?? instance?.record_id ?? null;
  return [
    ...copy(parents),
    {
      repeatableKey,
      instanceId,
      index: Number.isInteger(index) && index >= 0 ? index : 0,
      identity: instanceId == null ? 'position' : 'id',
    },
  ];
}
