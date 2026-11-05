import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/attendance_date.dart';

import 'package:ngsplusapp/widgets/ui/ui.dart';
import '../../helpers/ui_mount.dart' show mount;

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
  group('date picker regressions', () {
    test(
      'RV1-13 invalid draft ranges are absent while validated API stays strict',
      () {
        final format = AppDateFormat(
          locale: const Locale('en'),
          now: DateTime.utc(2026, 11, 4),
        );
        expect(
          format.tryDateRange(
            startDay: DateTime.utc(2026, 11, 8),
            endDay: DateTime.utc(2026, 11, 4),
          ),
          isNull,
        );
        expect(
          format.tryDateRange(
            startDay: DateTime.utc(2026, 11, 4),
            endDay: DateTime.utc(2026, 11, 8),
          ),
          '4–8 Nov',
        );
        expect(
          () => format.dateRange(
            startDay: DateTime.utc(2026, 11, 8),
            endDay: DateTime.utc(2026, 11, 4),
          ),
          throwsArgumentError,
        );
      },
    );
    test(
      'RV1-13 empty picker starts on Turkey day and clamps to allowed days',
      () {
        final first = DateTime.utc(2026, 11, 1);
        final last = DateTime.utc(2026, 11, 30);
        DateTime day(String instant) => AppDateFormat.initialPickerDay(
          now: DateTime.parse(instant),
          firstDate: first,
          lastDate: last,
        );
        expect(day('2026-11-03T20:59:00Z'), DateTime.utc(2026, 11, 3));
        expect(day('2026-11-03T21:00:00Z'), DateTime.utc(2026, 11, 4));
        expect(day('2025-01-01T00:00:00Z'), first);
        expect(day('2027-01-01T00:00:00Z'), last);
        expect(
          AppDateFormat.initialPickerDay(
            now: DateTime.utc(2026),
            value: DateTime.utc(2026, 11, 9),
            firstDate: first,
            lastDate: last,
          ),
          DateTime.utc(2026, 11, 9),
        );
      },
    );
    testWidgets(
      'RV1-13 date field passes explicit initial and current Turkey dates',
      (tester) async {
        await mount(
          tester,
          AppDateField(
            label: 'Date',
            value: null,
            firstDate: DateTime.utc(2030),
            lastDate: DateTime.utc(2031),
            onChanged: (_) {},
          ),
        );
        await tester.tap(find.text('Choose a date'));
        await tester.pumpAndSettle();
        final picker = tester.widget<DatePickerDialog>(
          find.byType(DatePickerDialog),
        );
        expect(picker.initialDate, DateTime(2030));
        final today = AppDateFormat.calendarDayFromInstant(DateTime.now());
        expect(
          picker.currentDate,
          DateTime(today.year, today.month, today.day),
        );
      },
    );
  });
}
