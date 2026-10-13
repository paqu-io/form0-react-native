const clone = (value) => JSON.parse(JSON.stringify(value));

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function identity(entry) {
  const comparable = clone(entry);
  for (const part of comparable.diagnostic.context?.instancePath || []) {
    if (part.instanceId !== null && part.instanceId !== undefined) delete part.index;
  }
  return JSON.stringify(stableValue(comparable));
}

export function summarizeDiagnostics(items = []) {
  return {
    errors: items.filter((item) => item.severity === 'error').length,
    warnings: items.filter((item) => item.severity === 'warning').length,
  };
}

export function formatDiagnosticCounts(items, translate) {
  const { errors, warnings } = summarizeDiagnostics(items);
  const counts = [];
  if (errors)
    counts.push(
      translate(errors === 1 ? 'diagnostics.oneError' : 'diagnostics.errors', {
        count: errors,
      })
    );
  if (warnings)
    counts.push(
      translate(warnings === 1 ? 'diagnostics.oneWarning' : 'diagnostics.warnings', {
        count: warnings,
      })
    );
  return counts.join(' ' + translate('diagnostics.and') + ' ');
}

/** Combine presentation only; the original runtime snapshot remains intact. */
export function combineDiagnostics(diagnostics = []) {
  const entries = diagnostics.map((diagnostic) => ({
    diagnostic: clone(diagnostic),
    origins: [{ source: 'runtime', code: diagnostic.code }],
  }));
  return entries;
}

export function formatDiagnostic(entry, translate = (key) => key) {
  const item = entry.diagnostic;
  const rowPath = (item.context?.instancePath || []).map(
    (part) =>
      part.repeatableKey +
      '[' +
      (part.instanceId == null
        ? translate('diagnostics.position', { index: part.index + 1 })
        : String(part.instanceId)) +
      ']'
  );
  const field = [...rowPath, item.fieldName].join(' / ');
  const origins = entry.origins
    .map(
      (origin) =>
        translate('diagnostics.' + origin.source) +
        (origin.code === item.code ? '' : ' (' + origin.code + ')')
    )
    .join(', ');
  const metadata = [
    translate('diagnostics.code') + ': ' + item.code,
    translate('diagnostics.source') + ': ' + origins,
  ];
  if (item.phase && item.phase !== entry.origins[0]?.source)
    metadata.push(translate('diagnostics.phase') + ': ' + item.phase);
  const lines = [
    translate('diagnostics.finding', {
      severity: translate('diagnostics.' + item.severity),
      field,
      message: item.message,
    }),
    '  ' + metadata.join(' | '),
  ];
  if (item.suggestion) {
    lines.push('  ' + translate('diagnostics.suggestion') + ': ' + item.suggestion);
  }
  return lines;
}

/**
 * Presentation state shared by terminal and browser adapters. Collection never
 * depends on output controls; emit failures cannot interrupt the caller.
 */
export function createDiagnosticReporter({ emit = () => {}, translate = (key) => key } = {}) {
  let previous = new Map();
  let snapshot = [];
  function emitSafely(event) {
    try {
      const result = emit(event);
      if (result && typeof result.then === 'function') Promise.resolve(result).catch(() => {});
    } catch {
      // Reporting is observational.
    }
  }
  return {
    report(diagnostics = [], { explicit = false, enabled = true } = {}) {
      snapshot = clone(diagnostics);
      const entries = combineDiagnostics(snapshot);
      const current = new Map(entries.map((entry) => [identity(entry), entry]));
      const added = entries.filter((entry) => explicit || !previous.has(identity(entry)));
      const resolved = [...previous.keys()].filter((key) => !current.has(key)).length;
      previous = current;
      if (enabled) {
        if (added.length)
          emitSafely({
            kind: 'heading',
            text: translate('diagnostics.heading', {
              summary: formatDiagnosticCounts(
                entries.map((entry) => entry.diagnostic),
                translate
              ),
            }),
          });
        for (const entry of added) {
          emitSafely({
            kind: 'diagnostic',
            severity: entry.diagnostic.severity,
            text: formatDiagnostic(entry, translate).join('\n'),
          });
        }
        if (resolved && !explicit)
          emitSafely({
            kind: 'resolved',
            text: translate('diagnostics.resolved', { count: resolved }),
          });
      }
      return {
        diagnostics: clone(snapshot),
        ...summarizeDiagnostics(snapshot),
      };
    },
    getDiagnostics: () => clone(snapshot),
    reset({ keepSnapshot = false } = {}) {
      previous = new Map();
      if (!keepSnapshot) snapshot = [];
    },
  };
}
