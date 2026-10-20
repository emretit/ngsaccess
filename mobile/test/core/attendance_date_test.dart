import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/attendance_date.dart';

void main() {
  test(
    'UTC calendar selections preserve date components; actual instants use Istanbul day',
    () {
      expect(
        AttendanceDate.calendarKey(DateTime.utc(2026, 10, 19)),
        '2026-10-19',
      );
      expect(AttendanceDate.calendarKey(DateTime(2026, 10, 19)), '2026-10-19');
      expect(
        AttendanceDate.instantKey(DateTime.utc(2026, 10, 18, 21)),
        '2026-10-19',
      );
      expect(
        AttendanceDate.instantKey(DateTime.parse('2026-10-19T00:00:00+03:00')),
        '2026-10-19',
      );
    },
  );
  test('half-open day includes midnight once and excludes next midnight', () {
    final midnight = DateTime.utc(2026, 10, 18, 21);
    expect(AttendanceDate.inDay(midnight, '2026-10-19'), isTrue);
    expect(AttendanceDate.inDay(midnight, '2026-10-18'), isFalse);
    expect(
      AttendanceDate.inDay(midnight.add(const Duration(days: 1)), '2026-10-19'),
      isFalse,
    );
  });
  test('month starts on first; leap year and year boundary are normalized', () {
    expect(AttendanceDate.month(DateTime.utc(2026, 9, 30, 21)), (
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    ));
    expect(AttendanceDate.month(DateTime.utc(2024, 2, 15)), (
      startDate: '2024-02-01',
      endDate: '2024-02-29',
    ));
    expect(AttendanceDate.month(DateTime.utc(2026, 12, 31, 21)), (
      startDate: '2027-01-01',
      endDate: '2027-01-31',
    ));
  });
  test(
    'Monday morning belongs to current week and clock time does not shift boundary',
    () {
      final morning = AttendanceDate.week(DateTime.utc(2026, 10, 19, 6));
      final afternoon = AttendanceDate.week(DateTime.utc(2026, 10, 19, 12));
      expect(morning, (startDate: '2026-10-19', endDate: '2026-10-25'));
      expect(afternoon, morning);
    },
  );
  test(
    'European DST transition does not change Istanbul modern business offset',
    () {
      expect(AttendanceDate.businessTime(DateTime.utc(2026, 3, 29, 1)).hour, 4);
      expect(
        AttendanceDate.businessTime(DateTime.utc(2026, 10, 25, 1)).hour,
        4,
      );
    },
  );
  test(
    'invalid dates reject rollover instead of normalizing to another day',
    () {
      for (final day in [
        '2026-02-29',
        '2026-02-30',
        '2026-13-01',
        '2026-1-1',
        'invalid',
      ]) {
        expect(() => AttendanceDate.parseDay(day), throwsFormatException);
      }
    },
  );
}
