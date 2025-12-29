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

function mapChoices(field, values) {
  return Array.from(values)
    .map((choiceValue) => mapChoice(field, choiceValue))
    .filter(Boolean);
}

export function MultiChoiceFieldComponent({ field, value, onChange, readOnly, inputProps = {} }) {
  const { theme } = useTheme();
  const { readOnly: _ignoredReadOnly, required: _ignoredRequired, ...restInputProps } = inputProps;
  const choices = Array.isArray(field?.choices) ? field.choices : [];
  const displayMode = field?.display || 'default';
  const isSearchable =
    field?.is_searchable === true && field?.is_searchable_mode === 'default';
  const selectedValues = new Set(
    Array.isArray(value?.choices) ? value.choices.map((c) => c.value).filter(Boolean) : []
  );
  const otherEntries = Array.isArray(value?.other) ? value.other : [];
  const hasOtherSelection = field?.allow_other && otherEntries.length > 0;
  const otherValue = hasOtherSelection ? otherEntries[0]?.label ?? '' : '';
  const showOtherInput = field?.allow_other && hasOtherSelection;
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const openPicker = () => {
    if (readOnly) return;
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
    setSearchQuery('');
  };

  if (displayMode !== 'checkbox') {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredChoices =
      !isSearchable || !normalizedQuery
        ? choices
        : choices.filter((choice) => {
            const label = choice?.label ?? '';
            return String(label).toLowerCase().includes(normalizedQuery);
          });
    const selectedLabels = Array.from(selectedValues)
      .map((value) => {
        const choice = choices.find((option) => option.value === value);
        return choice?.label ?? choice?.value ?? value;
      })
      .filter((label) => label !== null && label !== undefined && label !== '');
    if (hasOtherSelection) {
      selectedLabels.push('Other');
    }
    const summaryText =
      selectedLabels.length > 0 ? selectedLabels.join(', ') : 'Select options...';

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
          <Text
            style={{
              color: selectedLabels.length > 0 ? theme.color.foreground : theme.color.placeholder,
            }}
          >
            {summaryText}
          </Text>
        </Pressable>

        {showOtherInput && !isPickerOpen && (
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
                Select options
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
                  const isSelected = selectedValues.has(choice.value);
                  return (
                    <Pressable
                      key={choice.value}
                      onPress={() => toggleChoice(choice.value)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                    >
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderWidth: 1,
                          borderColor: theme.color.inputBorder,
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
                    onPress={toggleOther}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderWidth: 1,
                        borderColor: theme.color.inputBorder,
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
                            backgroundColor: theme.color.primary,
                          }}
                        />
                      ) : null}
                    </View>
                    <Text style={{ color: theme.color.foreground }}>Other</Text>
                  </Pressable>
                )}
              </ScrollView>

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

              <Pressable
                onPress={closePicker}
                style={{
                  marginTop: 12,
                  alignSelf: 'flex-end',
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                }}
              >
                <Text style={{ color: theme.color.primary, fontWeight: '600' }}>Done</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

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
                borderColor: theme.color.inputBorder,
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
            onPress={toggleOther}
            disabled={readOnly}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderWidth: 1,
                borderColor: theme.color.inputBorder,
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
