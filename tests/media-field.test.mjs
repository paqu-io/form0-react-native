import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const fieldComponents = read('field-components/index.js');
const mediaField = read('field-components/media-field.js');
const formRenderer = read('form-renderer.jsx');
const packageIndex = read('index.js');
const packageTypes = read('index.d.ts');

test('PhotoField and VideoField default to the media field; only FormLinkField is a placeholder', () => {
  assert.match(fieldComponents, /PhotoField:\s*PhotoFieldComponent/);
  assert.match(fieldComponents, /VideoField:\s*VideoFieldComponent/);
  assert.match(fieldComponents, /FormLinkField:\s*PlaceholderFieldComponent/);
  assert.match(fieldComponents, /placeholderBackedFieldTypes = \['FormLinkField'\]/);
});

test('without a mediaPicker the media field keeps the placeholder', () => {
  // Apps that pass no picker (or their own renderers) see no change.
  assert.match(
    mediaField,
    /const picker = useMediaPicker\(\);\s*if \(!picker\) \{[\s\S]*?return <PlaceholderFieldComponent \{\.\.\.props\} \/>;/
  );
  assert.doesNotMatch(mediaField, /expo-|react-native-image-picker/, 'no picker dependency');
});

test('FormRenderer provides its mediaPicker prop to the fields', () => {
  assert.match(formRenderer, /mediaPicker = null,/);
  assert.match(
    formRenderer,
    /<MediaPickerProvider picker=\{mediaPicker\}>\s*<FieldRegistryProvider registry=\{registry\} renderers=\{renderers\}>/
  );
  assert.match(packageIndex, /MediaPickerProvider,\s*useMediaPicker,\s*MediaPickerContext,/);
  assert.match(packageTypes, /mediaPicker\?: MediaPicker \| null;/);
  assert.match(packageTypes, /export type MediaPicker = \{/);
});

test('a picked batch appends to the latest value and respects the photo limit', () => {
  assert.match(mediaField, /picked\.slice\(0, remaining\)/);
  assert.match(mediaField, /appendMedia\(kind, field, valueRef\.current, accepted\)/);
  assert.match(mediaField, /disabled=\{busy \|\| remaining === 0\}/);
});
