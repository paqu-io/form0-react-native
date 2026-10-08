const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function formatHistoricalGregorianDate(date) {
  const { locale, calendar, numberingSystem } = new Intl.DateTimeFormat().resolvedOptions();
  if (calendar !== 'gregory' && calendar !== 'iso8601') return null;

  // Android Intl can apply Julian rules before the Gregorian cutover. A leap-year
  // reference supplies the same month/day and the locale's literals/order, without
  // converting the historical calendar date or applying historical timezone offsets.
  const formatter = new Intl.DateTimeFormat(locale, {
    calendar,
    numberingSystem,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const reference = new Date(Date.UTC(2000, date.getMonth(), date.getDate(), 12));
  const parts = formatter.formatToParts(reference);

  // Learn the runtime's minimum year width, not the length of a four-digit modern
  // year. Mid-year 0001 stays in year 1 under both Gregorian and Julian rules;
  // only its year padding is used, never its (potentially shifted) month/day.
  const yearSample = new Date(0);
  yearSample.setUTCFullYear(1, 6, 1);
  yearSample.setUTCHours(12, 0, 0, 0);
  const yearPart = formatter.formatToParts(yearSample).find((part) => part.type === 'year');
  if (!yearPart || !parts.some((part) => part.type === 'year')) return null;
  const year = new Intl.NumberFormat(locale, {
    numberingSystem,
    useGrouping: false,
    minimumIntegerDigits: Array.from(yearPart.value).length,
  })
    .formatToParts(date.getFullYear())
    .filter((part) => part.type === 'integer')
    .map((part) => part.value)
    .join('');
  if (!year) return null;

  return parts.map((part) => (part.type === 'year' ? year : part.value)).join('');
}

// form0 date values are calendar dates (YYYY-MM-DD). new Date('YYYY-MM-DD') parses them as UTC
// midnight, which shows the previous day west of UTC, so build the date in local time instead.
export function formatCalendarDate(value) {
  const match = CALENDAR_DATE_PATTERN.exec(String(value));
  const date = match ? new Date(0) : new Date(value);
  if (match) {
    // The numeric Date constructor remaps years 00–99 to 1900–1999; setFullYear does not.
    date.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    date.setHours(0, 0, 0, 0);
  }

  if (Number.isNaN(date.getTime())) return String(value);
  const display = date.toLocaleDateString();
  // Limit the fallback to positive calendar years through the cutover year.
  // Other calendars, modern dates, year zero and timestamps keep their old path.
  if (match && date.getFullYear() > 0 && date.getFullYear() <= 1582) {
    try {
      return formatHistoricalGregorianDate(date) ?? display;
    } catch {
      // Older/partial Intl implementations retain the existing behavior.
      return display;
    }
  }
  return display;
}
