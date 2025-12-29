import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme-context.jsx';
import { Text } from '../typography.jsx';

function formatDisplayValue(value, style) {
  if (value == null) return '';
  switch (style) {
    case 'currency':
      return `$${parseFloat(value).toFixed(2)}`;
    case 'date':
      return new Date(value).toLocaleDateString();
    case 'numeric':
      return Number(value);
    default:
      return String(value);
  }
}

export function CalculatedFieldComponent({ field, value }) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        padding: 8,
        backgroundColor: theme.color.inputDisabledBg,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.color.inputBorder,
      }}
    >
      <Text
        style={{
          color: theme.color.inputDisabledFg,
        }}
      >
        {formatDisplayValue(value, field?.display?.style)}
      </Text>
    </View>
  );
}
