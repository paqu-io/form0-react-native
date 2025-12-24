function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasChoiceSelection(choiceArray) {
  if (!Array.isArray(choiceArray) || choiceArray.length === 0) {
    return false;
  }
  return choiceArray.some((choice) => {
    if (!choice || typeof choice !== 'object') return false;
    if (choice.value != null && choice.value !== '') return true;
    if (hasText(choice.label)) return true;
    return false;
  });
}

function hasOtherEntries(otherArray) {
  if (!Array.isArray(otherArray) || otherArray.length === 0) {
    return false;
  }
  return otherArray.some((other) => {
    if (!other) return false;
    if (typeof other === 'string') return hasText(other);
    if (hasText(other.label)) return true;
    if (other.value != null && other.value !== '') return true;
    return false;
  });
}

export function isFieldValueEmpty(field, value) {
  if (!field) return true;
  if (value === null || value === undefined) return true;

  switch (field.type) {
    case 'TextField':
    case 'CalculatedField':
    case 'DateField':
    case 'TimeField':
    case 'TitleField':
    case 'StatusField':
      if (typeof value === 'string') {
        return value.trim().length === 0;
      }
      return false;

    case 'NumericField':
      if (typeof value === 'number') return false;
      if (typeof value === 'string') return value.trim().length === 0;
      return true;

    case 'SingleChoiceField':
    case 'BooleanField': {
      const choice = hasChoiceSelection(value?.choice);
      const other = hasOtherEntries(value?.other);
      return !(choice || other);
    }

    case 'MultiChoiceField': {
      const choices = hasChoiceSelection(value?.choices);
      const other = hasOtherEntries(value?.other);
      return !(choices || other);
    }

    case 'PhotoField':
    case 'VideoField':
      return !Array.isArray(value) || value.length === 0;

    case 'SignatureField':
      if (typeof value === 'string') {
        return value.trim().length === 0;
      }
      if (value && typeof value === 'object') {
        if (hasText(value.data)) return false;
        if (hasText(value.url)) return false;
      }
      return true;

    default:
      if (Array.isArray(value)) {
        return value.length === 0;
      }
      if (typeof value === 'object') {
        return Object.keys(value).length === 0;
      }
      return false;
  }
}
