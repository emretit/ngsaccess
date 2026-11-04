import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/attendance_date.dart';
import '../../l10n/app_localizations.dart';
import '../../models/attendance.dart';
import '../ui/ui.dart';

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

    final time = DateFormat.Hm(
      Localizations.localeOf(context).toLanguageTag(),
    ).format(AttendanceDate.businessTime(record.timestamp));
    return AppListRow(
      leadingText: time,
      leadingIcon: icon,
      title: status,
      subtitle: deviceName,
      tone: accessState == HistoryAccessState.denied
          ? AppStatusTone.danger
          : null,
      semanticLabel: '$deviceName, $timestamp, $status',
      showChevron: true,
      onTap: onTap,
    );
  }
}
