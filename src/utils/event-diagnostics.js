/** Console-only managed event failures, separate from ordinary validation and save reporting. */
export function createEventFailureReporter(packageName, getOptions) {
  return (result, context) => {
    try {
      if (getOptions()?.failures === false || result?.status !== 'failed') return;
      const issues = result.issues?.filter(
        ({ code }) => !['scope_closed', 'stale_generation', 'cancelled'].includes(code)
      );
      if (!issues?.length) return;
      console.error(`[${packageName}] Event failed.`, {
        eventType: context.eventType,
        fieldKey: context.fieldKey ?? null,
        scope: context.scope,
        issues: issues.map(({ code, message }) => ({ code, message })),
      });
    } catch {
      /* Reporting must never change operation results, retry or scope retirement. */
    }
  };
}
