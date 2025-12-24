import React from 'react';
import { TextInput } from 'react-native';

export function TextFieldComponent({ value, onChange, onKeyDown, inputProps = {} }) {
  const { readOnly: _ignoredReadOnly, required: _ignoredRequired, ...restInputProps } = inputProps;
  return (
    <TextInput
      value={value ?? ''}
      onChangeText={onChange}
      onKeyPress={onKeyDown}
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
