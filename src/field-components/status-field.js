import React from 'react';
import { Pressable, Text, View } from 'react-native';

export function StatusFieldComponent({ field, value, onChange, readOnly }) {
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
              borderRadius: 6,
              borderWidth: 1,
              borderColor: isSelected ? '#111' : '#ccc',
              backgroundColor: isSelected ? '#111' : '#fff',
              marginRight: index < choices.length - 1 ? 8 : 0,
              marginBottom: 8,
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
