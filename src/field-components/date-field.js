import React from 'react';
import { TextInput } from 'react-native';

const normalizeDateValue = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  if (raw.includes('T')) {
    return raw.split('T')[0];
  }
  return raw;
};

export function DateFieldComponent({ value, onChange, onKeyDown, readOnly, inputProps = {} }) {
  const normalizedValue = normalizeDateValue(value);
  const { readOnly: _ignoredReadOnly, required: _ignoredRequired, ...restInputProps } = inputProps;

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
      style={[
        {
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 4,
          padding: 8,
        },
        restInputProps.style,
      ]}
      {...restInputProps}
    />
  );
}
