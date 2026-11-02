import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_SPECS } from 'form0-core';
import {
  appendMedia,
  createMediaEntry,
  describeMediaLimits,
  formatMediaDuration,
  mediaKindOf,
  normalizeMediaItems,
  remainingMediaSlots,
  removeMedia,
  setMediaCaption,
} from '../src/utils/media-values.js';

const photoField = { type: 'PhotoField', key: 'f1', data_name: 'site_photos' };
const videoField = { type: 'VideoField', key: 'f2', data_name: 'walkthrough' };
const options = { now: '2026-11-02T10:00:00.000Z', createId: () => 'id-1' };

test('picked photos become entries in the shape form0-react writes', () => {
  const entry = createMediaEntry(
    'photo',
    photoField,
    {
      uri: 'file:///docs/form0-media/a.jpg',
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
      fileSize: 42,
    },
    options
  );
  assert.deepEqual(entry, {
    photo_id: 'photo-id-1',
    media_id: 'photo-id-1',
    _localId: 'photo-id-1',
    filename: 'a.jpg',
    caption: null,
    url: 'file:///docs/form0-media/a.jpg',
    mime_type: 'image/jpeg',
    size: 42,
    size_bytes: 42,
    field_key: 'f1',
    field_data_name: 'site_photos',
    attached_at_client: '2026-11-02T10:00:00.000Z',
    captured_at_client: '2026-11-02T10:00:00.000Z',
    upload_status: 'local',
  });
  // The file name falls back to the uri, and pickers may omit sizes.
  const bare = createMediaEntry('photo', photoField, { uri: 'file:///x/IMG%201.png' }, options);
  assert.equal(bare.filename, 'IMG 1.png');
  assert.equal(bare.size_bytes, null);
});

test('videos carry a duration in seconds, which form0-core requires', () => {
  const value = appendMedia(
    'video',
    videoField,
    null,
    [{ uri: 'file:///v.mp4', duration: 75.4 }, { uri: 'file:///w.mp4' }],
    options
  );
  assert.equal(value[0].video_id, 'video-id-1');
  assert.equal(value[0].duration, 75.4);
  assert.equal(value[1].duration, 0);
  assert.equal(FIELD_SPECS.VideoField.valueValidator(videoField, value), null);
  const output = FIELD_SPECS.VideoField.outputProducer(videoField, value);
  assert.equal(output[0].url, 'file:///v.mp4');
  assert.equal(output[0].upload_status, 'local');
});

test('photo entries pass form0-core validation and keep their url in the output', () => {
  const value = appendMedia('photo', photoField, [], [{ uri: 'file:///a.jpg' }], options);
  const limited = { ...photoField, min_length: 1, max_length: 2 };
  assert.equal(FIELD_SPECS.PhotoField.valueValidator(limited, value), null);
  const [output] = FIELD_SPECS.PhotoField.outputProducer(limited, value);
  assert.equal(output.photo_id, 'photo-id-1');
  assert.equal(output.url, 'file:///a.jpg');
});

test('appending keeps existing entries untouched and skips items without a uri', () => {
  const existing = [{ photo_id: 'server-1', url: 'https://cdn/x.jpg', caption: 'Front', extra: 1 }];
  const value = appendMedia('photo', photoField, existing, [{}, { uri: '' }, null], options);
  assert.deepEqual(value, existing);
});

test('captions and removal work on entries from any source', () => {
  const value = [
    { photo_id: 'a', url: 'https://cdn/a.jpg', caption: 'Old', keep: true },
    { _localId: 'b', url: 'file:///b.jpg' },
  ];
  const items = normalizeMediaItems('photo', value);
  assert.deepEqual(
    items.map(({ key, uri, caption }) => ({ key, uri, caption })),
    [
      { key: 'a', uri: 'https://cdn/a.jpg', caption: 'Old' },
      { key: 'b', uri: 'file:///b.jpg', caption: null },
    ]
  );
  const captioned = setMediaCaption('photo', value, 'b', 'Back');
  assert.equal(captioned[1].caption, 'Back');
  assert.equal(captioned[0], value[0], 'other entries are kept as they are');
  assert.equal(setMediaCaption('photo', value, 'a', '')[0].caption, null);
  assert.deepEqual(removeMedia('photo', value, 'a'), [value[1]]);
});

test('photo limits count photos, video limits are total minutes', () => {
  assert.equal(remainingMediaSlots('photo', { max_length: 3 }, 1), 2);
  assert.equal(remainingMediaSlots('photo', { max_length: 1 }, 2), 0);
  assert.equal(remainingMediaSlots('photo', {}, 5), null);
  assert.equal(remainingMediaSlots('video', { max_length: 3 }, 1), null);
  assert.equal(
    describeMediaLimits('photo', { min_length: 1, max_length: 3 }),
    'Min 1 · Max 3 photos'
  );
  assert.equal(describeMediaLimits('photo', { min_length: 1 }), 'Min 1 photo');
  assert.equal(describeMediaLimits('video', { max_length: 2 }), 'Max 2 minutes in total');
  assert.equal(describeMediaLimits('video', {}), null);
  assert.equal(formatMediaDuration(75.4), '1:15');
  assert.equal(formatMediaDuration(undefined), '0:00');
  assert.equal(mediaKindOf(videoField), 'video');
  assert.equal(mediaKindOf(photoField), 'photo');
});
