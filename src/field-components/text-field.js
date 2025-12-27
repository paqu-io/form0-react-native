import React from 'react';
import { TextInput } from 'react-native';
import { useTheme } from '../theme-context.jsx';

export function TextFieldComponent({ value, onChange, onKeyDown, inputProps = {} }) {
  const { theme } = useTheme();
  const { readOnly: _ignoredReadOnly, required: _ignoredRequired, ...restInputProps } = inputProps;
  const isDisabled = inputProps.readOnly;

  return (
    <TextInput
      value={value ?? ''}
      onChangeText={onChange}
      onKeyPress={onKeyDown}
      editable={!isDisabled}
      placeholderTextColor={theme.color.placeholder}
      style={[
        {
          borderWidth: 1,
          borderColor: isDisabled ? theme.color.inputBorder : theme.color.inputBorder,
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
