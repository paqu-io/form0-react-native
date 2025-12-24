import React from 'react';
import { TextInput } from 'react-native';

export function TitleFieldComponent({ value }) {
  return (
    <TextInput
      value={value ?? ''}
      editable={false}
      style={{
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 4,
        padding: 8,
        backgroundColor: '#f8f8f8',
      }}
    />
  );
}
