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

export function createEmptyRepeatableInstance(repInfo) {
  const values = {};
  if (repInfo?.fields) {
    for (const [fieldName] of repInfo.fields) {
      values[fieldName] = null;
    }
  }
  return {
    id: generateUuidV7(),
    values,
    repeatable: {},
  };
}
