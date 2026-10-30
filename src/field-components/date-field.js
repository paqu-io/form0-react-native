import React from 'react';
import { useTheme } from '../theme-context.jsx';
import { TextInput } from '../typography.jsx';

// Do not hide invalid loaded values or incomplete user input through display conversion.
const normalizeDateValue = (raw) => (typeof raw === 'string' ? raw : '');

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
