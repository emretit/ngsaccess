import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/models/attendance_summary.dart';

Map<String, dynamic> _day() => {
  'date': '2026-10-19',
  'entryCount': 0,
  'exitCount': 0,
  'deniedCount': 1,
  'unknownCount': 1,
  'firstEntry': null,
  'lastEntry': null,
  'lastExit': null,
  'lastDirection': 'unknown',
};
Map<String, dynamic> _summary() => {
  'startDate': '2026-10-19',
  'endDate': '2026-10-19',
  'timeZone': 'Europe/Istanbul',
  'generatedAt': '2026-10-19T12:00:00Z',
  'days': [_day()],
  'totals': {
    'entryCount': 0,
    'exitCount': 0,
    'deniedCount': 1,
    'unknownCount': 1,
    'presentDays': 0,
  },
};
void main() {
  test('ret and unknown counts do not imply presence', () {
    final result = AttendanceSummary.fromJson(_summary());
    expect(result.totals.presentDays, 0);
    expect(result.day('2026-10-19')?.deniedCount, 1);
    expect(result.day('2026-10-19')?.firstEntry, isNull);
  });
  test('inconsistent totals never become authoritative period data', () {
    expect(
      () => AttendanceSummary.fromJson({
        ..._summary(),
        'totals': {
          'entryCount': 1,
          'exitCount': 0,
          'deniedCount': 1,
          'unknownCount': 1,
          'presentDays': 0,
        },
      }),
      throwsFormatException,
    );
  });
  test(
    'bad counters, missing nullable timestamps and duplicate/outside days reject',
    () {
      final missing = _day()..remove('firstEntry');
      for (final days in [
        [
          {..._day(), 'entryCount': -1},
        ],
        [
          {..._day(), 'exitCount': 1.5},
        ],
        [missing],
        [],
        [_day(), _day()],
        [
          {..._day(), 'date': '2026-10-20'},
        ],
      ]) {
        expect(
          () => AttendanceSummary.fromJson({..._summary(), 'days': days}),
          throwsFormatException,
        );
      }
    },
  );
}
