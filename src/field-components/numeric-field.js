import React from 'react';
import { useTheme } from '../theme-context.jsx';
import { TextInput } from '../typography.jsx';

export function NumericFieldComponent({ field, value, onChange, onKeyDown, inputProps = {} }) {
  const { theme } = useTheme();
  const { readOnly: _ignoredReadOnly, required: _ignoredRequired, ...restInputProps } = inputProps;
  const isDisabled = inputProps.readOnly;

  const handleChange = (text) => {
    if (typeof onChange !== 'function') return;
    if (field?.format === 'integer' && (text.includes('.') || text.includes(','))) {
      return;
    }
    const nextValue = text === '' ? null : Number(text);
    onChange(nextValue);
  };

  return (
    <TextInput
      value={value === null || value === undefined ? '' : String(value)}
      onChangeText={handleChange}
      onKeyPress={onKeyDown}
      keyboardType="numeric"
      editable={!isDisabled}
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
