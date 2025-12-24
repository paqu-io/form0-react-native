import React from 'react';
import { TextInput } from 'react-native';

export function NumericFieldComponent({
  field,
  value,
  onChange,
  onKeyDown,
  inputProps = {},
}) {
  const { readOnly: _ignoredReadOnly, required: _ignoredRequired, ...restInputProps } = inputProps;
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
      editable={!inputProps.readOnly}
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
