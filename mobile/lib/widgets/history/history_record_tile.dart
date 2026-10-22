import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/attendance_date.dart';
import '../../l10n/app_localizations.dart';
import '../../models/attendance.dart';

enum HistoryAccessState { granted, denied, unknown }

class HistoryRecordTile extends StatelessWidget {
  const HistoryRecordTile({
    super.key,
    required this.record,
    required this.accessState,
    required this.onTap,
  });

  final Attendance record;
  final HistoryAccessState accessState;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = Theme.of(context).colorScheme;
    final direction = switch (record.direction) {
      'entry' => l10n.historyEntryShort,
      'exit' => l10n.historyExitShort,
      _ => l10n.historyUnknownDirection,
    };
    final access = switch (accessState) {
      HistoryAccessState.granted => null,
      HistoryAccessState.denied => l10n.accessDenied,
      HistoryAccessState.unknown => l10n.historyUnknownAccess,
    };
    final icon = switch ((accessState, record.direction)) {
      (HistoryAccessState.denied, _) => Icons.block_rounded,
      (HistoryAccessState.unknown, _) => Icons.help_outline_rounded,
      (_, 'entry') => Icons.login_rounded,
      (_, 'exit') => Icons.logout_rounded,
      _ => Icons.swap_horiz_rounded,
    };
    final device = record.deviceInfo?['name'];
    final deviceName = device is String && device.trim().isNotEmpty
        ? device
        : l10n.historyUnknownDevice;
    final timestamp = DateFormat.yMd(
      Localizations.localeOf(context).toLanguageTag(),
    ).add_Hm().format(AttendanceDate.businessTime(record.timestamp));
    final status = access == null ? direction : '$access · $direction';

    final scale = MediaQuery.textScalerOf(context).scale(14) / 14;
    final tone = accessState == HistoryAccessState.denied
        ? colors.error
        : accessState == HistoryAccessState.unknown
        ? colors.onSurfaceVariant
        : colors.primary;
    final time = DateFormat.Hm(
      Localizations.localeOf(context).toLanguageTag(),
    ).format(AttendanceDate.businessTime(record.timestamp));
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: colors.outlineVariant.withValues(alpha: .45)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Semantics(
        button: true,
        label: '$deviceName, $timestamp, $status',
        onTap: onTap,
        excludeSemantics: true,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: tone.withValues(alpha: .08),
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Icon(icon, color: tone, size: 18),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        status,
                        style: TextStyle(
                          color: accessState == HistoryAccessState.denied
                              ? colors.error
                              : colors.onSurface,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        deviceName,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colors.onSurfaceVariant,
                        ),
                      ),
                      if (scale > 1.3) ...[
                        const SizedBox(height: 4),
                        Text(
                          time,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ],
                    ],
                  ),
                ),
                if (scale <= 1.3) ...[
                  const SizedBox(width: 8),
                  Text(
                    time,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
                const SizedBox(width: 4),
                Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: colors.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
