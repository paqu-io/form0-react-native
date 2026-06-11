import React from 'react';
import { View } from 'react-native';
import { Image as ImageIcon, Video as VideoIcon } from 'lucide-react-native';
import { useTheme } from '../theme-context.jsx';
import { Text } from '../typography.jsx';

function countMediaItems(value) {
  if (!Array.isArray(value)) {
    return 0;
  }

  return value.filter((entry) => entry && typeof entry === 'object').length;
}

function MediaPlaceholder({ field, value, theme }) {
  const isVideo = field?.type === 'VideoField';
  const Icon = isVideo ? VideoIcon : ImageIcon;
  const itemCount = countMediaItems(value);
  const noun = isVideo ? 'video' : 'photo';
  const pluralNoun = isVideo ? 'videos' : 'photos';
  const title = isVideo ? 'Video capture preview' : 'Photo capture preview';
  const helperText = isVideo
    ? 'Provide a VideoField renderer override in the host app to record or upload videos.'
    : 'Provide a PhotoField renderer override in the host app to capture or upload photos.';

  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          minHeight: 180,
          borderWidth: 1,
          borderColor: theme.color.inputBorder,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.color.inputBg,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 18,
            paddingVertical: 20,
            gap: 10,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.color.section,
              borderWidth: 1,
              borderColor: theme.color.border,
            }}
          >
            <Icon size={24} color={theme.color.description} strokeWidth={2} />
          </View>
          <Text
            style={{
              color: theme.color.foreground,
              fontWeight: '600',
              textAlign: 'center',
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              color: theme.color.description,
              fontSize: theme.fontSize.sm,
              textAlign: 'center',
              lineHeight: 20,
            }}
          >
            {itemCount > 0
              ? `${itemCount} ${itemCount === 1 ? noun : pluralNoun} already attached to this record.`
              : `No ${pluralNoun} attached yet.`}
          </Text>
        </View>
      </View>
      <Text style={{ color: theme.color.description, fontSize: theme.fontSize.sm }}>
        {helperText}
      </Text>
    </View>
  );
}

export function PlaceholderFieldComponent({ field, value }) {
  const { theme } = useTheme();

  if (field?.type === 'PhotoField' || field?.type === 'VideoField') {
    return <MediaPlaceholder field={field} value={value} theme={theme} />;
  }

  return (
    <View style={{ paddingVertical: 8 }}>
      <Text style={{ color: theme.color.description }}>
        {field?.label || field?.data_name || 'This field'} is not supported on mobile yet.
      </Text>
    </View>
  );
}
