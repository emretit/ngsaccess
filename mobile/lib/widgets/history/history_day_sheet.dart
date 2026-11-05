import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/attendance_date.dart';
import '../../l10n/app_localizations.dart';
import '../../models/attendance_summary.dart';
import '../ui/ui.dart';

/// Uses the complete month summary, independently of paginated records.
class HistoryDaySheet extends StatelessWidget {
  const HistoryDaySheet({
    super.key,
    required this.day,
    required this.summary,
    required this.now,
    required this.onViewRecords,
    this.isLoading = false,
    this.hasError = false,
    this.onRetry,
  });

  final DateTime day;
  final AttendanceSummary? summary;
  final DateTime now;
  final VoidCallback onViewRecords;
  final bool isLoading;
  final bool hasError;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context);
    final key = AttendanceDate.calendarKey(day);
    final data = summary?.day(key);
    final count = data == null
        ? 0
        : data.entryCount +
              data.exitCount +
              data.deniedCount +
              data.unknownCount;
    final format = AppDateFormat(locale: locale, now: now);
    String clock(DateTime? instant) =>
        instant == null ? l.homeAttendanceTimeEmpty : format.clock(instant);
    return AppSheet(
      title: DateFormat.yMMMMEEEEd(locale.toLanguageTag()).format(day),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (summary != null && hasError) ...[
            Wrap(
              spacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(l.historyStaleData),
                TextButton(
                  onPressed: isLoading ? null : onRetry,
                  child: Text(l.commonRetry),
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          if (summary == null && hasError && !isLoading)
            Text(l.historyDayUnavailable)
          else if (summary == null)
            AppSkeleton(
              semanticLabel: l.historyLoading,
              kind: AppSkeletonKind.metrics,
              itemCount: 1,
            )
          else if (data == null || count == 0)
            AppEmptyState(
              title: l.historyDayNoRecords,
              message: l.historyNoActivityHint,
              icon: Icons.event_note_outlined,
            )
          else ...[
            AppMetricRow(
              metrics: [
                AppMetric(
                  label: l.historyDayFirstEntry,
                  value: clock(data.firstEntry),
                ),
                AppMetric(
                  label: l.historyDayLastExit,
                  value: clock(data.lastExit),
                ),
              ],
            ),
            const SizedBox(height: 16),
            AppMetricRow(
              metrics: [
                AppMetric(
                  label: l.historyEntryShort,
                  value: '${data.entryCount}',
                ),
                AppMetric(
                  label: l.historyExitShort,
                  value: '${data.exitCount}',
                ),
              ],
            ),
            if (data.deniedCount > 0 || data.unknownCount > 0) ...[
              const SizedBox(height: 16),
              Wrap(
                spacing: 12,
                runSpacing: 8,
                children: [
                  if (data.deniedCount > 0)
                    AppStatusBadge(
                      label: '${l.historyDeniedCount}: ${data.deniedCount}',
                      tone: AppStatusTone.danger,
                    ),
                  if (data.unknownCount > 0)
                    AppStatusBadge(
                      label: '${l.historyUnknownCount}: ${data.unknownCount}',
                      tone: AppStatusTone.info,
                    ),
                ],
              ),
            ],
          ],
          const SizedBox(height: 20),
          AppPrimaryButton(
            label: l.historyDayViewRecords,
            onPressed: onViewRecords,
          ),
        ],
      ),
    );
  }
}
