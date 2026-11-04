import 'dart:async';

import 'package:flutter/material.dart';

import '../core/error_localizer.dart';
import '../core/errors.dart';
import '../l10n/app_localizations.dart';
import '../models/door_operation.dart';
import '../providers/auth_provider.dart';
import '../providers/door_operation_provider.dart';
import 'ui/ui.dart';

/// Recovery is explicit and scoped to the session that opened the dialog.
/// Opening or checking this dialog never sends a door command.
class DoorOperationRecoveryDialog extends StatefulWidget {
  const DoorOperationRecoveryDialog({
    super.key,
    required this.commands,
    required this.auth,
  });

  final DoorOperationProvider commands;
  final AuthProvider auth;

  @override
  State<DoorOperationRecoveryDialog> createState() =>
      _DoorOperationRecoveryDialogState();
}

class _DoorOperationRecoveryDialogState
    extends State<DoorOperationRecoveryDialog> {
  late final int _epoch;
  late final String? _token;
  bool _checking = true;
  bool _reconciled = false;
  String? _requestId;

  bool get _ownsSession =>
      widget.auth.isAuthenticated &&
      widget.auth.sessionEpoch == _epoch &&
      widget.auth.sessionToken == _token;

  @override
  void initState() {
    super.initState();
    _epoch = widget.auth.sessionEpoch;
    _token = widget.auth.sessionToken;
    _requestId = widget.commands.requestId;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(_checkStatus());
    });
  }

  Future<void> _checkStatus() async {
    if (!_ownsSession) return;
    setState(() => _checking = true);
    try {
      await widget.commands.checkStatus();
    } finally {
      if (mounted && _ownsSession) {
        setState(() {
          // A failed local-store read may recover the original request here.
          _requestId ??= widget.commands.requestId;
          _checking = false;
          _reconciled = true;
        });
      }
    }
  }

  Future<void> _retry() async {
    final commands = widget.commands;
    if (!_ownsSession ||
        _checking ||
        !_reconciled ||
        _requestId == null ||
        commands.requestId != _requestId ||
        commands.operation != null ||
        !commands.canRetrySameRequest) {
      return;
    }
    // The provider queries once more, then may send only the persisted request
    // and original target. It also guards logout and concurrent commands.
    await commands.retrySameRequest();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([widget.commands, widget.auth]),
      builder: (context, _) {
        final l10n = AppLocalizations.of(context);
        final commands = widget.commands;
        final owns = _ownsSession;
        final operation = owns ? commands.operation : null;
        final problem = owns ? commands.error : null;
        final busy = _checking || commands.isLoading;
        final message = !owns
            ? l10n.errorAuthExpired
            : switch (operation?.status) {
                DoorOperationStatus.pending ||
                DoorOperationStatus.sent => l10n.homeCommandPending,
                DoorOperationStatus.confirmed => l10n.homeCommandConfirmed,
                DoorOperationStatus.failed =>
                  operation?.errorCode ==
                          DoorOperationFailureCode.targetNotAllowed
                      ? l10n.unlockDenied
                      : l10n.homeCommandFailed,
                DoorOperationStatus.unknown || null => l10n.homeCommandUnknown,
              };
        final hasRequest =
            operation != null || (owns && commands.hasUnresolvedOperation);
        final unresolvedError =
            problem is BusinessError && problem.code == 'OPERATION_UNRESOLVED';
        final canRetry =
            owns &&
            operation == null &&
            commands.hasUnresolvedOperation &&
            commands.canRetrySameRequest;
        final tone = switch (operation?.status) {
          DoorOperationStatus.confirmed => AppStatusTone.success,
          DoorOperationStatus.failed => AppStatusTone.danger,
          DoorOperationStatus.pending ||
          DoorOperationStatus.sent => AppStatusTone.info,
          _ => AppStatusTone.warning,
        };
        return AppDialog(
          title: l10n.doorOperationRecoveryTitle,
          body: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (operation != null) ...[
                Text(
                  operation.deviceName,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                Text(
                  AppDateFormat(
                    locale: Localizations.localeOf(context),
                    now: DateTime.now(),
                  ).relativeDateTime(operation.requestedAt),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 16),
              ],
              AppDataNotice(
                message: hasRequest || !owns
                    ? message
                    : l10n.doorOperationNothingToCheck,
                tone: !owns
                    ? AppStatusTone.danger
                    : hasRequest
                    ? tone
                    : AppStatusTone.info,
                busy: owns && busy,
              ),
              if (problem != null && !unresolvedError) ...[
                const SizedBox(height: 12),
                AppDataNotice(
                  message: localizeAppError(context, problem),
                  tone: AppStatusTone.danger,
                ),
              ],
              if (owns && commands.hasUnresolvedOperation) ...[
                const SizedBox(height: 16),
                AppSecondaryButton(
                  label: l10n.homeCommandCheckStatus,
                  semanticLabel: operation == null
                      ? l10n.homeCommandCheckStatus
                      : '${operation.deviceName}: ${l10n.homeCommandCheckStatus}',
                  icon: Icons.refresh,
                  busy: busy,
                  onPressed: busy ? null : () => unawaited(_checkStatus()),
                ),
              ],
              if (hasRequest) ...[
                const SizedBox(height: 16),
                Text(
                  l10n.doorOperationRecoveryHint,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ],
          ),
          confirmLabel: canRetry ? l10n.homeCommandRetrySameRequest : null,
          onConfirm: canRetry
              ? (busy || !_reconciled ? null : () => unawaited(_retry()))
              : null,
          cancelLabel: l10n.commonClose,
          onCancel: () => Navigator.of(context).pop(),
        );
      },
    );
  }
}
