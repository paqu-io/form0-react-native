import { normalizeFieldValue } from 'form0-core';

/** Apply the shared strict input contract to an event operation without mutating its input. */
export const normalizeChoiceOperationValue = (field, value) => normalizeFieldValue(field, value);
