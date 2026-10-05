const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// form0 date values are calendar dates (YYYY-MM-DD). new Date('YYYY-MM-DD') parses them as UTC
// midnight, which shows the previous day west of UTC, so build the date in local time instead.
export function formatCalendarDate(value) {
  const match = CALENDAR_DATE_PATTERN.exec(String(value));
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);

  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}
