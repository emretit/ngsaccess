import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/app_date_format.dart';
import 'package:ngsplusapp/core/attendance_date.dart';

void main() {
  final now = DateTime.parse('2026-11-04T12:00:00Z');
  AppDateFormat format(String language) =>
      AppDateFormat(locale: Locale(language), now: now);
  test('Turkey midnight is independent of host timezone', () {
    expect(
      AppDateFormat.calendarDayFromInstant(
        DateTime.parse('2026-11-03T20:59:00Z'),
      ),
      DateTime.utc(2026, 11, 3),
    );
    expect(
      AppDateFormat.calendarDayFromInstant(
        DateTime.parse('2026-11-03T21:00:00Z'),
      ),
      DateTime.utc(2026, 11, 4),
    );
    expect(
      format('tr').relativeDateTime(DateTime.parse('2026-11-03T21:00:00Z')),
      'Bugün 00:00',
    );
    expect(
      format('en').relativeDateTime(DateTime.parse('2026-11-03T20:59:00Z')),
      'Yesterday 23:59',
    );
    expect(
      AppDateFormat.calendarDayFromInstant(
        DateTime.parse('2026-12-31T21:00:00Z'),
      ),
      DateTime.utc(2027),
    );
  });
  test('calendar days are never shifted and wall clock round trips', () {
    final day = AttendanceDate.parseDay('2026-11-04');
    final instant = AppDateFormat.instantFromTurkeyParts(
      calendarDay: day,
      time: const TimeOfDay(hour: 0, minute: 7),
    );
    expect(instant, DateTime.parse('2026-11-03T21:07:00Z'));
    expect(AppDateFormat.calendarDayFromInstant(instant), day);
    expect(format('tr').clock(instant), '00:07');
    expect(format('tr').dayLabel(day), '4 Kas Çar');
    expect(format('en').dayLabel(day, includeYear: true), '4 Nov 2026 Wed');
  });
  test('localized headings and relative years', () {
    expect(format('tr').headingDate(now), '4 Kasım Çarşamba');
    expect(format('en').headingDate(now), 'Wednesday, 4 November');
    expect(
      format('tr').dateTime(DateTime.utc(2025, 11, 4, 10, 20)),
      '4 Kas 2025 Sal 13:20',
    );
    expect(
      format('en').timeOfDay(const TimeOfDay(hour: 9, minute: 3)),
      '09:03',
    );
  });
  test('compact ranges include cross-year and out-of-year context', () {
    final tr = format('tr');
    final en = format('en');
    expect(
      tr.dateRange(
        startDay: DateTime.utc(2026, 11, 9),
        endDay: DateTime.utc(2026, 11, 11),
      ),
      '9–11 Kas',
    );
    expect(
      en.dateRange(
        startDay: DateTime.utc(2026, 11, 30),
        endDay: DateTime.utc(2026, 12, 2),
      ),
      '30 Nov–2 Dec',
    );
    expect(
      tr.dateRange(
        startDay: DateTime.utc(2026, 12, 30),
        endDay: DateTime.utc(2027, 1, 2),
      ),
      '30 Ara 2026–2 Oca 2027',
    );
    expect(
      en.dateRange(
        startDay: DateTime.utc(2027, 11, 9),
        endDay: DateTime.utc(2027, 11, 11),
      ),
      '9–11 Nov 2027',
    );
    expect(
      tr.dateRange(
        startDay: DateTime.utc(2026, 11, 9),
        endDay: DateTime.utc(2026, 11, 9),
      ),
      '9 Kas',
    );
    expect(
      () => tr.dateRange(
        startDay: DateTime.utc(2026, 12),
        endDay: DateTime.utc(2026, 11),
      ),
      throwsArgumentError,
    );
  });
}
