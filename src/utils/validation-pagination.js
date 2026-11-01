export const VALIDATION_PAGE_SIZE = 15;

/** Clamp pagination as findings are corrected without resetting on each new array instance. */
export function getValidationPage(requestedOffset, count) {
  const lastOffset = Math.max(
    0,
    Math.floor((count - 1) / VALIDATION_PAGE_SIZE) * VALIDATION_PAGE_SIZE,
  );
  const offset = Math.min(Math.max(0, requestedOffset), lastOffset);
  return {
    offset,
    end: Math.min(count, offset + VALIDATION_PAGE_SIZE),
    hasPages: count > VALIDATION_PAGE_SIZE,
    hasPrevious: offset > 0,
    hasNext: offset + VALIDATION_PAGE_SIZE < count,
  };
}
