import { generateUuidV7 } from 'form0-core';

/**
 * PhotoField and VideoField values: arrays of media entries in the shape
 * form0-react writes and form0-core's output keeps (ids, filename, caption,
 * url, mime_type, size, timestamps, upload_status). Files stay on the device
 * (`upload_status: 'local'`); uploading them is up to the app.
 */

export const MEDIA_SOURCES = ['camera', 'library'];

const ID_KEY = { photo: 'photo_id', video: 'video_id' };

export function mediaKindOf(field) {
  return field?.type === 'VideoField' ? 'video' : 'photo';
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toDuration(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function filenameFromUri(uri) {
  if (typeof uri !== 'string') return null;
  const last = uri.split(/[?#]/)[0].split('/').filter(Boolean).pop();
  return last ? decodeURIComponent(last) : null;
}

/** Entries for display, each keeping the original value entry. */
export function normalizeMediaItems(kind, value) {
  if (!Array.isArray(value)) return [];
  const idKey = ID_KEY[kind];
  return value.filter(isRecord).map((entry, index) => {
    const id = entry._localId || entry.media_id || entry[idKey] || entry.asset_id || null;
    const filename = entry.filename || entry.name || `${kind}-${index + 1}`;
    return {
      key: id || `${filename}-${index}`,
      uri:
        entry.url ||
        entry.previewUrl ||
        entry.preview_url ||
        entry.thumbnail_url ||
        entry.file_url ||
        null,
      filename,
      caption: typeof entry.caption === 'string' ? entry.caption : null,
      duration: toDuration(entry.duration ?? entry.duration_seconds),
      original: entry,
    };
  });
}

/** A new value entry for one item returned by the app's picker. */
export function createMediaEntry(kind, field, picked, { now, createId = generateUuidV7 } = {}) {
  const attachedAt = now || new Date().toISOString();
  const id = `${kind}-${createId()}`;
  const size = Number.isFinite(picked.fileSize) && picked.fileSize >= 0 ? picked.fileSize : null;
  const entry = {
    [ID_KEY[kind]]: id,
    media_id: id,
    _localId: id,
    filename: picked.fileName || filenameFromUri(picked.uri) || id,
    caption: null,
    url: picked.uri,
    mime_type: picked.mimeType || null,
    size,
    size_bytes: size,
    field_key: field?.key || field?.data_name || null,
    field_data_name: field?.data_name || field?.key || null,
    attached_at_client: attachedAt,
    captured_at_client: picked.capturedAt || attachedAt,
    upload_status: 'local',
  };
  if (kind === 'video') entry.duration = toDuration(picked.duration);
  return entry;
}

/** The field value with the picked items appended. Items without a uri are skipped. */
export function appendMedia(kind, field, value, picked, options) {
  const current = Array.isArray(value) ? value.filter(isRecord) : [];
  const added = (Array.isArray(picked) ? picked : [])
    .filter((item) => isRecord(item) && typeof item.uri === 'string' && item.uri)
    .map((item) => createMediaEntry(kind, field, item, options));
  return [...current, ...added];
}

export function removeMedia(kind, value, key) {
  return normalizeMediaItems(kind, value)
    .filter((item) => item.key !== key)
    .map((item) => item.original);
}

export function setMediaCaption(kind, value, key, caption) {
  return normalizeMediaItems(kind, value).map((item) =>
    item.key === key ? { ...item.original, caption: caption ? caption : null } : item.original
  );
}

/**
 * How many more photos the field accepts, or null without a max_length. For
 * videos, min_length and max_length are total minutes, so there is no count limit.
 */
export function remainingMediaSlots(kind, field, count) {
  if (kind !== 'photo' || !Number.isFinite(field?.max_length)) return null;
  return Math.max(field.max_length - count, 0);
}

export function formatMediaDuration(seconds) {
  const total = Math.round(toDuration(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

/** "Min 1 · Max 3 photos" or "Max 2 minutes in total"; null without limits. */
export function describeMediaLimits(kind, field) {
  const min = Number.isFinite(field?.min_length) ? field.min_length : null;
  const max = Number.isFinite(field?.max_length) ? field.max_length : null;
  if (min === null && max === null) return null;
  const unit = kind === 'video' ? 'minute' : 'photo';
  const plural = (count) => `${count} ${unit}${count === 1 ? '' : 's'}`;
  const parts = [];
  if (min !== null) parts.push(`Min ${max === null ? plural(min) : min}`);
  if (max !== null) parts.push(`Max ${plural(max)}`);
  return `${parts.join(' · ')}${kind === 'video' ? ' in total' : ''}`;
}
