import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Camera, ImagePlus, Video } from 'lucide-react-native';
import { useMediaPicker } from '../media-picker-context.jsx';
import { useTheme } from '../theme-context.jsx';
import { Text } from '../typography.jsx';
import {
  MEDIA_SOURCES,
  appendMedia,
  describeMediaLimits,
  mediaKindOf,
  normalizeMediaItems,
  remainingMediaSlots,
  removeMedia,
  setMediaCaption,
} from '../utils/media-values.js';
import { MediaItemRow } from './media-item-row.js';
import { PlaceholderFieldComponent } from './placeholder-field.js';

const LABELS = {
  photo: { camera: 'Take photo', library: 'Choose photos', empty: 'No photos attached.' },
  video: { camera: 'Record video', library: 'Choose videos', empty: 'No videos attached.' },
};
const IS_DEV =
  typeof process !== 'undefined' && process?.env && process.env.NODE_ENV !== 'production';
const warnedWithoutPicker = new Set();

function warnWithoutPicker(type) {
  if (!IS_DEV || warnedWithoutPicker.has(type)) return;
  warnedWithoutPicker.add(type);
  console.warn(
    `form0-react-native: ${type} shows a placeholder. Pass a mediaPicker to FormRenderer to capture media.`
  );
}

function SourceButton({ source, kind, disabled, onPress, theme }) {
  const Icon = source === 'camera' ? (kind === 'video' ? Video : Camera) : ImagePlus;
  const label = LABELS[kind][source];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: theme.color.inputBorder,
        borderRadius: theme.borderRadius.full,
        paddingHorizontal: 12,
        paddingVertical: 8,
        opacity: disabled ? 0.5 : 1,
        backgroundColor: pressed ? theme.color.cancelHoverBg : theme.color.cancelBg,
      })}
    >
      <Icon size={16} color={theme.color.cancelFg} strokeWidth={2} />
      <Text style={{ color: theme.color.cancelFg, fontSize: theme.fontSize.sm }}>{label}</Text>
    </Pressable>
  );
}

function MediaField({ field, value, onChange, readOnly, inputProps = {}, picker }) {
  const { theme } = useTheme();
  const kind = mediaKindOf(field);
  const isReadOnly = Boolean(readOnly || inputProps.readOnly);
  const items = useMemo(() => normalizeMediaItems(kind, value), [kind, value]);
  const [busy, setBusy] = useState(false);
  const [pickError, setPickError] = useState(null);
  // A pick can finish after other edits; append to the latest value.
  const valueRef = useRef(value);
  valueRef.current = value;

  const remaining = remainingMediaSlots(kind, field, items.length);
  const limits = describeMediaLimits(kind, field);
  const sources = (Array.isArray(picker.sources) ? picker.sources : MEDIA_SOURCES).filter(
    (source) => MEDIA_SOURCES.includes(source)
  );

  const pick = useCallback(
    async (source) => {
      setPickError(null);
      setBusy(true);
      try {
        const picked = await picker.pick({
          kind,
          source,
          multiple: source === 'library' && remaining !== 1,
          limit: remaining,
          field,
        });
        if (Array.isArray(picked) && picked.length > 0) {
          const accepted = remaining === null ? picked : picked.slice(0, remaining);
          onChange?.(appendMedia(kind, field, valueRef.current, accepted));
        }
      } catch (error) {
        setPickError(error?.message || `Could not add the ${kind}.`);
      } finally {
        setBusy(false);
      }
    },
    [field, kind, onChange, picker, remaining]
  );

  const handleRemove = useCallback(
    (key) => onChange?.(removeMedia(kind, valueRef.current, key)),
    [kind, onChange]
  );
  const handleCaptionChange = useCallback(
    (key, caption) => onChange?.(setMediaCaption(kind, valueRef.current, key, caption)),
    [kind, onChange]
  );

  return (
    <View style={{ gap: 10 }}>
      {items.length > 0 ? (
        items.map((item) => (
          <MediaItemRow
            key={item.key}
            kind={kind}
            item={item}
            readOnly={isReadOnly}
            onCaptionChange={handleCaptionChange}
            onRemove={handleRemove}
          />
        ))
      ) : (
        <Text style={{ color: theme.color.description, fontSize: theme.fontSize.sm }}>
          {LABELS[kind].empty}
        </Text>
      )}
      {isReadOnly ? null : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {sources.map((source) => (
            <SourceButton
              key={source}
              source={source}
              kind={kind}
              theme={theme}
              disabled={busy || remaining === 0}
              onPress={() => pick(source)}
            />
          ))}
        </View>
      )}
      {!isReadOnly && limits ? (
        <Text style={{ color: theme.color.description, fontSize: theme.fontSize.xs }}>
          {limits}
        </Text>
      ) : null}
      {pickError ? (
        <Text style={{ color: theme.color.error, fontSize: theme.fontSize.xs }}>{pickError}</Text>
      ) : null}
    </View>
  );
}

/**
 * PhotoField and VideoField: attached items with captions, plus buttons that
 * call the app's mediaPicker (see media-picker-context.jsx). Without a picker,
 * the placeholder shows how many items the record already has.
 */
export function MediaFieldComponent(props) {
  const picker = useMediaPicker();
  if (!picker) {
    warnWithoutPicker(props.field?.type);
    return <PlaceholderFieldComponent {...props} />;
  }
  return <MediaField {...props} picker={picker} />;
}

export const PhotoFieldComponent = MediaFieldComponent;
export const VideoFieldComponent = MediaFieldComponent;
