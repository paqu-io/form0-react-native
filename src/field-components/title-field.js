import React from 'react';
import { TextInput } from 'react-native';
import { useTheme } from '../theme-context.jsx';

export function TitleFieldComponent({ value }) {
  const { theme } = useTheme();

  return (
    <TextInput
      value={value ?? ''}
      editable={false}
      style={{
        borderWidth: 1,
        borderColor: theme.color.inputBorder,
        borderRadius: theme.borderRadius.md,
        padding: 8,
        backgroundColor: theme.color.inputDisabledBg,
        color: theme.color.inputDisabledFg,
      }}
    />
  );
}
