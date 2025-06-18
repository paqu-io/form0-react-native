import React, { useEffect } from 'react';
import { useFormEngine } from './use-form-engine';
import { FieldRenderer } from './field-renderer';
import { ScrollView, Button, View } from 'react-native';

export function FormRenderer({ schema, initialValues = {}, overrideValues, onSubmit, mode = 'edit', debug = false, onSchemaReady }) {
  const { values, visible, read_only, required, errors, setValue, submit, schema: finalSchema } = useFormEngine(schema, initialValues, overrideValues);

  useEffect(() => {
    if (onSchemaReady) onSchemaReady(finalSchema);
  }, [finalSchema]);

  const elements = schema.form?.elements || [];

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {elements.map((field) => (
        visible[field.data_name] !== false && (
          <FieldRenderer
            key={field.key || field.data_name}
            field={field}
            value={values[field.data_name]}
            readOnly={read_only[field.data_name] || mode === 'readonly'}
            required={required[field.data_name]}
            error={errors[field.data_name]}
            onChange={(val) => setValue(field.data_name, val)}
          />
        )
      ))}
      {mode !== 'readonly' && (
        <View style={{ marginTop: 24 }}>
          <Button title="Submit" onPress={() => onSubmit?.(submit())} />
        </View>
      )}
    </ScrollView>
  );
}