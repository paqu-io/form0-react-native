import React from 'react';
import { Text } from 'react-native';

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
  return (
    <Text
      style={{
        padding: 8,
        backgroundColor: '#f4f4f4',
        borderRadius: 4,
      }}
    >
      {formatDisplayValue(value, field?.display?.style)}
    </Text>
  );
}
