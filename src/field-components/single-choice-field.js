import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
  const displayMode = field?.display || 'default';
  const isSearchable =
    field?.is_searchable === true && field?.is_searchable_mode === 'default';
  const selectedChoice = value?.choice?.[0]?.value ?? '';
  const otherEntries = Array.isArray(value?.other) ? value.other : [];
  const hasOtherSelection = field?.allow_other && otherEntries.length > 0;
  const otherValue = hasOtherSelection ? otherEntries[0]?.label ?? '' : '';
  const isOtherSelected = field?.allow_other && hasOtherSelection;
  const showOtherInput = field?.allow_other && isOtherSelected;
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const emitChange = (choiceValue, nextOtherLabel = '') => {
    if (typeof onChange !== 'function' || readOnly) return;

    if (field?.allow_other && choiceValue === OTHER_OPTION_VALUE) {
      onChange({
        choice: [],
        other: [{ label: nextOtherLabel ?? '' }],
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

  const openPicker = () => {
    if (readOnly) return;
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
    setSearchQuery('');
  };

  const clearSelection = () => {
    emitChange('', '');
    closePicker();
  };

  if (displayMode !== 'radio') {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredChoices =
      !isSearchable || !normalizedQuery
        ? choices
        : choices.filter((choice) => {
            const label = choice?.label ?? '';
            return String(label).toLowerCase().includes(normalizedQuery);
          });
    const selectedChoiceLabel = choices.find((choice) => choice.value === selectedChoice)?.label;
    const displayLabel = isOtherSelected
      ? 'Other'
      : selectedChoiceLabel ?? (selectedChoice !== '' ? selectedChoice : '');
    const hasSelection = isOtherSelected || selectedChoice !== '';
    const selectionText = displayLabel || 'Select an option...';

    return (
      <View>
        <Pressable
          onPress={openPicker}
          disabled={readOnly}
          style={{
            borderWidth: 1,
            borderColor: theme.color.inputBorder,
            borderRadius: theme.borderRadius.md,
            paddingVertical: 10,
            paddingHorizontal: 12,
            backgroundColor: readOnly ? theme.color.inputDisabledBg : theme.color.inputBg,
            opacity: readOnly ? 0.7 : 1,
          }}
        >
          <Text style={{ color: hasSelection ? theme.color.foreground : theme.color.placeholder }}>
            {selectionText}
          </Text>
        </Pressable>

        {showOtherInput && (
          <TextInput
            value={otherValue || ''}
            onChangeText={handleOtherChange}
            editable={!readOnly}
            placeholder="Please specify..."
            placeholderTextColor={theme.color.placeholder}
            style={{
              marginTop: 8,
              borderWidth: 1,
              borderColor: theme.color.inputBorder,
              borderRadius: theme.borderRadius.md,
              padding: 8,
              backgroundColor: readOnly ? theme.color.inputDisabledBg : theme.color.inputBg,
              color: readOnly ? theme.color.inputDisabledFg : theme.color.foreground,
            }}
            {...restInputProps}
          />
        )}

        <Modal
          visible={isPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={closePicker}
          statusBarTranslucent
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.35)',
              justifyContent: 'center',
              padding: 20,
            }}
            onPress={closePicker}
          >
            <Pressable
              style={{
                borderRadius: theme.borderRadius.lg,
                padding: 16,
                maxHeight: '80%',
                backgroundColor: theme.color.background,
              }}
              onPress={(event) => event.stopPropagation()}
            >
              <Text
                style={{
                  color: theme.color.foreground,
                  fontWeight: '600',
                  marginBottom: 12,
                }}
              >
                Select an option
              </Text>
              {isSearchable && (
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                  placeholder="Search..."
                  placeholderTextColor={theme.color.placeholder}
                  style={{
                    borderWidth: 1,
                    borderColor: theme.color.inputBorder,
                    borderRadius: theme.borderRadius.md,
                    padding: 8,
                    marginBottom: 12,
                    backgroundColor: readOnly ? theme.color.inputDisabledBg : theme.color.inputBg,
                    color: readOnly ? theme.color.inputDisabledFg : theme.color.foreground,
                  }}
                />
              )}
              <ScrollView>
                {filteredChoices.map((choice) => {
                  const isSelected = !isOtherSelected && selectedChoice === choice.value;
                  return (
                    <Pressable
                      key={choice.value}
                      onPress={() => {
                        handleSelect(choice.value);
                        closePicker();
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
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
                      <Text style={{ color: theme.color.foreground }}>
                        {choice.label || choice.value}
                      </Text>
                    </Pressable>
                  );
                })}

                {filteredChoices.length === 0 && (
                  <Text style={{ color: theme.color.placeholder, paddingVertical: 8 }}>
                    No results
                  </Text>
                )}

                {field?.allow_other && (
                  <Pressable
                    onPress={() => {
                      handleSelect(OTHER_OPTION_VALUE);
                      closePicker();
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
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
                )}
              </ScrollView>

              <View
                style={{
                  marginTop: 12,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Pressable
                  onPress={clearSelection}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text style={{ color: theme.color.primary, fontWeight: '600' }}>Clear</Text>
                </Pressable>
                <Pressable
                  onPress={closePicker}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text style={{ color: theme.color.primary, fontWeight: '600' }}>Done</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

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
          {showOtherInput && (
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
          )}
        </View>
      )}
    </View>
  );
}
