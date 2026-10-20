import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/models/attendance.dart';

Map<String, dynamic> _row() => {
  '_id': 'event',
  'accessTime': '2026-10-19T00:00:00+03:00',
};
void main() {
  test(
    'unknown direction and access decision stay unknown through JSON round-trip',
    () {
      final record = Attendance.fromConvex(_row());
      expect(record.movement, AttendanceDirection.unknown);
      expect(record.decision, AttendanceDecision.unknown);
      expect(record.isEntry, isFalse);
      expect(record.isExit, isFalse);
      expect(record.granted, isFalse);
      expect(record.denied, isFalse);
      expect(record.type, 'unknown');
      expect(
        Attendance.fromConvex(record.toJson()).decision,
        AttendanceDecision.unknown,
      );
    },
  );
  test(
    'denied entry remains a raw entry attempt without accepted check-in time',
    () {
      final record = Attendance.fromConvex({
        ..._row(),
        'accessStatus': 'reddedildi',
        'direction': 'entry',
      });
      expect(record.isEntry, isTrue);
      expect(record.denied, isTrue);
      expect(record.checkInTime, isNull);
    },
  );
  test('granted known directions preserve compatibility getters', () {
    final entry = Attendance.fromConvex({
      ..._row(),
      'accessStatus': 'izin_verildi',
      'direction': 'entry',
    });
    final exit = Attendance.fromConvex({
      ..._row(),
      'accessStatus': 'izin_verildi',
      'direction': 'exit',
    });
    expect(entry.type, 'check_in');
    expect(entry.checkInTime, DateTime.utc(2026, 10, 18, 21));
    expect(exit.type, 'check_out');
    expect(exit.checkOutTime, entry.accessTime);
  });
  test(
    'missing names have no localized domain fallback and source is preserved',
    () {
      final record = Attendance.fromConvex({
        ..._row(),
        'employeeName': ' ',
        'source': 'hikvision',
      });
      expect(record.employeeName, isNull);
      expect(record.doorName, '');
      expect(record.formattedDeviceInfo, '');
      expect(record.source, 'hikvision');
    },
  );
  test(
    'invalid nested metadata, identifiers and timezone-less timestamps fail visibly',
    () {
      for (final row in [
        {..._row(), '_id': true},
        {..._row(), 'device': []},
        {..._row(), 'employeeId': 1},
        {..._row(), 'accessTime': '2026-02-30T09:00:00Z'},
        {..._row(), 'accessTime': '2026-10-19T24:00:00Z'},
        {..._row(), 'accessTime': '2026-10-19T09:00:00'},
      ]) {
        expect(() => Attendance.fromConvex(row), throwsFormatException);
      }
    },
  );
  test('malformed row never disappears from an otherwise successful list', () {
    expect(
      () => Attendance.listFromConvexJson('[null]'),
      throwsFormatException,
    );
    expect(() => Attendance.listFromConvexJson('{}'), throwsFormatException);
  });
}
