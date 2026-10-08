import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCalendarDate } from '../src/helpers/format-calendar-date.js';

const NativeDateTimeFormat = Intl.DateTimeFormat;
const nativeToLocaleDateString = Date.prototype.toLocaleDateString;
const originalTimezone = process.env.TZ;
const earlyDates = ['0001-01-07', '0099-12-31', '0004-02-29'];
const localKey = (date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
    .join('-');

function withLocale(locale, callback) {
  Intl.DateTimeFormat = function (requestedLocale, options) {
    return new NativeDateTimeFormat(requestedLocale ?? locale, options);
  };
  Date.prototype.toLocaleDateString = function (requestedLocale, options) {
    return nativeToLocaleDateString.call(this, requestedLocale ?? locale, options);
  };
  try {
    callback();
  } finally {
    Intl.DateTimeFormat = NativeDateTimeFormat;
    Date.prototype.toLocaleDateString = nativeToLocaleDateString;
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
}

test('historical formatting corrects the captured Android outputs without losing runtime padding', () => {
  // Actual Pixel 8a / Android 17 / Hermes capture, 8 October 2026. This is a replay
  // seam, not execution on a device. Date components were correct; formatter output was not.
  const capturedDisplays = new Map([
    ['0001-01-07', '08/01/0001'],
    ['0099-12-31', '01/01/0100'],
    ['0004-02-29', '01/03/0004'],
  ]);
  const capturedUtcDisplays = new Map([
    ['0001-01-07', '09/01/0001'],
    ['0099-12-31', '02/01/0100'],
    ['0004-02-29', '02/03/0004'],
  ]);
  withLocale('it-IT', () => {
    process.env.TZ = 'Europe/Madrid';
    Date.prototype.toLocaleDateString = function () {
      return capturedDisplays.get(localKey(this)) ?? nativeToLocaleDateString.call(this, 'it-IT');
    };
    Intl.DateTimeFormat = class {
      constructor(locale, options) {
        this.base = new NativeDateTimeFormat(locale ?? 'it-IT', options);
      }
      resolvedOptions() {
        return this.base.resolvedOptions();
      }
      formatToParts(date) {
        const utcKey = date.toISOString().slice(0, 10);
        const captured = capturedUtcDisplays.get(utcKey);
        if (captured) {
          const [day, month, year] = captured.split('/');
          return [
            { type: 'day', value: day },
            { type: 'literal', value: '/' },
            { type: 'month', value: month },
            { type: 'literal', value: '/' },
            { type: 'year', value: year },
          ];
        }
        // Replay the captured platform's numeric widths, including on safe reference dates.
        return this.base.formatToParts(date).map((part) => ({
          ...part,
          value: ['day', 'month', 'year'].includes(part.type)
            ? part.value.padStart(part.type === 'year' ? 4 : 2, '0')
            : part.value,
        }));
      }
    };
    assert.deepEqual(earlyDates.map(formatCalendarDate), [
      '07/01/0001',
      '31/12/0099',
      '29/02/0004',
    ]);
  });
});

test('historical formatting preserves locale order, literals, digits and padding across timezones', () => {
  const locales = [
    'en-US',
    'en-GB',
    'it-IT',
    'es-ES',
    'fr-FR',
    'de-DE',
    'sv-SE',
    'ja-JP',
    'zh-CN',
    'ar-EG',
    'fa-IR-u-ca-gregory',
    'th-TH-u-ca-gregory',
    'en-US-u-nu-fullwide',
    'en-US-u-nu-mathsans',
    'zh-CN-u-nu-hanidec',
  ];
  const values = [
    ...earlyDates,
    '0100-03-01',
    '0999-12-31',
    '1500-02-28',
    '1582-10-04',
    '1582-10-15',
    '1582-12-31',
  ];
  for (const locale of locales)
    withLocale(locale, () => {
      assert.equal(new NativeDateTimeFormat(locale).resolvedOptions().calendar, 'gregory');
      // A correct Node formatter must not conceal a broken fallback: require the
      // new path to succeed, rather than quietly returning the legacy string.
      Date.prototype.toLocaleDateString = () => 'INJECTED HISTORICAL FORMATTER SHIFT';
      for (const timezone of ['UTC', 'Europe/Madrid', 'America/New_York', 'Pacific/Kiritimati']) {
        process.env.TZ = timezone;
        for (const value of values) {
          const reference = new Date(value + 'T12:00:00');
          assert.equal(localKey(reference), value);
          assert.equal(
            formatCalendarDate(value),
            nativeToLocaleDateString.call(reference, locale),
            `${locale} / ${timezone} / ${value}`
          );
        }
      }
    });
});

test('historical formatting respects an ISO calendar extension without forcing a locale', () => {
  withLocale('en-GB-u-ca-iso8601', () => {
    assert.equal(new Intl.DateTimeFormat().resolvedOptions().calendar, 'iso8601');
    for (const value of earlyDates)
      assert.equal(
        formatCalendarDate(value),
        nativeToLocaleDateString.call(new Date(value + 'T12:00:00'), 'en-GB-u-ca-iso8601')
      );
  });
});

test('historical formatting retains the legacy path for other calendar systems', () => {
  for (const locale of [
    'th-TH-u-ca-buddhist',
    'fa-IR-u-ca-persian',
    'ar-SA-u-ca-islamic-umalqura',
    'ja-JP-u-ca-japanese',
  ])
    withLocale(locale, () => {
      assert.ok(
        !['gregory', 'iso8601'].includes(new Intl.DateTimeFormat().resolvedOptions().calendar)
      );
      Date.prototype.toLocaleDateString = () => 'UNCHANGED NON-GREGORIAN OUTPUT';
      for (const value of earlyDates)
        assert.equal(formatCalendarDate(value), 'UNCHANGED NON-GREGORIAN OUTPUT');
    });
});

test('historical formatting leaves post-cutover years, timestamps and year zero on the legacy path', () => {
  withLocale('en-US', () => {
    // These inputs must not depend on the new formatting APIs at all.
    Intl.DateTimeFormat = function () {
      throw new Error('Unexpected historical formatter');
    };
    Date.prototype.toLocaleDateString = () => 'UNCHANGED LEGACY OUTPUT';
    for (const value of [
      '1583-01-01',
      '2000-02-29',
      '2028-09-16',
      '0000-01-07',
      '0099-12-31T12:00:00Z',
    ])
      assert.equal(formatCalendarDate(value), 'UNCHANGED LEGACY OUTPUT');
  });
});

test('historical formatting preserves existing overflow normalization without new validation', () => {
  withLocale('en-GB', () => {
    assert.equal(
      formatCalendarDate('0001-02-29'),
      nativeToLocaleDateString.call(new Date('0001-03-01T12:00:00'), 'en-GB')
    );
    assert.equal(formatCalendarDate('not a date'), 'not a date');
  });
});

test('historical formatting degrades to the legacy output if optional Intl parts are unavailable', () => {
  withLocale('en-US', () => {
    Intl.DateTimeFormat = class {
      resolvedOptions() {
        return { locale: 'en-US', calendar: 'gregory', numberingSystem: 'latn' };
      }
    };
    Date.prototype.toLocaleDateString = () => 'LEGACY OUTPUT';
    assert.equal(formatCalendarDate('0001-01-07'), 'LEGACY OUTPUT');
  });
});
