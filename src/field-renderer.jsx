import React from 'react';
import { Text, View } from 'react-native';
import { useFieldRegistry } from './field-registry-context.jsx';

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
  const FieldComponent = registry.getFieldComponent(field.type);
  const isLabelField = field.type === 'LabelField';
  const effectiveLabelPosition = isLabelField ? 'top' : labelPosition;
  const isLabelSide = effectiveLabelPosition === LABEL_SIDE;

  if (!FieldComponent) {
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontWeight: '600', marginBottom: 4 }}>
          {field.label} {required ? '*' : ''}
        </Text>
        <Text style={{ color: 'tomato' }}>Unsupported field type: {field.type}</Text>
      </View>
    );
  }

  const label = field.label || field.data_name || '';
  const labelNode = (
    <Text style={{ fontWeight: '600' }}>
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

  const content = (
    <>
      {field.description ? (
        <Text style={{ color: '#555', marginTop: 4 }}>{field.description}</Text>
      ) : null}
      {fieldInput}
      {showError && error ? (
        <Text style={{ color: 'tomato', marginTop: 4 }}>{error}</Text>
      ) : null}
    </>
  );

  if (isLabelSide) {
    return (
      <View style={{ marginBottom: 16, flexDirection: 'row' }}>
        <View style={{ width: `${labelWidthPercent}%`, marginRight: 12 }}>
          {labelNode}
        </View>
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
