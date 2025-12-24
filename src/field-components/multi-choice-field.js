import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

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

function mapChoices(field, values) {
  return Array.from(values)
    .map((choiceValue) => mapChoice(field, choiceValue))
    .filter(Boolean);
}

export function MultiChoiceFieldComponent({
  field,
  value,
  onChange,
  readOnly,
  inputProps = {},
}) {
  const { readOnly: _ignoredReadOnly, required: _ignoredRequired, ...restInputProps } = inputProps;
  const choices = Array.isArray(field?.choices) ? field.choices : [];
  const selectedValues = new Set(
    Array.isArray(value?.choices) ? value.choices.map((c) => c.value).filter(Boolean) : []
  );
  const otherEntries = Array.isArray(value?.other) ? value.other : [];
  const hasOtherSelection = field?.allow_other && otherEntries.length > 0;
  const otherValue = hasOtherSelection ? otherEntries[0]?.label ?? '' : '';

  const emitChange = (nextChoices, nextOtherLabel, forceOther = false) => {
    if (typeof onChange !== 'function' || readOnly) return;
    const normalizedChoices = mapChoices(field, nextChoices);
    const shouldIncludeOther =
      field?.allow_other && (forceOther || (nextOtherLabel && nextOtherLabel.length > 0));
    const normalizedOther = shouldIncludeOther ? [{ label: nextOtherLabel ?? '' }] : [];
    onChange({
      choices: normalizedChoices,
      other: normalizedOther,
    });
  };

  const toggleChoice = (choiceValue) => {
    if (readOnly) return;
    const next = new Set(selectedValues);
    if (next.has(choiceValue)) {
      next.delete(choiceValue);
    } else {
      next.add(choiceValue);
    }
    emitChange(next, otherValue, hasOtherSelection);
  };

  const toggleOther = () => {
    if (readOnly) return;
    emitChange(new Set(selectedValues), otherValue, !hasOtherSelection);
  };

  const handleOtherChange = (text) => {
    emitChange(new Set(selectedValues), text, true);
  };

  return (
    <View>
      {choices.map((choice) => {
        const isSelected = selectedValues.has(choice.value);
        return (
          <Pressable
            key={choice.value}
            onPress={() => toggleChoice(choice.value)}
            disabled={readOnly}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderWidth: 1,
                borderColor: '#444',
                borderRadius: 4,
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
                    backgroundColor: '#111',
                  }}
                />
              ) : null}
            </View>
            <Text>{choice.label || choice.value}</Text>
          </Pressable>
        );
      })}

      {field?.allow_other && (
        <View style={{ marginTop: 4 }}>
          <Pressable
            onPress={toggleOther}
            disabled={readOnly}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderWidth: 1,
                borderColor: '#444',
                borderRadius: 4,
                marginRight: 8,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {hasOtherSelection ? (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor: '#111',
                  }}
                />
              ) : null}
            </View>
            <Text>Other</Text>
          </Pressable>
          <TextInput
            value={otherValue || ''}
            onChangeText={handleOtherChange}
            editable={!readOnly}
            placeholder="Please specify..."
            style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 4,
              padding: 8,
            }}
            {...restInputProps}
          />
        </View>
      )}
    </View>
  );
}
