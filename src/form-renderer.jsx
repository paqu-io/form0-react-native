import React, { useEffect, useMemo, useState } from 'react';
import { useFormEngine } from './use-form-engine';
import { FieldRenderer } from './field-renderer';
import { FieldRegistryProvider } from './field-registry-context.jsx';
import { ScrollView, Button, View, Text } from 'react-native';
import { isFieldValueEmpty } from './helpers/is-field-value-empty.js';

const SECTION_TYPES = new Set(['Section', 'RepeatableSection', 'BuildingPlanSection']);

export function FormRenderer({
  schema,
  initialValues = {},
  overrideValues,
  onSubmit,
  mode = 'edit',
  debug = false,
  onSchemaReady,
  labelPosition = 'top',
  labelWidthPercent = 30,
  renderers,
  registry,
}) {
  const {
    values,
    visible,
    read_only,
    required,
    errors,
    setValue,
    submit,
    schema: finalSchema,
  } = useFormEngine(schema, initialValues, overrideValues);
  const [submitCount, setSubmitCount] = useState(0);

  useEffect(() => {
    if (onSchemaReady) onSchemaReady(finalSchema);
  }, [finalSchema]);

  const elements = finalSchema?.form?.elements || [];

  const renderElements = (items = [], parentPath = []) =>
    items.map((field) => {
      if (!field) return null;

      if (SECTION_TYPES.has(field.type)) {
        const sectionId = field.data_name || field.key || Math.random().toString(36);
        return (
          <View key={sectionId} style={{ marginBottom: 16 }}>
            {field.label ? (
              <Text style={{ fontWeight: '700', marginBottom: 8 }}>{field.label}</Text>
            ) : null}
            {field.description ? (
              <Text style={{ color: '#555', marginBottom: 8 }}>{field.description}</Text>
            ) : null}
            <View style={{ paddingLeft: 8 }}>
              {renderElements(field.elements || [], [...parentPath, sectionId])}
            </View>
          </View>
        );
      }

      const dataName = field.data_name;
      if (dataName && visible?.[dataName] === false) {
        return null;
      }

      const fieldValue = dataName ? values?.[dataName] : null;
      const fieldRequired = dataName ? Boolean(required?.[dataName]) : false;
      const fieldReadOnly =
        mode === 'readonly' ||
        (dataName ? Boolean(read_only?.[dataName]) : false) ||
        field.type === 'TitleField';
      const engineError = dataName ? errors?.[dataName] : null;
      const requiredError =
        fieldRequired && submitCount > 0 && isFieldValueEmpty(field, fieldValue)
          ? 'This field is required'
          : null;
      const fieldError = engineError || requiredError;

      return (
        <FieldRenderer
          key={field.key || dataName}
          field={field}
          value={fieldValue}
          readOnly={fieldReadOnly}
          required={fieldRequired}
          error={fieldError}
          labelPosition={labelPosition}
          labelWidthPercent={labelWidthPercent}
          onChange={(val) => {
            if (dataName) setValue(dataName, val);
          }}
        />
      );
    });

  const canSubmit = mode !== 'readonly' && typeof onSubmit === 'function';

  return (
    <FieldRegistryProvider registry={registry} renderers={renderers}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {renderElements(elements)}
        {canSubmit && (
          <View style={{ marginTop: 24 }}>
            <Button
              title="Submit"
              onPress={() => {
                setSubmitCount((count) => count + 1);
                onSubmit?.(submit());
              }}
            />
          </View>
        )}
      </ScrollView>
    </FieldRegistryProvider>
  );
}
