import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme-context.jsx';

export function StatusFieldComponent({ field, value, onChange, readOnly }) {
  const { theme } = useTheme();
  const choices = Array.isArray(field?.choices) ? field.choices : [];
  const isDisabled = readOnly || field?.enabled === false;

  const handleSelect = (choiceValue) => {
    if (typeof onChange !== 'function' || isDisabled) return;
    onChange(choiceValue || null);
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {choices.map((choice, index) => {
        const isSelected = value === choice.value;
        return (
          <Pressable
            key={choice.value}
            onPress={() => handleSelect(choice.value)}
            disabled={isDisabled}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: theme.borderRadius.md,
              borderWidth: 1,
              borderColor: isSelected ? theme.color.primary : theme.color.inputBorder,
              backgroundColor: isSelected ? theme.color.primary : theme.color.inputBg,
              marginRight: index < choices.length - 1 ? 8 : 0,
              marginBottom: 8,
              opacity: isDisabled ? 0.7 : 1,
            }}
          >
            <Text
              style={{
                color: isSelected ? theme.color.buttonFg : theme.color.foreground,
              }}
            >
              {choice.label || choice.value}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
