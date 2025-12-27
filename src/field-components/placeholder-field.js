import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme-context.jsx';

export function PlaceholderFieldComponent({ field }) {
  const { theme } = useTheme();

  return (
    <View style={{ paddingVertical: 8 }}>
      <Text style={{ color: theme.color.description }}>
        {field?.label || field?.data_name || 'This field'} is not supported on mobile yet.
      </Text>
    </View>
  );
}
