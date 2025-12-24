import React from 'react';
import { Pressable, Text, View } from 'react-native';

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
              borderRadius: 6,
              borderWidth: 1,
              borderColor: isSelected ? '#111' : '#ccc',
              backgroundColor: isSelected ? '#111' : '#fff',
              marginRight: index < choices.length - 1 ? 8 : 0,
            }}
          >
            <Text style={{ color: isSelected ? '#fff' : '#111' }}>
              {choice.label || choice.value}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
