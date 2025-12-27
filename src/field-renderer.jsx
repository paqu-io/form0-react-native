import React from 'react';
import { Text, View } from 'react-native';
import { useFieldRegistry } from './field-registry-context.jsx';
import { useTheme } from './theme-context.jsx';

const LABEL_SIDE = 'side';

export function FieldRenderer({
  field,
  value,
  onChange,
  readOnly,
  required,
  error,
  labelPosition = 'top',
  labelWidthPercent = 30,
  onKeyDown,
  onFocus,
  showError = true,
}) {
  const registry = useFieldRegistry();
  const { theme } = useTheme();

  const FieldComponent = registry.getFieldComponent(field.type);
  const isLabelField = field.type === 'LabelField';
  const effectiveLabelPosition = isLabelField ? 'top' : labelPosition;
  const isLabelSide = effectiveLabelPosition === LABEL_SIDE;

  if (!FieldComponent) {
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontWeight: '600', marginBottom: 4, color: theme.color.label }}>
          {field.label} {required ? '*' : ''}
        </Text>
        <Text style={{ color: theme.color.error }}>Unsupported field type: {field.type}</Text>
      </View>
    );
  }

  const label = field.label || field.data_name || '';
  const labelNode = (
    <Text style={{ fontWeight: '600', color: theme.color.label }}>
      {label} {required ? '*' : ''}
    </Text>
  );

  const inputProps = {
    name: field.data_name,
    readOnly,
    required,
    onFocus,
  };

  const fieldInput = isLabelField ? null : (
    <FieldComponent
      field={field}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      readOnly={readOnly}
      inputProps={inputProps}
    />
  );

  // Error container with reserved height to prevent layout shifts
  const errorNode = showError ? (
    <View style={{ minHeight: 18, marginTop: 4 }}>
      {error ? (
        <Text style={{ color: theme.color.error, fontSize: 12, lineHeight: 16 }}>{error}</Text>
      ) : null}
    </View>
  ) : null;

  const content = (
    <>
      {field.description ? (
        <Text style={{ color: theme.color.description, marginTop: 4 }}>{field.description}</Text>
      ) : null}
      {fieldInput}
      {errorNode}
    </>
  );

  if (isLabelSide) {
    return (
      <View style={{ marginBottom: 16, flexDirection: 'row' }}>
        <View style={{ width: `${labelWidthPercent}%`, marginRight: 12 }}>{labelNode}</View>
        <View style={{ flex: 1 }}>{content}</View>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 16 }}>
      {labelNode}
      {content}
    </View>
  );
}
