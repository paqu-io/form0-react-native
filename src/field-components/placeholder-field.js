import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme-context.jsx';
import { Text } from '../typography.jsx';

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
