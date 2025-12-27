import React from 'react';
import { TextInput } from 'react-native';
import { useTheme } from '../theme-context.jsx';

const normalizeDateValue = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  if (raw.includes('T')) {
    return raw.split('T')[0];
  }
  return raw;
};

export function DateFieldComponent({ value, onChange, onKeyDown, readOnly, inputProps = {} }) {
  const { theme } = useTheme();
  const normalizedValue = normalizeDateValue(value);
  const { readOnly: _ignoredReadOnly, required: _ignoredRequired, ...restInputProps } = inputProps;
  const isDisabled = readOnly;

  const handleChange = (text) => {
    if (typeof onChange !== 'function' || readOnly) return;
    onChange(text === '' ? null : text);
  };

  return (
    <TextInput
      value={normalizedValue}
      onChangeText={handleChange}
      onKeyPress={onKeyDown}
      editable={!readOnly}
      placeholder="YYYY-MM-DD"
      placeholderTextColor={theme.color.placeholder}
      style={[
        {
          borderWidth: 1,
          borderColor: theme.color.inputBorder,
          borderRadius: theme.borderRadius.md,
          padding: 8,
          backgroundColor: isDisabled ? theme.color.inputDisabledBg : theme.color.inputBg,
          color: isDisabled ? theme.color.inputDisabledFg : theme.color.foreground,
        },
        restInputProps.style,
      ]}
      {...restInputProps}
    />
  );
}
