import 'package:flutter/material.dart';

import '../../core/error_localizer.dart';
import '../../core/errors.dart';
import '../../l10n/app_localizations.dart';
import '../../models/door_operation.dart';
import '../ui/ui.dart';

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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppDataNotice(
          title: current?.deviceName,
          message: message,
          tone: tone,
          busy: isLoading,
          actionLabel: hasUnresolvedOperation
              ? l10n.homeCommandCheckStatus
              : null,
          onAction: hasUnresolvedOperation ? onCheckStatus : null,
        ),
        if (problem != null && (current != null || hasUnresolvedOperation))
          AppDataNotice(
            message: localizeAppError(context, problem),
            tone: AppStatusTone.danger,
          ),
        if (hasUnresolvedOperation && current == null && canRetrySameRequest)
          AppSecondaryButton(
            label: l10n.homeCommandRetrySameRequest,
            onPressed: isLoading ? null : onRetrySameRequest,
          ),
      ],
    );
  }
}
