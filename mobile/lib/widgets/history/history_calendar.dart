import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/attendance_date.dart';
import '../../l10n/app_localizations.dart';
import '../ui/ui.dart';

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

  /// Null means the month counts have not been loaded successfully.
  final Map<String, int>? dayCounts;
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
    int? count(DateTime day) => dayCounts == null || day.isAfter(current)
        ? null
        : dayCounts?[AttendanceDate.calendarKey(day)] ?? 0;
    String label(DateTime day) {
      final fullDate = DateFormat.yMMMMd(locale).format(day);
      final records = count(day);
      return records == null
          ? fullDate
          : '$fullDate, ${l.historyDayRecordCount(records)}';
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
          return AppListGroup(
            children: [
              for (
                var d = 1;
                d <= length &&
                    !DateTime(month.year, month.month, d).isAfter(current);
                d++
              )
                Builder(
                  builder: (context) {
                    final day = DateTime(month.year, month.month, d);
                    return AppListRow(
                      key: ValueKey(
                        'history-day-${AttendanceDate.calendarKey(day)}',
                      ),
                      title: DateFormat.yMMMEd(locale).format(day),
                      subtitle: count(day) == null
                          ? null
                          : l.historyDayRecordCount(count(day) ?? 0),
                      selected: selected(day),
                      enabled: !day.isAfter(current),
                      leadingIcon: selected(day)
                          ? Icons.check_circle_outline
                          : DateUtils.isSameDay(day, current)
                          ? Icons.today_outlined
                          : Icons.calendar_today_outlined,
                      semanticLabel: label(day),
                      onTap: () => onDaySelected(day),
                    );
                  },
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
            for (var week = 0; week < 6; week++)
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
                          final isSelected = selected(day);
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
                                      ? tokens.accent
                                      : colors.onSurface,
                                  backgroundColor: isSelected
                                      ? tokens.selectedBackground
                                      : null,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  side: DateUtils.isSameDay(day, current)
                                      ? BorderSide(color: tokens.focus)
                                      : BorderSide.none,
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
                                            color: !enabled
                                                ? tokens.disabledForeground
                                                : isSelected
                                                ? tokens.accent
                                                : colors.onSurface,
                                          ),
                                    ),
                                    const SizedBox(height: 3),
                                    SizedBox(
                                      width: 5,
                                      height: 5,
                                      child: (count(day) ?? 0) > 0
                                          ? DecoratedBox(
                                              key: ValueKey(
                                                'history-day-marker-${AttendanceDate.calendarKey(day)}',
                                              ),
                                              decoration: BoxDecoration(
                                                color: tokens.accent,
                                                shape: BoxShape.circle,
                                              ),
                                            )
                                          : null,
                                    ),
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
          ],
        );
      },
    );
  }
}
