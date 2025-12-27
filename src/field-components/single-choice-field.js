import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme-context.jsx';

const OTHER_OPTION_VALUE = '__other__';

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

export function SingleChoiceFieldComponent({ field, value, onChange, readOnly, inputProps = {} }) {
  const { theme } = useTheme();
  const { readOnly: _ignoredReadOnly, required: _ignoredRequired, ...restInputProps } = inputProps;
  const choices = Array.isArray(field?.choices) ? field.choices : [];
  const selectedChoice = value?.choice?.[0]?.value ?? '';
  const otherEntries = Array.isArray(value?.other) ? value.other : [];
  const hasOtherSelection = field?.allow_other && otherEntries.length > 0;
  const otherValue = hasOtherSelection ? otherEntries[0]?.label ?? '' : '';
  const isOtherSelected = field?.allow_other && (hasOtherSelection || selectedChoice === '');

  const emitChange = (choiceValue, nextOtherLabel = '') => {
    if (typeof onChange !== 'function' || readOnly) return;

    if (field?.allow_other && choiceValue === OTHER_OPTION_VALUE) {
      onChange({
        choice: [],
        other: nextOtherLabel ? [{ label: nextOtherLabel }] : [],
      });
      return;
    }

    const mappedChoice = mapChoice(field, choiceValue);
    onChange({
      choice: mappedChoice ? [mappedChoice] : [],
      other: [],
    });
  };

  const handleSelect = (choiceValue) => {
    if (readOnly) return;
    emitChange(choiceValue, otherValue);
  };

  const handleOtherChange = (text) => {
    if (readOnly || typeof onChange !== 'function') return;
    onChange({
      choice: [],
      other: text ? [{ label: text }] : [],
    });
  };

  return (
    <View>
      {choices.map((choice) => {
        const isSelected = !isOtherSelected && selectedChoice === choice.value;
        return (
          <Pressable
            key={choice.value}
            onPress={() => handleSelect(choice.value)}
            disabled={readOnly}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderWidth: 1,
                borderColor: theme.color.inputBorder,
                borderRadius: 9,
                marginRight: 8,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSelected ? (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: theme.color.primary,
                  }}
                />
              ) : null}
            </View>
            <Text style={{ color: theme.color.foreground }}>{choice.label || choice.value}</Text>
          </Pressable>
        );
      })}

      {field?.allow_other && (
        <View style={{ marginTop: 4 }}>
          <Pressable
            onPress={() => handleSelect(OTHER_OPTION_VALUE)}
            disabled={readOnly}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderWidth: 1,
                borderColor: theme.color.inputBorder,
                borderRadius: 9,
                marginRight: 8,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isOtherSelected ? (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: theme.color.primary,
                  }}
                />
              ) : null}
            </View>
            <Text style={{ color: theme.color.foreground }}>Other</Text>
          </Pressable>
          <TextInput
            value={otherValue || ''}
            onChangeText={handleOtherChange}
            editable={!readOnly}
            placeholder="Please specify..."
            placeholderTextColor={theme.color.placeholder}
            style={{
              borderWidth: 1,
              borderColor: theme.color.inputBorder,
              borderRadius: theme.borderRadius.md,
              padding: 8,
              backgroundColor: readOnly ? theme.color.inputDisabledBg : theme.color.inputBg,
              color: readOnly ? theme.color.inputDisabledFg : theme.color.foreground,
            }}
            {...restInputProps}
          />
        </View>
      )}
    </View>
  );
}
