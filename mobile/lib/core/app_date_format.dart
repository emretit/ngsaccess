import 'package:flutter/material.dart';
import 'attendance_date.dart';

/// Presentation of instants in Turkey and calendar days without double shifting.
class AppDateFormat {
  const AppDateFormat({required this.locale, required this.now});
  final Locale locale;
  final DateTime now;
  bool get _tr => locale.languageCode == 'tr';
  static const _trMonths = [
    'Oca',
    'Şub',
    'Mar',
    'Nis',
    'May',
    'Haz',
    'Tem',
    'Ağu',
    'Eyl',
    'Eki',
    'Kas',
    'Ara',
  ];
  static const _enMonths = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  static const _trFullMonths = [
    'Ocak',
    'Şubat',
    'Mart',
    'Nisan',
    'Mayıs',
    'Haziran',
    'Temmuz',
    'Ağustos',
    'Eylül',
    'Ekim',
    'Kasım',
    'Aralık',
  ];
  static const _enFullMonths = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  static const _trDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  static const _enDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  static const _trFullDays = [
    'Pazartesi',
    'Salı',
    'Çarşamba',
    'Perşembe',
    'Cuma',
    'Cumartesi',
    'Pazar',
  ];
  static const _enFullDays = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];
  String _pad(int n) => n.toString().padLeft(2, '0');
  String _month(DateTime d) => (_tr ? _trMonths : _enMonths)[d.month - 1];
  String clock(DateTime instant) {
    final wall = AttendanceDate.businessTime(instant);
    return '${_pad(wall.hour)}:${_pad(wall.minute)}';
  }

  String timeOfDay(TimeOfDay time) => '${_pad(time.hour)}:${_pad(time.minute)}';
  String relativeDateTime(DateTime instant) {
    final day = calendarDayFromInstant(instant);
    final today = calendarDayFromInstant(now);
    if (day == today) return '${_tr ? 'Bugün' : 'Today'} ${clock(instant)}';
    if (day == today.subtract(const Duration(days: 1))) {
      return '${_tr ? 'Dün' : 'Yesterday'} ${clock(instant)}';
    }
    return dateTime(instant);
  }

  String dateTime(DateTime instant, {bool includeYear = false}) {
    final day = calendarDayFromInstant(instant);
    return '${dayLabel(day, includeYear: includeYear || day.year != calendarDayFromInstant(now).year)} ${clock(instant)}';
  }

  String dayLabel(DateTime calendarDay, {bool includeYear = false}) =>
      '${calendarDay.day} ${_month(calendarDay)}${includeYear ? ' ${calendarDay.year}' : ''} ${(_tr ? _trDays : _enDays)[calendarDay.weekday - 1]}';
  String headingDate(DateTime instant) {
    final d = calendarDayFromInstant(instant);
    return _tr
        ? '${d.day} ${_trFullMonths[d.month - 1]} ${_trFullDays[d.weekday - 1]}'
        : '${_enFullDays[d.weekday - 1]}, ${d.day} ${_enFullMonths[d.month - 1]}';
  }

  String dateRange({required DateTime startDay, required DateTime endDay}) {
    final a = DateTime.utc(startDay.year, startDay.month, startDay.day);
    final b = DateTime.utc(endDay.year, endDay.month, endDay.day);
    if (b.isBefore(a)) throw ArgumentError('End day precedes start day');
    final year = a.year != b.year || a.year != calendarDayFromInstant(now).year;
    String short(DateTime d, {bool withYear = false}) =>
        '${d.day} ${_month(d)}${withYear ? ' ${d.year}' : ''}';
    if (a == b) return short(a, withYear: year);
    if (a.year == b.year && a.month == b.month) {
      return '${a.day}–${short(b, withYear: year)}';
    }
    return '${short(a, withYear: year)}–${short(b, withYear: year)}';
  }

  /// Use for draft form ranges: invalid ranges have no presentation value.
  /// [dateRange] remains strict for validated domain data.
  String? tryDateRange({required DateTime startDay, required DateTime endDay}) {
    final start = DateTime.utc(startDay.year, startDay.month, startDay.day);
    final end = DateTime.utc(endDay.year, endDay.month, endDay.day);
    return end.isBefore(start) ? null : dateRange(startDay: start, endDay: end);
  }

  /// Picker values are calendar days; only the fallback instant is shifted.
  static DateTime initialPickerDay({
    required DateTime now,
    required DateTime firstDate,
    required DateTime lastDate,
    DateTime? value,
  }) {
    final first = DateTime.utc(firstDate.year, firstDate.month, firstDate.day);
    final last = DateTime.utc(lastDate.year, lastDate.month, lastDate.day);
    if (last.isBefore(first)) throw ArgumentError('End day precedes start day');
    final day = value == null
        ? calendarDayFromInstant(now)
        : DateTime.utc(value.year, value.month, value.day);
    return day.isBefore(first)
        ? first
        : day.isAfter(last)
        ? last
        : day;
  }

  static DateTime calendarDayFromInstant(DateTime instant) {
    final d = AttendanceDate.businessTime(instant);
    return DateTime.utc(d.year, d.month, d.day);
  }

  static DateTime instantFromTurkeyParts({
    required DateTime calendarDay,
    required TimeOfDay time,
  }) => DateTime.utc(
    calendarDay.year,
    calendarDay.month,
    calendarDay.day,
    time.hour,
    time.minute,
  ).subtract(AttendanceDate.offset);
}
