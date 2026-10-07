process.env.TZ = 'America/New_York';

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { formatCalendarDate } from '../src/helpers/format-calendar-date.js';

for (const timezone of ['UTC', 'America/New_York']) {
  test(`preserves early-year calendar dates in ${timezone}`, () => {
    const formatterUrl = new URL('../src/helpers/format-calendar-date.js', import.meta.url);
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import assert from 'node:assert/strict';
         import { formatCalendarDate } from ${JSON.stringify(formatterUrl.href)};
         for (const value of ['0001-01-07', '0099-12-31', '0004-02-29']) {
           // ISO local-noon parsing is independent of the formatter's date construction.
           const expected = new Date(value + 'T12:00:00');
           assert.equal(expected.getFullYear(), Number(value.slice(0, 4)));
           assert.equal(formatCalendarDate(value), expected.toLocaleDateString());
         }`,
      ],
      { env: { ...process.env, TZ: timezone }, stdio: 'pipe' }
    );
  });
}

test('calendar dates keep their day west of UTC', () => {
  assert.equal(formatCalendarDate('2027-01-07'), new Date(2027, 0, 7).toLocaleDateString());
  assert.notEqual(formatCalendarDate('2027-01-07'), new Date(2027, 0, 6).toLocaleDateString());
});

test('non-calendar values keep their previous handling', () => {
  const timestamp = '2027-01-07T15:00:00Z';
  assert.equal(formatCalendarDate(timestamp), new Date(timestamp).toLocaleDateString());
  assert.equal(formatCalendarDate('not a date'), 'not a date');
});
