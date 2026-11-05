import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/attendance_date.dart';
import '../../l10n/app_localizations.dart';
import '../../models/attendance_summary.dart';
import '../../models/attendance.dart';
import '../ui/ui.dart';

class HistoryCalendar extends StatelessWidget {
  const HistoryCalendar({
    super.key,
    required this.month,
    required this.onDaySelected,
    this.today,
    this.selectedDay,
    this.days,
  });
  final DateTime month;

  /// Per-day server summaries keyed by `YYYY-MM-DD`; null while unknown.
  final Map<String, AttendanceDaySummary>? days;

  final ValueChanged<DateTime> onDaySelected;
  final DateTime? today;
  final DateTime? selectedDay;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toLanguageTag();
    final tokens = AppUiTokens.of(context);
    final colors = Theme.of(context).colorScheme;
    final now = today ?? AttendanceDate.businessTime(DateTime.now());
    final current = DateTime(now.year, now.month, now.day);
    final first = DateTime(month.year, month.month);
    final length = DateTime(month.year, month.month + 1, 0).day;
    bool selected(DateTime day) => DateUtils.isSameDay(day, selectedDay);
    int? count(DateTime day) {
      if (day.isAfter(current)) return null;
      final summaries = days;
      if (summaries == null) return null;
      final summary = summaries[AttendanceDate.calendarKey(day)];
      return summary == null
          ? 0
          : summary.entryCount +
                summary.exitCount +
                summary.deniedCount +
                summary.unknownCount;
    }

    _DayState? state(DateTime day) {
      if (day.isAfter(current)) return null;
      final summary = days?[AttendanceDate.calendarKey(day)];
      if (summary == null) return null;
      if (summary.deniedCount > 0) return _DayState.denied;
      if (summary.entryCount > 0 &&
          summary.lastDirection == AttendanceDirection.entry &&
          day.isBefore(current)) {
        return _DayState.missingExit;
      }
      return (count(day) ?? 0) > 0 ? _DayState.records : null;
    }

    String? details(DateTime day) {
      final records = count(day);
      if (records == null) return null;
      return [
        l.historyDayRecordCount(records),
        if (state(day) == _DayState.denied)
          l.historyDayDenied(
            days?[AttendanceDate.calendarKey(day)]?.deniedCount ?? 0,
          ),
        if (state(day) == _DayState.missingExit) l.historyDayMissingExit,
      ].join(', ');
    }

    String label(DateTime day) {
      final fullDate = DateFormat.yMMMMd(locale).format(day);
      final description = details(day);
      return description == null ? fullDate : '$fullDate, $description';
    }

    final onAccent = Theme.of(context).brightness == Brightness.dark
        ? colors.onSecondary
        : colors.onPrimary;
    Widget marker(_DayState status, {Key? key, bool onSelected = false}) {
      final color = onSelected
          ? onAccent
          : status == _DayState.denied
          ? tokens.status(AppStatusTone.danger).foreground
          : tokens.accent;
      return SizedBox(
        width: 6,
        height: 6,
        child: DecoratedBox(
          key: key,
          decoration: BoxDecoration(
            shape: status == _DayState.denied
                ? BoxShape.rectangle
                : BoxShape.circle,
            borderRadius: status == _DayState.denied
                ? BorderRadius.circular(1)
                : null,
            color: status == _DayState.missingExit ? null : color,
            border: status == _DayState.missingExit
                ? Border.all(color: color, width: 1.5)
                : null,
          ),
        ),
      );
    }

    final painter = TextPainter(
      text: TextSpan(text: '28', style: Theme.of(context).textTheme.bodyMedium),
      textScaler: MediaQuery.textScalerOf(context),
      textDirection: Directionality.of(context),
    )..layout();
    final numberWidth = painter.width;
    final numberHeight = painter.height;
    painter.dispose();
    return LayoutBuilder(
      builder: (context, constraints) {
        final cellWidth = constraints.maxWidth / 7;
        // The agreed grid minimum is 44dp wide and 48dp high; text must fit.
        final useList =
            cellWidth < 44 ||
            numberWidth + 8 > cellWidth ||
            numberHeight + 16 > 48;
        if (useList) {
          final visibleDays = [
            for (var d = length; d >= 1; d--)
              if (!DateTime(month.year, month.month, d).isAfter(current) &&
                  (days == null ||
                      (count(DateTime(month.year, month.month, d)) ?? 0) > 0 ||
                      DateUtils.isSameDay(
                        DateTime(month.year, month.month, d),
                        current,
                      )))
                DateTime(month.year, month.month, d),
          ];
          return AppListGroup(
            children: [
              if (visibleDays.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(l.historyNoActivity),
                ),
              for (final day in visibleDays)
                AppListRow(
                  key: ValueKey(
                    'history-day-${AttendanceDate.calendarKey(day)}',
                  ),
                  title: DateFormat.yMMMEd(locale).format(day),
                  subtitle: details(day),
                  selected: selected(day),
                  leadingIcon: selected(day)
                      ? Icons.check_circle_outline
                      : DateUtils.isSameDay(day, current)
                      ? Icons.today_outlined
                      : Icons.calendar_today_outlined,
                  semanticLabel: label(day),
                  onTap: () => onDaySelected(day),
                ),
            ],
          );
        }
        return Column(
          children: [
            ExcludeSemantics(
              child: Row(
                children: [
                  for (var i = 0; i < 7; i++)
                    Expanded(
                      child: Center(
                        child: Text(
                          DateFormat.E(
                            locale,
                          ).format(DateTime(2026, 10, 19 + i)),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            for (
              var week = 0;
              week < ((first.weekday - 1) + length + 6) ~/ 7;
              week++
            )
              Row(
                children: [
                  for (var weekday = 0; weekday < 7; weekday++)
                    Expanded(
                      child: Builder(
                        builder: (context) {
                          final ordinal =
                              week * 7 + weekday - (first.weekday - 1) + 1;
                          if (ordinal < 1 || ordinal > length) {
                            return const SizedBox(height: 48);
                          }
                          final day = DateTime(
                            month.year,
                            month.month,
                            ordinal,
                          );
                          final enabled = !day.isAfter(current);
                          final isSelected = enabled && selected(day);
                          final isToday = DateUtils.isSameDay(day, current);
                          return Semantics(
                            key: ValueKey(
                              'history-day-${AttendanceDate.calendarKey(day)}',
                            ),
                            label: label(day),
                            button: true,
                            enabled: enabled,
                            selected: isSelected,
                            onTap: enabled ? () => onDaySelected(day) : null,
                            excludeSemantics: true,
                            child: SizedBox(
                              height: 48,
                              child: TextButton(
                                onPressed: enabled
                                    ? () => onDaySelected(day)
                                    : null,
                                style: TextButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  foregroundColor: isSelected
                                      ? onAccent
                                      : colors.onSurface,
                                  backgroundColor: isSelected
                                      ? tokens.accent
                                      : null,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  side: BorderSide.none,
                                ),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      '$ordinal',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyMedium
                                          ?.copyWith(
                                            fontWeight: isToday
                                                ? FontWeight.w700
                                                : null,
                                            color: !enabled
                                                ? tokens.disabledForeground
                                                : isSelected
                                                ? onAccent
                                                : isToday
                                                ? tokens.accent
                                                : colors.onSurface,
                                          ),
                                    ),
                                    const SizedBox(height: 3),
                                    if (state(day) case final status?)
                                      marker(
                                        status,
                                        key: ValueKey(
                                          'history-day-marker-${AttendanceDate.calendarKey(day)}',
                                        ),
                                        onSelected: isSelected,
                                      )
                                    else
                                      const SizedBox(width: 6, height: 6),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                ],
              ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 16,
              runSpacing: 8,
              children: [
                for (final (status, text) in [
                  (_DayState.records, l.historyLegendRecords),
                  (_DayState.denied, l.historyLegendDenied),
                  (_DayState.missingExit, l.historyLegendMissingExit),
                ])
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      marker(status),
                      const SizedBox(width: 6),
                      Text(text, style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
              ],
            ),
          ],
        );
      },
    );
  }
}

enum _DayState { records, denied, missingExit }
