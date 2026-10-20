/// Calendar selections and instants deliberately have separate entry points.
/// This describes raw event days, not payroll/shift days.
abstract final class AttendanceDate {
  static const timeZone = 'Europe/Istanbul';
  // Turkey's modern attendance contract uses UTC+03 (continuous since 2016).
  // Historical timezone and shift resolution belongs to the server.
  static const offset = Duration(hours: 3);
  static DateTime businessTime(DateTime instant) => instant.toUtc().add(offset);
  static String calendarKey(DateTime day) =>
      '${day.year.toString().padLeft(4, '0')}-'
      '${day.month.toString().padLeft(2, '0')}-'
      '${day.day.toString().padLeft(2, '0')}';
  static String instantKey(DateTime instant) =>
      calendarKey(businessTime(instant));
  static DateTime parseDay(String value) {
    if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value)) {
      throw const FormatException('Invalid attendance date');
    }
    final parsed = DateTime.tryParse('${value}T00:00:00Z');
    if (parsed == null || calendarKey(parsed) != value) {
      throw const FormatException('Invalid attendance date');
    }
    return parsed;
  }

  static DateTime dayStart(String day) => parseDay(day).subtract(offset);
  static DateTime nextDayStart(String day) =>
      dayStart(day).add(const Duration(days: 1));
  static bool inDay(DateTime instant, String day) =>
      !instant.toUtc().isBefore(dayStart(day)) &&
      instant.toUtc().isBefore(nextDayStart(day));
  static ({String startDate, String endDate}) month(DateTime instant) {
    final now = businessTime(instant);
    return (
      startDate: calendarKey(DateTime.utc(now.year, now.month, 1)),
      endDate: calendarKey(DateTime.utc(now.year, now.month + 1, 0)),
    );
  }

  static ({String startDate, String endDate}) week(DateTime instant) {
    final now = businessTime(instant);
    final monday = DateTime.utc(
      now.year,
      now.month,
      now.day,
    ).subtract(Duration(days: now.weekday - DateTime.monday));
    return (
      startDate: calendarKey(monday),
      endDate: calendarKey(monday.add(const Duration(days: 6))),
    );
  }

  static void validateRange(String? startDate, String? endDate) {
    if (startDate != null) parseDay(startDate);
    if (endDate != null) parseDay(endDate);
    if (startDate != null &&
        endDate != null &&
        startDate.compareTo(endDate) > 0) {
      throw const FormatException('Invalid attendance date range');
    }
  }
}
