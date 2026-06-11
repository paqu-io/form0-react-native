import { createStructuredRecord, flattenFields } from 'form0-core';
import { cloneDeep } from './repeatable-manager.js';

export const DEFAULT_FIELD_KEY_MODE = 'prefer-key';

const toNullableString = (value) => (value === null || typeof value === 'string' ? value : null);

const getTimestampSourceValue = (source, key) => {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(source, key)) {
    return source[key];
  }

  if (key === 'created_at_client' && Object.prototype.hasOwnProperty.call(source, 'created_at')) {
    return source.created_at;
  }

  if (key === 'updated_at_client' && Object.prototype.hasOwnProperty.call(source, 'updated_at')) {
    return source.updated_at;
  }

  return undefined;
};

export function buildSubmissionTimestampSnapshot(sourceValues = {}, updatedAtClientOverride = null) {
  const source = sourceValues && typeof sourceValues === 'object' ? sourceValues : {};
  const now = updatedAtClientOverride ?? new Date().toISOString();

  return {
    created_at_client: toNullableString(getTimestampSourceValue(source, 'created_at_client')) ?? now,
    updated_at_client:
      updatedAtClientOverride ??
      toNullableString(getTimestampSourceValue(source, 'updated_at_client')) ??
      now,
    created_at_server: toNullableString(getTimestampSourceValue(source, 'created_at_server')),
    updated_at_server: toNullableString(getTimestampSourceValue(source, 'updated_at_server')),
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
  timestamps: explicitTimestamps = null,
}) {
  const statusField = schema?.form?.status_field || null;
  const statusFieldName = statusField?.data_name || null;
  const statusValue = statusFieldName
    ? values?.[statusFieldName] ?? statusField?.default_value ?? null
    : null;
  const timestamps = explicitTimestamps
    ? buildSubmissionTimestampSnapshot(explicitTimestamps)
    : buildSubmissionTimestampSnapshot(values);
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
