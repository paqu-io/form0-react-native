/** Convert choice SETVALUE shorthand at the adapter boundary; preserve structured values. */
export function normalizeChoiceOperationValue(field, value) {
  const primitive = (entry) => ['string', 'number', 'boolean'].includes(typeof entry);
  const choice = (entry) => {
    if (!primitive(entry)) return entry;
    const defined = field?.choices?.find((item) => String(item.value) === String(entry));
    return { value: defined?.value ?? entry, label: defined?.label || String(entry) };
  };
  if (['SingleChoiceField', 'BooleanField'].includes(field?.type) && primitive(value))
    return { choice: [choice(value)], other: [] };
  if (field?.type === 'MultiChoiceField' && Array.isArray(value))
    return { choices: value.map(choice), other: [] };
  return value;
}
