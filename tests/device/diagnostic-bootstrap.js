export const DIAGNOSTIC_BUILD = 'phase-profile-v3';

/** Device harness only: reject an old entrypoint before it can request a native chunk. */
export function checkDiagnosticBootstrap(diagnostic) {
  if (
    diagnostic?.bootstrapRevision !== DIAGNOSTIC_BUILD ||
    diagnostic.loading !== 'bundled-require' ||
    typeof diagnostic.load !== 'function'
  ) {
    throw Object.assign(
      new Error(
        'Diagnostic bootstrap is stale or missing. Force stop Expo Go and open the current QR code.'
      ),
      { code: 'stale_diagnostic_bootstrap' }
    );
  }
}
