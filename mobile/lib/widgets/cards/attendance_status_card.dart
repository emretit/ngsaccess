import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../../providers/attendance_provider.dart';
import '../ui/ui.dart';

/// Daily business status is displayed only after a successful summary response.
class AttendanceStatusCard extends StatelessWidget {
  const AttendanceStatusCard({
    super.key,
    required this.status,
    required this.lastEntry,
    required this.lastExit,
    required this.extraEntryCount,
    required this.extraExitCount,
    this.firstEntry,
    this.firstEntryDoorName,
    this.lastEntryDoorName,
    this.lastExitDoorName,
    this.isLoading = false,
    this.hasLoaded = true,
    this.isStatusKnown = true,
    this.errorMessage,
    this.updatedAt,
    this.onRetry,
  });

  final AttendanceStatus status;
  final DateTime? firstEntry;
  final String? firstEntryDoorName;
  final String? lastEntryDoorName;
  final String? lastExitDoorName;
  final DateTime? lastEntry;
  final DateTime? lastExit;
  final int extraEntryCount;
  final int extraExitCount;
  final bool isLoading;
  final bool hasLoaded;
  final bool isStatusKnown;
  final String? errorMessage;
  final DateTime? updatedAt;
  final VoidCallback? onRetry;

  String? _detail(String? door, String? extra) {
    final parts = [?door, ?extra];
    return parts.isEmpty ? null : parts.join('\n');
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final dates = AppDateFormat(
      locale: Localizations.localeOf(context),
      now: DateTime.now(),
    );
    String time(DateTime? value) =>
        value == null ? l10n.homeAttendanceTimeEmpty : dates.clock(value);
    final (label, tone) = !isStatusKnown
        ? (l10n.homeStatusUnknown, AppStatusTone.warning)
        : switch (status) {
            AttendanceStatus.inside => (
              l10n.homeStatusInside,
              AppStatusTone.success,
            ),
            AttendanceStatus.out => (l10n.homeStatusOut, AppStatusTone.info),
            AttendanceStatus.none => (l10n.homeStatusNone, AppStatusTone.info),
          };
    return AppSurface(
      kind: AppSurfaceKind.attendanceOverlap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 12,
            runSpacing: 12,
            children: [
              Semantics(
                header: true,
                child: Text(
                  l10n.homeToday,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              if (hasLoaded) AppStatusBadge(label: label, tone: tone),
            ],
          ),
          const SizedBox(height: 16),
          if (!hasLoaded && (isLoading || errorMessage == null))
            AppSkeleton(
              semanticLabel: l10n.homeDataLoading,
              kind: AppSkeletonKind.attendance,
              itemCount: 1,
            )
          else if (!hasLoaded)
            AppDataNotice(
              title: l10n.homeDataUnavailable,
              message: errorMessage ?? l10n.homeDataUnavailable,
              tone: AppStatusTone.danger,
              actionLabel: onRetry == null ? null : l10n.homeRetry,
              onAction: onRetry,
            )
          else ...[
            if (errorMessage != null || isLoading) ...[
              AppDataNotice(
                title: errorMessage == null ? null : l10n.homeDataStale,
                message: errorMessage ?? l10n.homeDataRefreshing,
                tone: errorMessage == null
                    ? AppStatusTone.info
                    : AppStatusTone.warning,
                busy: isLoading,
                actionLabel: onRetry == null || isLoading
                    ? null
                    : l10n.homeRetry,
                onAction: isLoading ? null : onRetry,
              ),
              const SizedBox(height: 12),
            ],
            AppMetricRow(
              metrics: [
                AppMetric(
                  label: l10n.homeFirstEntry,
                  value: time(firstEntry),
                  detail: firstEntryDoorName,
                ),
                AppMetric(
                  label: l10n.homeAttendanceExitRow,
                  value: time(lastExit),
                  detail: _detail(
                    lastExitDoorName,
                    extraExitCount > 0
                        ? l10n.homeExtraExits(extraExitCount)
                        : null,
                  ),
                ),
                AppMetric(
                  label: l10n.homeAttendanceEntryRow,
                  value: time(lastEntry),
                  detail: _detail(
                    lastEntryDoorName,
                    extraEntryCount > 0
                        ? l10n.homeExtraEntries(extraEntryCount)
                        : null,
                  ),
                ),
              ],
            ),
            if (updatedAt case final updated?) ...[
              const SizedBox(height: 12),
              Text(
                l10n.homeUpdatedAt(dates.clock(updated)),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
