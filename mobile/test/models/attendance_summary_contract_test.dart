import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/response_decoder.dart';
import 'package:ngsplusapp/models/attendance_summary.dart';

Map<String, Object?> _day(String date, {String? entry, String? exit}) => {
  'date': date,
  'entryCount': entry == null ? 0 : 1,
  'exitCount': exit == null ? 0 : 1,
  'deniedCount': 0,
  'unknownCount': 0,
  'firstEntry': entry,
  'lastEntry': entry,
  'lastExit': exit,
  'lastDirection': exit != null
      ? 'exit'
      : entry != null
      ? 'entry'
      : 'unknown',
};

Map<String, Object?> _summary({
  required String start,
  required String end,
  required List<Map<String, Object?>> days,
  required int entries,
  required int exits,
  required Object? presentDays,
}) => {
  'startDate': start,
  'endDate': end,
  'timeZone': 'Europe/Istanbul',
  'generatedAt': '${end}T16:00:00.000Z',
  'days': days,
  'totals': {
    'entryCount': entries,
    'exitCount': exits,
    'deniedCount': 0,
    'unknownCount': 0,
    'presentDays': presentDays,
  },
};

AttendanceSummary _decode(Map<String, Object?> summary) =>
    AttendanceSummary.fromJson(
      decodeResponseObject(
        decodeConvexResponse(
          statusCode: 200,
          body: jsonEncode({'status': 'success', 'value': summary}),
        ),
      ),
    );

void main() {
  // convex/pdksFixedRules.integration.test.ts: 09:00–17:00 is below
  // the 500-minute minimum, despite an entry and exit on that day.
  test(
    'decoder accepts fixed minimum rules with punches but no present day',
    () {
      final result = _decode(
        _summary(
          start: '2026-06-22',
          end: '2026-06-22',
          days: [
            _day(
              '2026-06-22',
              entry: '2026-06-22T06:00:00.000Z',
              exit: '2026-06-22T14:00:00.000Z',
            ),
          ],
          entries: 1,
          exits: 1,
          presentDays: 0,
        ),
      );
      expect(result.totals.entryCount, 1);
      expect(result.totals.presentDays, 0);
    },
  );
  // D5 in convex/w5aFix1.test.ts: a night shift and a manually completed
  // shift count as two present days; raw punches stay on calendar days.
  test(
    'decoder accepts manual and night presence independent of raw punches',
    () {
      final result = _decode(
        _summary(
          start: '2026-10-23',
          end: '2026-10-26',
          days: [
            _day('2026-10-23', entry: '2026-10-23T19:00:00.000Z'),
            _day('2026-10-24', exit: '2026-10-24T03:00:00.000Z'),
            _day('2026-10-25'),
            _day('2026-10-26'),
          ],
          entries: 1,
          exits: 1,
          presentDays: 2,
        ),
      );
      expect(result.totals.presentDays, 2);
      expect(result.day('2026-10-24')?.exitCount, 1);
      expect(result.day('2026-10-26')?.entryCount, 0);
      expect(result.day('2026-10-26')?.firstEntry, isNull);
    },
  );
  test('decoder accepts a manually completed day with no movements', () {
    final result = _decode(
      _summary(
        start: '2026-10-26',
        end: '2026-10-26',
        days: [_day('2026-10-26')],
        entries: 0,
        exits: 0,
        presentDays: 1,
      ),
    );
    expect(result.totals.presentDays, 1);
    expect(result.totals.entryCount, 0);
  });
  test('decoder rejects invalid presence bounds and non-integer counts', () {
    for (final presentDays in [-1, 2, 0.5, null]) {
      expect(
        () => _decode(
          _summary(
            start: '2026-10-26',
            end: '2026-10-26',
            days: [_day('2026-10-26')],
            entries: 0,
            exits: 0,
            presentDays: presentDays,
          ),
        ),
        throwsFormatException,
      );
    }
  });
  test('decoder still rejects movement total inconsistencies', () {
    expect(
      () => _decode(
        _summary(
          start: '2026-10-26',
          end: '2026-10-26',
          days: [_day('2026-10-26')],
          entries: 1,
          exits: 0,
          presentDays: 1,
        ),
      ),
      throwsFormatException,
    );
  });
}
