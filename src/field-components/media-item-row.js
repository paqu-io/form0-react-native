import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Film, X } from 'lucide-react-native';
import { useTheme } from '../theme-context.jsx';
import { Text, TextInput } from '../typography.jsx';
import { formatMediaDuration } from '../utils/media-values.js';

const THUMB_SIZE = 72;

function Thumbnail({ kind, item, theme }) {
  const [failed, setFailed] = useState(false);
  const frame = {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.section,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (kind === 'photo' && item.uri && !failed) {
    return (
      <View style={frame}>
        <Image
          source={{ uri: item.uri }}
          style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  return (
    <View style={frame}>
      <Film size={22} color={theme.color.icon} strokeWidth={2} />
      {kind === 'video' ? (
        <Text style={{ marginTop: 4, color: theme.color.description, fontSize: theme.fontSize.xs }}>
          {formatMediaDuration(item.duration)}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * One attached photo or video: thumbnail, name, caption and remove button.
 * Read-only rows show the caption as text.
 */
export function MediaItemRow({ kind, item, readOnly, onCaptionChange, onRemove }) {
  const { theme } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <Thumbnail kind={kind} item={item} theme={theme} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text
          numberOfLines={1}
          style={{ color: theme.color.foreground, fontSize: theme.fontSize.sm }}
        >
          {item.filename}
        </Text>
        {readOnly ? (
          item.caption ? (
            <Text style={{ color: theme.color.description, fontSize: theme.fontSize.sm }}>
              {item.caption}
            </Text>
          ) : null
        ) : (
          <TextInput
            value={item.caption ?? ''}
            onChangeText={(text) => onCaptionChange(item.key, text)}
            placeholder="Add caption…"
            placeholderTextColor={theme.color.placeholder}
            accessibilityLabel={`Caption for ${item.filename}`}
            style={{
              borderWidth: 1,
              borderColor: theme.color.inputBorder,
              borderRadius: theme.borderRadius.md,
              paddingHorizontal: 8,
              paddingVertical: 6,
              backgroundColor: theme.color.inputBg,
              color: theme.color.foreground,
              fontSize: theme.fontSize.sm,
            }}
          />
        )}
      </View>
      {readOnly ? null : (
        <Pressable
          onPress={() => onRemove(item.key)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.filename}`}
          style={({ pressed }) => ({
            padding: 6,
            borderRadius: theme.borderRadius.full,
            backgroundColor: pressed ? theme.color.cancelHoverBg : 'transparent',
          })}
        >
          <X size={18} color={theme.color.icon} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
}
