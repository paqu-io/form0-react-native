import { normalizeFieldValue, buildRepeatableMetadata } from 'form0-core';

const clone = (value, seen = new Set()) => {
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof Blob === 'function' && value instanceof Blob) return value;
  if (seen.has(value)) throw new TypeError('Loaded values must not contain cycles.');
  seen.add(value);
  const result = Array.isArray(value) ? [] : {};
  for (const key of Object.keys(value))
    Object.defineProperty(result, key, {
      value: clone(value[key], seen),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  seen.delete(value);
  return result;
};

export function normalizeLoadedValue(field, value) {
  try {
    return normalizeFieldValue(field, value);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return clone(value);
  }
}

export function scopeFields(schema, path = []) {
  const metadata = buildRepeatableMetadata(schema?.form?.elements || []);
  const fields = new Map(
    [...metadata.fieldOwnership]
      .filter(
        ([, entry]) =>
          entry.parentPath.length === path.length &&
          entry.parentPath.every((key, index) => key === path[index].repeatableKey)
      )
      .map(([name, entry]) => [name, entry.field])
  );
  if (!path.length && schema?.form?.status_field?.enabled)
    fields.set(schema.form.status_field.data_name, schema.form.status_field);
  return fields;
}

export function normalizeUpdates(fields, updates, mode = 'edit') {
  if (
    !updates ||
    typeof updates !== 'object' ||
    Array.isArray(updates) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(updates))
  )
    throw new TypeError('Value updates must be a plain object.');
  const entries = Object.entries(updates);
  if (entries.length && mode === 'readonly')
    throw new TypeError('Cannot set values while the record is readonly.');
  return Object.fromEntries(
    entries.map(([name, value]) => {
      const entry = fields?.get(name);
      if (!entry) throw new TypeError(`Unknown or unowned value-update field "${name}".`);
      return [name, normalizeFieldValue(entry.field || entry, value)];
    })
  );
}
