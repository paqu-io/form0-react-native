import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme-context.jsx';

function mapChoice(field, value) {
  const choice = Array.isArray(field?.choices)
    ? field.choices.find((c) => c && c.value === value)
    : null;
  if (choice) {
    return {
      value: choice.value,
      ...(choice.label ? { label: choice.label } : {}),
    };
  }
  return value ? { value } : null;
}

export function BooleanFieldComponent({ field, value, onChange, readOnly }) {
  const { theme } = useTheme();
  const choices = Array.isArray(field?.choices) ? field.choices : [];
  const selectedChoice = value?.choice?.[0]?.value ?? '';

  const handleSelect = (choiceValue) => {
    if (typeof onChange !== 'function' || readOnly) return;
    const mappedChoice = mapChoice(field, choiceValue);
    onChange({
      choice: mappedChoice ? [mappedChoice] : [],
      other: [],
    });
  };

  return (
    <View style={{ flexDirection: 'row' }}>
      {choices.map((choice, index) => {
        const isSelected = selectedChoice === choice.value;
        return (
          <Pressable
            key={choice.value}
            onPress={() => handleSelect(choice.value)}
            disabled={readOnly}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: theme.borderRadius.md,
              borderWidth: 1,
              borderColor: isSelected ? theme.color.primary : theme.color.inputBorder,
              backgroundColor: isSelected ? theme.color.primary : theme.color.inputBg,
              marginRight: index < choices.length - 1 ? 8 : 0,
              opacity: readOnly ? 0.7 : 1,
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
