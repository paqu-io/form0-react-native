import React from 'react';
import { Text, TextInput, View } from 'react-native';

function formatDisplayValue(value, style) {
  if (value == null) return '';
  switch (style) {
    case 'currency': return `$${parseFloat(value).toFixed(2)}`;
    case 'date': return new Date(value).toLocaleDateString();
    case 'numeric': return Number(value);
    default: return String(value);
  }
}

export function FieldRenderer({ field, value, onChange, readOnly, required, error }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>
        {field.label} {required ? '*' : ''}
      </Text>

      {field.type === 'TextField' && (
        <TextInput
          value={value ?? ''}
          onChangeText={onChange}
          editable={!readOnly}
          style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 8 }}
        />
      )}

      {field.type === 'NumericField' && (
        <TextInput
          value={value === null || value === undefined ? '' : String(value)}
          onChangeText={(text) => {
            if (field.format === 'integer' && (text.includes('.') || text.includes(','))) return;
            const val = text === '' ? null : Number(text);
            onChange(val);
          }}
          keyboardType="numeric"
          editable={!readOnly}
          style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 8 }}
        />
      )}

      {field.type === 'CalculatedField' && (
        <Text style={{ padding: 8, backgroundColor: '#f4f4f4', borderRadius: 4 }}>
          {formatDisplayValue(value, field.display?.style)}
        </Text>
      )}

      {error && <Text style={{ color: 'red', marginTop: 4 }}>{error}</Text>}
    </View>
  );
}
