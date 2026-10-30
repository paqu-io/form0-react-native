import React from 'react';
import { useTheme } from '../theme-context.jsx';
import { TextInput } from '../typography.jsx';

// Keep partial or invalid typed values visible so the user can finish or correct them.
const normalizeTimeValue = (raw) => (typeof raw === 'string' ? raw : '');

export function TimeFieldComponent({ value, onChange, onKeyDown, readOnly, inputProps = {} }) {
  const { theme } = useTheme();
  const normalizedValue = normalizeTimeValue(value);
  const { readOnly: _ignoredReadOnly, required: _ignoredRequired, ...restInputProps } = inputProps;
  const isDisabled = readOnly;

  const handleChange = (text) => {
    if (typeof onChange !== 'function' || readOnly) return;
    if (text === '') {
      onChange(null);
      return;
    }
    onChange(text);
  };

  return (
    <TextInput
      value={normalizedValue}
      onChangeText={handleChange}
      onKeyPress={onKeyDown}
      editable={!readOnly}
      placeholder="HH:MM[:SS]"
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
