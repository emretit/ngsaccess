import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/attendance_date.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/models/employee_request.dart';

Matcher code(String code) =>
    throwsA(isA<BusinessError>().having((e) => e.safeCode, 'code', code));
void main() {
  test(
    'known pending limits, inclusive overlaps and correction duplicates',
    () {
      LeaveRequest row(String status) => LeaveRequest(
        id: 'id',
        leaveType: 'annual',
        startDate: '2026-10-19',
        endDate: '2026-10-20',
        status: status,
        createdAt: DateTime.utc(2026, 10, 19),
      );
      void validate(List<LeaveRequest> rows) => RequestValidation.leave(
        startDate: '2026-10-20',
        endDate: '2026-10-21',
        today: '2026-10-19',
        existing: rows,
      );
      expect(() => validate([row('pending')]), code('REQUEST_OVERLAP_PENDING'));
      expect(
        () => validate([row('approved')]),
        code('REQUEST_OVERLAP_APPROVED'),
      );
      expect(
        () => validate(List.generate(10, (_) => row('pending'))),
        code('REQUEST_PENDING_LIMIT'),
      );
      expect(() => validate([row('rejected')]), returnsNormally);
      expect(
        () => RequestValidation.correction(
          date: '2026-10-19',
          today: '2026-10-19',
          correctionType: 'checkIn',
          requestedCheckIn: '09:00',
          reason: 'Gerekçe',
          existing: [
            AttendanceCorrectionRequest(
              id: 'id',
              date: '2026-10-19',
              correctionType: 'checkIn',
              reason: 'Gerekçe',
              status: 'pending',
              createdAt: DateTime.utc(2026, 10, 19),
            ),
          ],
        ),
        code('CORRECTION_PENDING_EXISTS'),
      );
    },
  );
  void leave(String start, String end, {String notes = ''}) =>
      RequestValidation.leave(
        startDate: start,
        endDate: end,
        today: '2026-10-19',
        notes: notes,
      );
  void correction({
    String date = '2026-10-19',
    String reason = 'gerekçe',
    String type = 'checkIn',
    String? checkIn = '09:00',
    String? checkOut,
  }) => RequestValidation.correction(
    date: date,
    today: '2026-10-19',
    reason: reason,
    correctionType: type,
    requestedCheckIn: checkIn,
    requestedCheckOut: checkOut,
  );
  test('leave inclusive 30-day and 60-day boundaries and notes', () {
    expect(
      () => leave('2026-09-19', '2026-11-17', notes: 'x' * 500),
      returnsNormally,
    );
    expect(
      () => leave('2026-09-18', '2026-09-19'),
      code('REQUEST_START_TOO_OLD'),
    );
    expect(
      () => leave('2026-09-19', '2026-11-18'),
      code('REQUEST_RANGE_TOO_LONG'),
    );
    expect(
      () => leave('2026-10-20', '2026-10-19'),
      code('REQUEST_RANGE_INVALID'),
    );
    expect(
      () => leave('2026-02-30', '2026-03-01'),
      code('REQUEST_DATE_INVALID'),
    );
    expect(
      () => leave('2026-10-19', '2026-10-19', notes: 'x' * 501),
      code('REQUEST_NOTE_TOO_LONG'),
    );
  });
  test(
    'correction 30 days, trimmed reason 5/300, 24-hour time and exact type fields',
    () {
      correction(date: '2026-09-19', reason: '  abcde  ', checkIn: '00:00');
      correction(reason: 'x' * 300, type: 'both', checkOut: '23:59');
      correction(type: 'checkOut', checkIn: null, checkOut: '17:00');
      for (final date in ['2026-09-18', '2026-10-20']) {
        expect(
          () => correction(date: date),
          code('CORRECTION_DATE_OUT_OF_RANGE'),
        );
      }
      for (final reason in ['abcd', '     ', 'x' * 301]) {
        expect(
          () => correction(reason: reason),
          code('CORRECTION_REASON_LENGTH'),
        );
      }
      for (final time in ['24:00', '9:00', '12:60', '09:00:00']) {
        expect(
          () => correction(checkIn: time),
          code('CORRECTION_TIME_INVALID'),
        );
      }
      expect(
        () => correction(checkIn: null),
        code('CORRECTION_TIMES_MISMATCH'),
      );
      expect(
        () => correction(checkOut: '17:00'),
        code('CORRECTION_TIMES_MISMATCH'),
      );
    },
  );
  test('Turkey day rolls over before UTC', () {
    expect(
      AttendanceDate.instantKey(DateTime.parse('2026-10-18T21:00:00Z')),
      '2026-10-19',
    );
  });
}
