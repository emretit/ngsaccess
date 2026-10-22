import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../l10n/app_localizations.dart';
import '../../core/attendance_date.dart';
import '../../providers/attendance_provider.dart';
import '../../theme/app_theme.dart';

/// Daily business status is displayed only after a successful summary response.
class AttendanceStatusCard extends StatelessWidget {
  const AttendanceStatusCard({
    super.key,
    required this.status,
    required this.lastEntry,
    required this.lastExit,
    required this.extraEntryCount,
    required this.extraExitCount,
    required this.onScan,
    this.isLoading = false,
    this.hasLoaded = true,
    this.isStatusKnown = true,
    this.errorMessage,
    this.updatedAt,
    this.onRetry,
  });

  final AttendanceStatus status;
  final DateTime? lastEntry;
  final DateTime? lastExit;
  final int extraEntryCount;
  final int extraExitCount;
  final VoidCallback onScan;
  final bool isLoading;
  final bool hasLoaded;
  final bool isStatusKnown;
  final String? errorMessage;
  final DateTime? updatedAt;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final error = errorMessage;
    final updated = updatedAt;
    final timeFmt = DateFormat.Hm(
      Localizations.localeOf(context).toLanguageTag(),
    );
    final entry = lastEntry;
    final exit = lastExit;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              header: true,
              child: Text(
                l10n.homeAttendanceStatus,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(height: 12),
            if (!hasLoaded) ...[
              _DataNotice(
                message: error == null
                    ? l10n.homeDataLoading
                    : l10n.homeDataUnavailable,
                detail: error,
                isLoading: isLoading || error == null,
                onRetry: isLoading ? null : onRetry,
              ),
            ] else ...[
              if (error != null || isLoading) ...[
                _DataNotice(
                  message: error != null
                      ? l10n.homeDataStale
                      : l10n.homeDataRefreshing,
                  detail: error,
                  isLoading: isLoading,
                  onRetry: isLoading ? null : onRetry,
                ),
                const SizedBox(height: 16),
              ],
              _StatusBadge(status: status, isKnown: isStatusKnown),
              const SizedBox(height: 10),
              _TimeRow(
                icon: Icons.login,
                tone: AppStatusTone.success,
                label: l10n.homeAttendanceEntryRow,
                time: entry == null
                    ? l10n.homeAttendanceTimeEmpty
                    : timeFmt.format(AttendanceDate.businessTime(entry)),
                trailing: extraEntryCount > 0
                    ? l10n.homeExtraMovements(extraEntryCount)
                    : null,
              ),
              const SizedBox(height: 8),
              _TimeRow(
                icon: Icons.logout,
                tone: AppStatusTone.danger,
                label: l10n.homeAttendanceExitRow,
                time: exit == null
                    ? l10n.homeAttendanceTimeEmpty
                    : timeFmt.format(AttendanceDate.businessTime(exit)),
                trailing: extraExitCount > 0
                    ? l10n.homeExtraMovements(extraExitCount)
                    : null,
              ),
              if (updated != null) ...[
                const SizedBox(height: 8),
                Text(
                  l10n.homeUpdatedAt(
                    DateFormat.yMd(
                      Localizations.localeOf(context).toLanguageTag(),
                    ).add_Hm().format(AttendanceDate.businessTime(updated)),
                  ),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ],
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: onScan,
                icon: const Icon(Icons.qr_code_scanner, size: 18),
                label: Text(l10n.homeScanQr, textAlign: TextAlign.center),
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(48, 48),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 10,
                  ),
                  textStyle: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DataNotice extends StatelessWidget {
  const _DataNotice({
    required this.message,
    required this.isLoading,
    this.detail,
    this.onRetry,
  });

  final String message;
  final String? detail;
  final bool isLoading;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = AppTheme.statusColors(context, AppStatusTone.warning);
    final error = detail;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Announce meaningful errors, without announcing every polling tick.
          Semantics(
            liveRegion: error != null,
            child: Text(
              message,
              style: TextStyle(
                color: colors.foreground,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          if (error != null) ...[
            const SizedBox(height: 8),
            Text(error, style: TextStyle(color: colors.foreground)),
          ],
          if (isLoading) ...[
            const SizedBox(height: 12),
            LinearProgressIndicator(semanticsLabel: message),
          ],
          if (onRetry != null)
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: Text(AppLocalizations.of(context).homeRetry),
              style: TextButton.styleFrom(foregroundColor: colors.foreground),
            ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status, required this.isKnown});
  final AttendanceStatus status;
  final bool isKnown;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final (label, tone, icon) = !isKnown
        ? (l10n.homeStatusUnknown, AppStatusTone.warning, Icons.help_outline)
        : switch (status) {
            AttendanceStatus.none => (
              l10n.homeStatusNone,
              AppStatusTone.info,
              Icons.access_time,
            ),
            AttendanceStatus.inside => (
              l10n.homeStatusInside,
              AppStatusTone.success,
              Icons.login,
            ),
            AttendanceStatus.out => (
              l10n.homeStatusOut,
              AppStatusTone.info,
              Icons.logout,
            ),
          };
    final colors = AppTheme.statusColors(context, tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ExcludeSemantics(
            child: Icon(icon, color: colors.foreground, size: 18),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              label,
              style: TextStyle(
                color: colors.foreground,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TimeRow extends StatelessWidget {
  const _TimeRow({
    required this.icon,
    required this.tone,
    required this.label,
    required this.time,
    this.trailing,
  });

  final IconData icon;
  final AppStatusTone tone;
  final String label;
  final String time;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = AppTheme.statusColors(context, tone);
    final scheme = Theme.of(context).colorScheme;
    final extra = trailing;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ExcludeSemantics(
          child: Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: colors.background,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: colors.foreground, size: 16),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Wrap(
            spacing: 12,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(label, style: TextStyle(color: scheme.onSurfaceVariant)),
              Text(
                time,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              if (extra != null)
                Text(
                  extra,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
