import { createStructuredRecord, flattenFields } from 'form0-core';
import { cloneDeep } from './repeatable-manager.js';

export const DEFAULT_FIELD_KEY_MODE = 'prefer-key';

const toNullableString = (value) => (value === null || typeof value === 'string' ? value : null);

export function buildSubmissionTimestampSnapshot(rawValues = {}, updatedAtClientOverride = null) {
  const source = rawValues && typeof rawValues === 'object' ? rawValues : {};
  const now = updatedAtClientOverride ?? new Date().toISOString();

  return {
    created_at_client:
      toNullableString(source.created_at_client) ??
      toNullableString(source.created_at) ??
      now,
    updated_at_client: now,
    created_at_server: toNullableString(source.created_at_server),
    updated_at_server: toNullableString(source.updated_at_server),
  };
}

export function buildSubmissionRawValues({
  values,
  timestampSnapshot,
  statusFieldName = null,
  statusValue = null,
}) {
  const submissionWithTimestamps = {
    ...cloneDeep(values || {}),
    created_at: timestampSnapshot?.created_at_client ?? null,
    updated_at: timestampSnapshot?.updated_at_server ?? null,
    created_at_client: timestampSnapshot?.created_at_client ?? null,
    updated_at_client: timestampSnapshot?.updated_at_client ?? null,
    created_at_server: timestampSnapshot?.created_at_server ?? null,
    updated_at_server: timestampSnapshot?.updated_at_server ?? null,
  };

  if (!statusFieldName || typeof statusFieldName !== 'string') {
    return submissionWithTimestamps;
  }

  return {
    ...submissionWithTimestamps,
    [statusFieldName]: statusValue ?? null,
  };
}

export function buildStructuredSubmission({
  schema,
  values,
  repeatable,
  fieldKeyMode = DEFAULT_FIELD_KEY_MODE,
}) {
  const statusField = schema?.form?.status_field || null;
  const statusFieldName = statusField?.data_name || null;
  const statusValue = statusFieldName
    ? values?.[statusFieldName] ?? statusField?.default_value ?? null
    : null;
  const timestamps = buildSubmissionTimestampSnapshot(values);
  const rawValues = buildSubmissionRawValues({
    values,
    timestampSnapshot: timestamps,
    statusFieldName,
    statusValue,
  });
  const repeatableState =
    repeatable && typeof repeatable === 'object' && !Array.isArray(repeatable)
      ? cloneDeep(repeatable)
      : {};
  const flattenedSchemaFields = flattenFields(schema?.form?.elements || []);

  let structuredRecord = rawValues;
  try {
    structuredRecord = createStructuredRecord(
      {
        values: rawValues,
        repeatable: repeatableState,
      },
      flattenedSchemaFields,
      {
        fieldKeyMode,
        originalElements: schema?.form?.elements || [],
        title_field: schema?.form?.title_field || null,
        status_field: statusField,
        '@status': statusFieldName ? statusValue ?? null : undefined,
      },
    );
  } catch (error) {
    console.error(
      'form0-react-native: failed to build structured record, falling back to raw values',
      error,
    );
    structuredRecord = rawValues;
  }

  return {
    structuredRecord,
    rawValues,
    repeatable: repeatableState,
    timestamps,
  };
}
