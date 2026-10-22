import 'dart:async';

import 'package:flutter/material.dart';

import '../core/error_localizer.dart';
import '../core/errors.dart';
import '../l10n/app_localizations.dart';
import '../models/door_operation.dart';
import '../providers/auth_provider.dart';
import '../providers/door_operation_provider.dart';

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
        final unresolvedError =
            problem is BusinessError && problem.code == 'OPERATION_UNRESOLVED';
        return AlertDialog(
          title: Text(l10n.doorOperationRecoveryTitle),
          scrollable: true,
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l10n.doorOperationRecoveryHint),
              if (operation != null) ...[
                const SizedBox(height: 16),
                Text(operation.deviceName),
              ],
              const SizedBox(height: 16),
              Semantics(liveRegion: true, child: Text(message)),
              if (problem != null && !unresolvedError) ...[
                const SizedBox(height: 12),
                Semantics(
                  liveRegion: true,
                  child: Text(localizeAppError(context, problem)),
                ),
              ],
              if (owns && busy) ...[
                const SizedBox(height: 16),
                LinearProgressIndicator(semanticsLabel: l10n.homeDataLoading),
              ],
            ],
          ),
          actions: [
            if (owns && commands.hasUnresolvedOperation)
              TextButton(
                onPressed: busy ? null : () => unawaited(_checkStatus()),
                child: Text(l10n.homeCommandCheckStatus),
              ),
            if (owns &&
                operation == null &&
                commands.hasUnresolvedOperation &&
                commands.canRetrySameRequest)
              TextButton(
                onPressed: busy || !_reconciled
                    ? null
                    : () => unawaited(_retry()),
                child: Text(l10n.homeCommandRetrySameRequest),
              ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(l10n.commonClose),
            ),
          ],
        );
      },
    );
  }
}
