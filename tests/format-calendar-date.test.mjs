process.env.TZ = 'America/New_York';

import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCalendarDate } from '../src/helpers/format-calendar-date.js';

test('calendar dates keep their day west of UTC', () => {
  assert.equal(formatCalendarDate('2027-01-07'), new Date(2027, 0, 7).toLocaleDateString());
  assert.notEqual(formatCalendarDate('2027-01-07'), new Date(2027, 0, 6).toLocaleDateString());
});

test('non-calendar values keep their previous handling', () => {
  const timestamp = '2027-01-07T15:00:00Z';
  assert.equal(formatCalendarDate(timestamp), new Date(timestamp).toLocaleDateString());
  assert.equal(formatCalendarDate('not a date'), 'not a date');
});
