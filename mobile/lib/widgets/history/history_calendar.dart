import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:table_calendar/table_calendar.dart';

import '../../core/attendance_date.dart';
import '../../l10n/app_localizations.dart';

class HistoryCalendar extends StatelessWidget {
  const HistoryCalendar({
    super.key,
    required this.month,
    required this.dayCounts,
    required this.onDaySelected,
    this.today,
    this.selectedDay,
  });

  final DateTime month;
  final Map<String, int> dayCounts;
  final ValueChanged<DateTime> onDaySelected;
  final DateTime? today;
  final DateTime? selectedDay;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toLanguageTag();
    final firstDay = DateTime(month.year, month.month);
    final lastDay = DateTime(month.year, month.month + 1, 0);
    final scale = MediaQuery.textScalerOf(context).scale(14) / 14;
    final colors = Theme.of(context).colorScheme;
    final current = today ?? AttendanceDate.businessTime(DateTime.now());
    final currentDay = DateTime(current.year, current.month, current.day);

    Widget dayCell(BuildContext context, DateTime day, DateTime focusedDay) {
      final count = dayCounts[AttendanceDate.calendarKey(day)] ?? 0;
      final selected = isSameDay(day, selectedDay);
      final isToday = isSameDay(day, currentDay);
      final future = DateTime(day.year, day.month, day.day).isAfter(currentDay);
      return Container(
        margin: const EdgeInsets.all(2),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: selected ? colors.primary : null,
          border: isToday
              ? Border.all(color: colors.primary, width: 1.5)
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '${day.day}',
              style: TextStyle(
                color: selected
                    ? colors.onPrimary
                    : future
                    ? colors.onSurface.withValues(alpha: .38)
                    : colors.onSurface,
                fontWeight: selected || isToday
                    ? FontWeight.w700
                    : FontWeight.normal,
              ),
            ),
            const SizedBox(height: 3),
            if (count > 0)
              Container(
                width: 5,
                height: 5,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: selected ? colors.onPrimary : colors.primary,
                ),
              )
            else
              const SizedBox(height: 5),
          ],
        ),
      );
    }

    return TableCalendar<int>(
      firstDay: firstDay,
      lastDay: lastDay,
      focusedDay: firstDay,
      currentDay: currentDay,
      selectedDayPredicate: (day) => isSameDay(day, selectedDay),
      enabledDayPredicate: (day) =>
          !DateTime(day.year, day.month, day.day).isAfter(currentDay),
      locale: locale,
      headerVisible: false,
      availableGestures: AvailableGestures.none,
      startingDayOfWeek: StartingDayOfWeek.monday,
      rowHeight: 48.0 * scale.clamp(1, 2),
      daysOfWeekHeight: 28.0 * scale.clamp(1, 2),
      calendarStyle: const CalendarStyle(outsideDaysVisible: false),
      eventLoader: (day) {
        final count = dayCounts[AttendanceDate.calendarKey(day)] ?? 0;
        return count > 0 ? [count] : const <int>[];
      },
      calendarBuilders: CalendarBuilders<int>(
        defaultBuilder: dayCell,
        todayBuilder: dayCell,
        selectedBuilder: dayCell,
        disabledBuilder: dayCell,
        // TableCalendar excludes semantics inside its day-cell builder. Its
        // marker is a sibling of that cell: the outer day gesture merges the
        // package's date label with this record count and exposes one action.
        markerBuilder: (context, day, events) => Positioned.fill(
          child: InkWell(
            key: ValueKey('history-day-${AttendanceDate.calendarKey(day)}'),
            excludeFromSemantics: true,
            borderRadius: BorderRadius.circular(8),
            onTap: DateTime(day.year, day.month, day.day).isAfter(currentDay)
                ? null
                : () => onDaySelected(DateTime(day.year, day.month, day.day)),
            child: Semantics(
              label: l10n.historyDayRecordCount(
                dayCounts[AttendanceDate.calendarKey(day)] ?? 0,
              ),
              button: !DateTime(
                day.year,
                day.month,
                day.day,
              ).isAfter(currentDay),
              child: const SizedBox.expand(),
            ),
          ),
        ),
        dowBuilder: (context, day) => Center(
          child: Text(
            DateFormat('EEE', locale).format(day),
            style: TextStyle(fontSize: 11, color: colors.onSurfaceVariant),
          ),
        ),
      ),
      onDaySelected: (day, focusedDay) =>
          onDaySelected(DateTime(day.year, day.month, day.day)),
    );
  }
}
