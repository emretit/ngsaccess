import '../core/attendance_date.dart';
import '../core/errors.dart';

const leaveTypes = [
  'annual',
  'sick',
  'excuse',
  'unpaid',
  'parental',
  'marriage',
  'bereavement',
  'paternity',
  'lactation',
  'compensatory',
];

String _text(Map<String, dynamic> row, String key) {
  final value = row[key];
  if (value is! String || value.isEmpty) throw const ProtocolError();
  return value;
}

String? _optional(Map<String, dynamic> row, String key) {
  final value = row[key];
  if (value == null) return null;
  if (value is! String) throw const ProtocolError();
  return value;
}

String _day(Map<String, dynamic> row, String key) {
  final value = _text(row, key);
  try {
    AttendanceDate.parseDay(value);
  } on FormatException {
    throw const ProtocolError();
  }
  return value;
}

DateTime _instant(String value) {
  final parsed = DateTime.tryParse(value);
  if (parsed == null) throw const ProtocolError();
  return parsed;
}

/// Unknown enum strings stay opaque; presentation only uses known labels.
class LeaveRequest {
  const LeaveRequest({
    required this.id,
    required this.leaveType,
    required this.startDate,
    required this.endDate,
    required this.status,
    required this.createdAt,
    this.notes,
    this.decisionNote,
    this.decidedAt,
    this.source,
  });
  final String id, leaveType, startDate, endDate, status;
  final DateTime createdAt;
  final String? notes, decisionNote, source;
  final DateTime? decidedAt;
  bool get canWithdraw => status == 'pending' && source == 'employee';
  bool get isAdmin => source == null || source == 'admin';
  factory LeaveRequest.fromJson(Object? value) {
    if (value is! Map<String, dynamic>) throw const ProtocolError();
    final decided = _optional(value, 'decidedAt');
    return LeaveRequest(
      id: _text(value, '_id'),
      leaveType: _text(value, 'leaveType'),
      startDate: _day(value, 'startDate'),
      endDate: _day(value, 'endDate'),
      status: _text(value, 'status'),
      createdAt: _instant(_text(value, 'createdAt')),
      notes: _optional(value, 'notes'),
      decisionNote: _optional(value, 'decisionNote'),
      source: _optional(value, 'source'),
      decidedAt: decided == null ? null : _instant(decided),
    );
  }
}

class AttendanceCorrectionRequest {
  const AttendanceCorrectionRequest({
    required this.id,
    required this.date,
    required this.correctionType,
    required this.reason,
    required this.status,
    required this.createdAt,
    this.requestedCheckIn,
    this.requestedCheckOut,
    this.decisionNote,
    this.decidedAt,
  });
  final String id, date, correctionType, reason, status;
  final DateTime createdAt;
  final String? requestedCheckIn, requestedCheckOut, decisionNote;
  final DateTime? decidedAt;
  bool get canWithdraw => status == 'pending';
  factory AttendanceCorrectionRequest.fromJson(Object? value) {
    if (value is! Map<String, dynamic>) throw const ProtocolError();
    final decided = _optional(value, 'decidedAt');
    final checkIn = _optional(value, 'requestedCheckIn');
    final checkOut = _optional(value, 'requestedCheckOut');
    for (final time in [checkIn, checkOut]) {
      if (time != null && !RequestValidation.validTime(time)) {
        throw const ProtocolError();
      }
    }
    return AttendanceCorrectionRequest(
      id: _text(value, '_id'),
      date: _day(value, 'date'),
      correctionType: _text(value, 'correctionType'),
      reason: _text(value, 'reason'),
      status: _text(value, 'status'),
      createdAt: _instant(_text(value, 'createdAt')),
      requestedCheckIn: checkIn,
      requestedCheckOut: checkOut,
      decisionNote: _optional(value, 'decisionNote'),
      decidedAt: decided == null ? null : _instant(decided),
    );
  }
}

abstract final class RequestValidation {
  static bool validTime(String value) =>
      RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(value);
  static DateTime _date(String value) {
    try {
      return AttendanceDate.parseDay(value);
    } on FormatException {
      throw const BusinessError(message: '', code: 'REQUEST_DATE_INVALID');
    }
  }

  static void _fail(String code) =>
      throw BusinessError(message: '', code: code);
  static void leave({
    required String startDate,
    required String endDate,
    required String today,
    String notes = '',
    List<LeaveRequest> existing = const [],
  }) {
    if (notes.length > 500) _fail('REQUEST_NOTE_TOO_LONG');
    final start = _date(startDate), end = _date(endDate), now = _date(today);
    if (end.isBefore(start)) _fail('REQUEST_RANGE_INVALID');
    if (start.isBefore(now.subtract(const Duration(days: 30)))) {
      _fail('REQUEST_START_TOO_OLD');
    }
    if (end.difference(start).inDays + 1 > 60) _fail('REQUEST_RANGE_TOO_LONG');
    if (existing.where((row) => row.status == 'pending').length >= 10) {
      _fail('REQUEST_PENDING_LIMIT');
    }
    bool overlaps(LeaveRequest row) =>
        startDate.compareTo(row.endDate) <= 0 &&
        endDate.compareTo(row.startDate) >= 0;
    if (existing.any((row) => row.status == 'pending' && overlaps(row))) {
      _fail('REQUEST_OVERLAP_PENDING');
    }
    if (existing.any((row) => row.status == 'approved' && overlaps(row))) {
      _fail('REQUEST_OVERLAP_APPROVED');
    }
  }

  static void correction({
    required String date,
    required String today,
    required String correctionType,
    required String reason,
    String? requestedCheckIn,
    String? requestedCheckOut,
    List<AttendanceCorrectionRequest> existing = const [],
  }) {
    final day = _date(date), now = _date(today);
    if (day.isAfter(now) ||
        day.isBefore(now.subtract(const Duration(days: 30)))) {
      _fail('CORRECTION_DATE_OUT_OF_RANGE');
    }
    if (reason.trim().length < 5 || reason.trim().length > 300) {
      _fail('CORRECTION_REASON_LENGTH');
    }
    final needsIn = correctionType != 'checkOut',
        needsOut = correctionType != 'checkIn';
    final hasIn = requestedCheckIn != null && requestedCheckIn.isNotEmpty,
        hasOut = requestedCheckOut != null && requestedCheckOut.isNotEmpty;
    if (!['checkIn', 'checkOut', 'both'].contains(correctionType) ||
        needsIn != hasIn ||
        needsOut != hasOut) {
      _fail('CORRECTION_TIMES_MISMATCH');
    }
    if ((hasIn && !validTime(requestedCheckIn)) ||
        (hasOut && !validTime(requestedCheckOut))) {
      _fail('CORRECTION_TIME_INVALID');
    }
    if (existing.any((row) => row.date == date && row.status == 'pending')) {
      _fail('CORRECTION_PENDING_EXISTS');
    }
  }
}
