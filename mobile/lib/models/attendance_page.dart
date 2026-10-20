import 'attendance.dart';

class AttendancePage {
  AttendancePage({
    required List<Attendance> page,
    required this.isDone,
    required this.continueCursor,
  }) : page = List.unmodifiable(page);
  final List<Attendance> page;
  final bool isDone;
  final String continueCursor;
  factory AttendancePage.fromJson(Object? json) {
    if (json is! Map<String, dynamic> ||
        json['isDone'] is! bool ||
        json['continueCursor'] is! String) {
      throw const FormatException('Invalid attendance page');
    }
    final done = json['isDone'] as bool;
    final cursor = json['continueCursor'] as String;
    if (!done && cursor.isEmpty) {
      throw const FormatException('Missing attendance cursor');
    }
    return AttendancePage(
      page: Attendance.decodeList(json['page']),
      isDone: done,
      continueCursor: cursor,
    );
  }
}
