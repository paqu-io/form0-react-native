import { buildRepeatableMetadata, generateUuidV7 } from 'form0-core';

export function cloneDeep(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export function buildRepeatableInfo(elements) {
  const meta = buildRepeatableMetadata(elements || []);
  const byPreferredKey = new Map();
  if (meta.repeatableSectionTree) {
    meta.repeatableSectionTree.forEach((info) => {
      if (info?.preferredKey) {
        byPreferredKey.set(info.preferredKey, info);
      }
    });
  }
  return {
    ...meta,
    byPreferredKey,
  };
}

export function createTimestampState(seed = {}) {
  const source = seed && typeof seed === 'object' ? seed : {};
  const now = new Date().toISOString();

  return {
    created_at_client:
      source.created_at_client ??
      source.created_at ??
      now,
    updated_at_client:
      source.updated_at_client ??
      source.updated_at ??
      source.created_at_client ??
      source.created_at ??
      now,
    created_at_server: source.created_at_server ?? null,
    updated_at_server: source.updated_at_server ?? null,
  };
}

export function createEmptyRepeatableInstance(repInfo, timestampSeed = {}) {
  const values = {};
  if (repInfo?.fields) {
    for (const [fieldName] of repInfo.fields) {
      values[fieldName] = null;
    }
  }
  const timestamps = createTimestampState(timestampSeed);
  return {
    id: generateUuidV7(),
    values,
    repeatable: {},
    ...timestamps,
  };
}
