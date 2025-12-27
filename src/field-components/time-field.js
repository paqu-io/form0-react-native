import React from 'react';
import { TextInput } from 'react-native';
import { useTheme } from '../theme-context.jsx';

const normalizeTimeValue = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  const match = raw.match(/^\d{2}:\d{2}(?::\d{2})?$/);
  if (!match) return '';
  const time = match[0];
  if (time.length === 5) {
    return `${time}:00`;
  }
  return time;
};

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
    const withSeconds = text.length === 5 ? `${text}:00` : text;
    onChange(withSeconds);
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
