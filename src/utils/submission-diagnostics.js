/** Console-only submission reporting. Never affects validation or save acknowledgement. */
export function createSubmissionReporter(packageName, getOptions) {
  function emit(level, setting, defaultEnabled, ...args) {
    try {
      const enabled = getOptions()?.[setting] ?? defaultEnabled;
      if (enabled === true) console[level](...args);
    } catch {
      /* Reporting must not interrupt saving, cancellation or retry. */
    }
  }

  const failure = (action, stage, error) =>
    emit(
      'error',
      'saveFailures',
      true,
      `[${packageName}] ${action} failed during ${stage}.`,
      error
    );
  const blocked = (action) =>
    emit('info', 'validationBlocks', false, `[${packageName}] ${action} blocked by validation.`);

  function result(action, stage, value) {
    try {
      if (!value || value.status === 'cancelled' || value.status === 'requires_decision') return;
      if (value.status === 'failed' || value.issues?.length) {
        // Include operational findings, never the prepared payload, snapshot or record paths.
        failure(
          action,
          stage,
          value.issues?.length
            ? value.issues.map(({ code, message }) => ({ code, message }))
            : 'The operation failed.'
        );
      } else if (value.eligible === false && value.validationSummary?.hasErrors) {
        blocked(action);
      }
    } catch {
      /* A malformed diagnostic result must not change the operation's outcome. */
    }
  }

  return { failure, blocked, result };
}
