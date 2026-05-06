import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../l10n/app_localizations.dart';
import '../../providers/attendance_provider.dart';
import '../../theme/app_theme.dart';

class AttendanceStatusCard extends StatelessWidget {
  const AttendanceStatusCard({
    super.key,
    required this.status,
    required this.lastEntry,
    required this.lastExit,
    required this.extraEntryCount,
    required this.extraExitCount,
    required this.onScan,
  });

  final AttendanceStatus status;
  final DateTime? lastEntry;
  final DateTime? lastExit;
  final int extraEntryCount;
  final int extraExitCount;
  final VoidCallback onScan;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final empty = l10n.homeAttendanceTimeEmpty;
    final timeFmt = DateFormat('HH:mm');

    return Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Header(status: status, title: l10n.homeAttendanceStatus),
            const SizedBox(height: 20),
            _TimeRow(
              icon: Icons.login,
              iconColor: AppTheme.success,
              label: l10n.homeAttendanceEntryRow,
              time: lastEntry != null ? timeFmt.format(lastEntry!) : empty,
              trailing: extraEntryCount > 0
                  ? l10n.homeExtraMovements(extraEntryCount)
                  : null,
            ),
            const SizedBox(height: 12),
            _TimeRow(
              icon: Icons.logout,
              iconColor: AppTheme.danger,
              label: l10n.homeAttendanceExitRow,
              time: lastExit != null ? timeFmt.format(lastExit!) : empty,
              trailing: extraExitCount > 0
                  ? l10n.homeExtraMovements(extraExitCount)
                  : null,
            ),
            const SizedBox(height: 20),
            _ActionButton(status: status, l10n: l10n, onScan: onScan),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.status, required this.title});

  final AttendanceStatus status;
  final String title;

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(status);
    final icon = _statusIcon(status);

    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: color, size: 22),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
        ),
        _StatusBadge(status: status),
      ],
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final AttendanceStatus status;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final color = _statusColor(status);
    final label = switch (status) {
      AttendanceStatus.none => l10n.homeStatusNone,
      AttendanceStatus.inside => l10n.homeStatusInside,
      AttendanceStatus.out => l10n.homeStatusOut,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w600,
              fontSize: 12,
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
    required this.iconColor,
    required this.label,
    required this.time,
    this.trailing,
  });

  final IconData icon;
  final Color iconColor;
  final String label;
  final String time;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    final isEmpty = time == '—';
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: iconColor, size: 18),
        ),
        const SizedBox(width: 12),
        SizedBox(
          width: 96,
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w500,
                  color: Colors.grey[700],
                ),
          ),
        ),
        Text(
          time,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: isEmpty ? Colors.grey[400] : null,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: 10),
          Text(
            trailing!,
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey[500],
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.status,
    required this.l10n,
    required this.onScan,
  });

  final AttendanceStatus status;
  final AppLocalizations l10n;
  final VoidCallback onScan;

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (status) {
      AttendanceStatus.none => (l10n.homeScanCheckIn, AppTheme.primaryBurgundy),
      AttendanceStatus.inside => (l10n.homeScanCheckOut, AppTheme.warning),
      AttendanceStatus.out =>
        (l10n.homeScanCheckInAgain, AppTheme.primaryBurgundy),
    };

    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton.icon(
        onPressed: onScan,
        icon: const Icon(Icons.qr_code_scanner, size: 24),
        label: Text(
          label,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }
}

Color _statusColor(AttendanceStatus status) {
  switch (status) {
    case AttendanceStatus.none:
      return AppTheme.warning;
    case AttendanceStatus.inside:
      return AppTheme.success;
    case AttendanceStatus.out:
      return AppTheme.danger;
  }
}

IconData _statusIcon(AttendanceStatus status) {
  switch (status) {
    case AttendanceStatus.none:
      return Icons.access_time;
    case AttendanceStatus.inside:
      return Icons.login;
    case AttendanceStatus.out:
      return Icons.check_circle;
  }
}
