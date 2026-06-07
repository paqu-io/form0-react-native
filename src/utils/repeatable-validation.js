import { isFieldValueEmpty } from '../helpers/is-field-value-empty.js';

export function collectValidatableFields(
  elements,
  { includeRepeatableChildren = false } = {},
  acc = []
) {
  if (!Array.isArray(elements)) {
    return acc;
  }

  elements.forEach((element) => {
    if (!element || typeof element !== 'object') {
      return;
    }
    if (element.type === 'Section' || element.type === 'BuildingPlanSection') {
      collectValidatableFields(element.elements || [], { includeRepeatableChildren }, acc);
      return;
    }
    if (element.type === 'RepeatableSection') {
      if (includeRepeatableChildren) {
        collectValidatableFields(element.elements || [], { includeRepeatableChildren }, acc);
      }
      return;
    }
    acc.push(element);
  });

  return acc;
}

export function buildValidationSummary(fields, { getValue, isVisible, isRequired, getError }) {
  const requiredFieldErrors = [];
  const generalErrors = [];
  const orderedIssues = [];

  fields.forEach((field) => {
    if (!field || !field.data_name) {
      return;
    }

    if (typeof isVisible === 'function' && !isVisible(field)) {
      return;
    }

    const dataName = field.data_name;
    const errorMessage = typeof getError === 'function' ? getError(field, dataName) : null;
    if (errorMessage) {
      const issue = {
        field,
        fieldName: dataName,
        message: errorMessage,
        kind: 'error',
      };
      generalErrors.push(issue);
      orderedIssues.push(issue);
    }

    if (!isRequired || !isRequired(field)) {
      return;
    }

    const value = typeof getValue === 'function' ? getValue(field, dataName) : undefined;
    if (isFieldValueEmpty(field, value)) {
      const issue = {
        field,
        fieldName: dataName,
        message: 'This field is required',
        kind: 'required',
      };
      requiredFieldErrors.push(issue);
      if (!errorMessage) {
        orderedIssues.push(issue);
      }
    }
  });

  return {
    hasErrors: requiredFieldErrors.length > 0 || generalErrors.length > 0,
    requiredFieldErrors,
    generalErrors,
    orderedIssues,
  };
}

export function getFirstValidationIssue(summary) {
  if (!summary || typeof summary !== 'object') {
    return null;
  }
  return (
    summary.orderedIssues?.[0] ||
    summary.generalErrors?.[0] ||
    summary.requiredFieldErrors?.[0] ||
    null
  );
}

export function getRepeatableAddLabel(field) {
  if (typeof field?.add_label === 'string' && field.add_label.trim().length > 0) {
    return field.add_label.trim();
  }
  if (typeof field?.label === 'string' && field.label.trim().length > 0) {
    return `Add ${field.label.replace(/s\b/i, '').trim()}`;
  }
  return 'Add';
}
