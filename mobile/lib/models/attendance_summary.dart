import '../core/attendance_date.dart';
import 'attendance.dart';

int _count(Object? value) {
  if (value is! int || value < 0) {
    throw const FormatException('Invalid attendance count');
  }
  return value;
}

String _date(Object? value) {
  if (value is! String) throw const FormatException('Invalid summary date');
  AttendanceDate.parseDay(value);
  return value;
}

DateTime? _time(Object? value) =>
    value == null ? null : Attendance.parseInstant(value);

class AttendanceDaySummary {
  const AttendanceDaySummary({
    required this.date,
    required this.entryCount,
    required this.exitCount,
    required this.deniedCount,
    required this.unknownCount,
    required this.firstEntry,
    required this.lastEntry,
    required this.lastExit,
    required this.lastDirection,
  });
  final String date;
  final int entryCount;
  final int exitCount;
  final int deniedCount;
  final int unknownCount;
  final DateTime? firstEntry;
  final DateTime? lastEntry;
  final DateTime? lastExit;
  final AttendanceDirection lastDirection;
  factory AttendanceDaySummary.fromJson(Object? json) {
    if (json is! Map<String, dynamic>) {
      throw const FormatException('Invalid summary day');
    }
    final direction = switch (json['lastDirection']) {
      'entry' => AttendanceDirection.entry,
      'exit' => AttendanceDirection.exit,
      'unknown' => AttendanceDirection.unknown,
      _ => throw const FormatException('Invalid summary direction'),
    };
    // Nullable timestamps must still be present: omission is a protocol error.
    for (final key in ['firstEntry', 'lastEntry', 'lastExit']) {
      if (!json.containsKey(key)) {
        throw const FormatException('Missing summary timestamp');
      }
    }
    final date = _date(json['date']);
    final entries = _count(json['entryCount']);
    final exits = _count(json['exitCount']);
    final firstEntry = _time(json['firstEntry']);
    final lastEntry = _time(json['lastEntry']);
    final lastExit = _time(json['lastExit']);
    if ((entries == 0) != (firstEntry == null && lastEntry == null) ||
        (entries > 0 && (firstEntry == null || lastEntry == null)) ||
        (exits == 0) != (lastExit == null) ||
        (direction == AttendanceDirection.entry && entries == 0) ||
        (direction == AttendanceDirection.exit && exits == 0)) {
      throw const FormatException('Inconsistent summary movement');
    }
    for (final time in [firstEntry, lastEntry, lastExit]) {
      if (time != null && AttendanceDate.instantKey(time) != date) {
        throw const FormatException('Summary timestamp outside business day');
      }
    }
    if (firstEntry != null &&
        lastEntry != null &&
        firstEntry.isAfter(lastEntry)) {
      throw const FormatException('Invalid entry ordering');
    }
    return AttendanceDaySummary(
      date: date,
      entryCount: entries,
      exitCount: exits,
      deniedCount: _count(json['deniedCount']),
      unknownCount: _count(json['unknownCount']),
      firstEntry: firstEntry,
      lastEntry: lastEntry,
      lastExit: lastExit,
      lastDirection: direction,
    );
  }
}

class AttendanceTotals {
  const AttendanceTotals({
    required this.entryCount,
    required this.exitCount,
    required this.deniedCount,
    required this.unknownCount,
    required this.presentDays,
  });
  final int entryCount;
  final int exitCount;
  final int deniedCount;
  final int unknownCount;
  final int presentDays;
  factory AttendanceTotals.fromJson(Object? json) {
    if (json is! Map<String, dynamic>) {
      throw const FormatException('Invalid summary totals');
    }
    return AttendanceTotals(
      entryCount: _count(json['entryCount']),
      exitCount: _count(json['exitCount']),
      deniedCount: _count(json['deniedCount']),
      unknownCount: _count(json['unknownCount']),
      presentDays: _count(json['presentDays']),
    );
  }
}

class AttendanceSummary {
  AttendanceSummary({
    required this.startDate,
    required this.endDate,
    required this.generatedAt,
    required List<AttendanceDaySummary> days,
    required this.totals,
  }) : days = List.unmodifiable(days);
  final String startDate;
  final String endDate;
  String get timeZone => AttendanceDate.timeZone;
  final DateTime generatedAt;
  final List<AttendanceDaySummary> days;
  final AttendanceTotals totals;
  AttendanceDaySummary? day(String date) {
    for (final day in days) {
      if (day.date == date) return day;
    }
    return null;
  }

  factory AttendanceSummary.fromJson(Object? json) {
    if (json is! Map<String, dynamic> ||
        json['timeZone'] != AttendanceDate.timeZone ||
        json['days'] is! List) {
      throw const FormatException('Invalid attendance summary');
    }
    final start = _date(json['startDate']);
    final end = _date(json['endDate']);
    AttendanceDate.validateRange(start, end);
    final days = (json['days'] as List)
        .map(AttendanceDaySummary.fromJson)
        .toList();
    final expectedDays =
        AttendanceDate.parseDay(
          end,
        ).difference(AttendanceDate.parseDay(start)).inDays +
        1;
    if (expectedDays > 93 || days.length != expectedDays) {
      throw const FormatException('Incomplete attendance summary');
    }
    final dates = <String>{};
    for (final day in days) {
      if (!dates.add(day.date) ||
          day.date.compareTo(start) < 0 ||
          day.date.compareTo(end) > 0) {
        throw const FormatException('Invalid summary day range');
      }
    }
    final totals = AttendanceTotals.fromJson(json['totals']);
    if (totals.entryCount !=
            days.fold<int>(0, (sum, day) => sum + day.entryCount) ||
        totals.exitCount !=
            days.fold<int>(0, (sum, day) => sum + day.exitCount) ||
        totals.deniedCount !=
            days.fold<int>(0, (sum, day) => sum + day.deniedCount) ||
        totals.unknownCount !=
            days.fold<int>(0, (sum, day) => sum + day.unknownCount) ||
        totals.presentDays != days.where((day) => day.entryCount > 0).length) {
      throw const FormatException('Inconsistent attendance summary');
    }
    return AttendanceSummary(
      startDate: start,
      endDate: end,
      generatedAt: Attendance.parseInstant(json['generatedAt']),
      days: days,
      totals: totals,
    );
  }
}
