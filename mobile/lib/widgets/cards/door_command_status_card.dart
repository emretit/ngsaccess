import 'package:flutter/material.dart';

import '../../core/error_localizer.dart';
import '../../core/errors.dart';
import '../../l10n/app_localizations.dart';
import '../../models/door_operation.dart';
import '../../theme/app_theme.dart';

/// Device acknowledgement is deliberately described separately from passage.
class DoorCommandStatusCard extends StatelessWidget {
  const DoorCommandStatusCard({
    super.key,
    required this.operation,
    required this.hasUnresolvedOperation,
    required this.isLoading,
    required this.onCheckStatus,
    required this.onRetrySameRequest,
    this.error,
    this.canRetrySameRequest = false,
    this.isSending = false,
  });

  final DoorOperation? operation;
  final bool hasUnresolvedOperation;
  final bool isLoading;
  final VoidCallback onCheckStatus;
  final VoidCallback onRetrySameRequest;
  final AppError? error;
  final bool canRetrySameRequest;
  final bool isSending;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final current = operation;
    final problem = error;
    final (message, tone) = switch (current?.status) {
      DoorOperationStatus.pending ||
      DoorOperationStatus.sent => (l10n.homeCommandPending, AppStatusTone.info),
      DoorOperationStatus.confirmed => (
        l10n.homeCommandConfirmed,
        AppStatusTone.success,
      ),
      DoorOperationStatus.failed => (
        current?.errorCode == DoorOperationFailureCode.targetNotAllowed
            ? l10n.unlockDenied
            : l10n.homeCommandFailed,
        AppStatusTone.danger,
      ),
      DoorOperationStatus.unknown => (
        l10n.homeCommandUnknown,
        AppStatusTone.warning,
      ),
      null =>
        isLoading
            ? (
                isSending ? l10n.homeCommandSending : l10n.homeDataLoading,
                AppStatusTone.info,
              )
            : hasUnresolvedOperation
            ? (l10n.homeCommandUnknown, AppStatusTone.warning)
            : (
                problem == null
                    ? l10n.homeCommandFailed
                    : localizeAppError(context, problem),
                AppStatusTone.danger,
              ),
    };
    final colors = AppTheme.statusColors(context, tone);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (current != null) ...[
            Text(
              current.deviceName,
              style: TextStyle(
                color: colors.foreground,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
          ],
          Semantics(
            liveRegion: true,
            child: Text(message, style: TextStyle(color: colors.foreground)),
          ),
          if (problem != null &&
              (current != null || hasUnresolvedOperation)) ...[
            const SizedBox(height: 8),
            Text(
              localizeAppError(context, problem),
              style: TextStyle(color: colors.foreground),
            ),
          ],
          if (isLoading) ...[
            const SizedBox(height: 12),
            LinearProgressIndicator(
              semanticsLabel: message,
              color: colors.foreground,
              backgroundColor: colors.background,
            ),
          ],
          if (hasUnresolvedOperation)
            TextButton.icon(
              onPressed: isLoading ? null : onCheckStatus,
              icon: const Icon(Icons.refresh),
              label: Text(l10n.homeCommandCheckStatus),
              style: TextButton.styleFrom(foregroundColor: colors.foreground),
            ),
          if (hasUnresolvedOperation && current == null && canRetrySameRequest)
            TextButton(
              onPressed: isLoading ? null : onRetrySameRequest,
              style: TextButton.styleFrom(foregroundColor: colors.foreground),
              child: Text(l10n.homeCommandRetrySameRequest),
            ),
        ],
      ),
    );
  }
}
