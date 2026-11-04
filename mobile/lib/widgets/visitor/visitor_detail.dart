import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/error_localizer.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/visitor_provider.dart';
import '../../models/visitor.dart';
import '../ui/ui.dart';
import '../../screens/visitor/visitor_form_screen.dart';
import 'visitor_cards.dart';
import 'visitor_labels.dart';

class VisitorDetail extends StatefulWidget {
  const VisitorDetail({super.key, required this.visitorId});
  final String visitorId;

  @override
  State<VisitorDetail> createState() => _VisitorDetailState();
}

class _VisitorDetailState extends State<VisitorDetail> {
  VisitorProvider? _provider;
  int? _lease;
  bool _confirming = false, _closingAfterCancel = false;
  Visitor? _cancelSnapshot;
  int? _cancelEpoch;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final provider = context.read<VisitorProvider>();
    if (identical(provider, _provider)) return;
    _release();
    _provider = provider;
    _lease = provider.retainDetail(widget.visitorId);
  }

  @override
  void didUpdateWidget(VisitorDetail oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.visitorId == widget.visitorId) return;
    _release();
    _lease = _provider?.retainDetail(widget.visitorId);
  }

  void _release() {
    final lease = _lease;
    if (lease != null) _provider?.releaseDetail(lease);
    _lease = null;
  }

  @override
  void dispose() {
    _release();
    super.dispose();
  }

  Future<void> _cancel(VisitorProvider state, Visitor visitor) async {
    if (_confirming || _closingAfterCancel || state.busy) return;
    setState(() => _confirming = true);
    final l10n = AppLocalizations.of(context);
    try {
      var decided = false;
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AppDialog(
          title: l10n.visitorCancelInvitation,
          body: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(visitor.fullName),
              const SizedBox(height: 8),
              Text(
                visitorPeriod(context, visitor.visitStart, visitor.visitEnd),
              ),
              const SizedBox(height: 12),
              Text(l10n.visitorCancelConfirm),
            ],
          ),
          cancelLabel: l10n.requestsCancel,
          onCancel: () {
            if (decided) return;
            decided = true;
            Navigator.of(dialogContext).pop(false);
          },
          confirmLabel: l10n.visitorCancelInvitation,
          destructive: true,
          onConfirm: () {
            if (decided) return;
            decided = true;
            Navigator.of(dialogContext).pop(true);
          },
        ),
      );
      if (!mounted || confirmed != true) return;
      setState(() {
        _cancelSnapshot = visitor;
        _cancelEpoch = state.sessionEpoch;
      });
      final result = await state.cancel(visitor.id);
      if (!mounted || result == null) return;
      if (result) {
        _closingAfterCancel = true;
        final messenger = ScaffoldMessenger.of(context);
        Navigator.of(context).pop();
        messenger.showSnackBar(SnackBar(content: Text(l10n.visitorCancelled)));
      } else {
        await showDialog<void>(
          context: context,
          builder: (dialogContext) => AppDialog(
            title: l10n.visitorCancelInvitation,
            body: Text(l10n.visitorOperatorRequired),
            confirmLabel: l10n.commonClose,
            onConfirm: () => Navigator.of(dialogContext).pop(),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _confirming = false;
          if (!_closingAfterCancel) _cancelSnapshot = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final visitorId = widget.visitorId;
    final l10n = AppLocalizations.of(context);
    return Consumer<VisitorProvider>(
      builder: (context, state, _) {
        final selected = state.selected?.id == visitorId
            ? state.selected
            : null;
        final visitor =
            selected ??
            ((_confirming || _closingAfterCancel) &&
                    state.detailError == null &&
                    state.sessionEpoch == _cancelEpoch
                ? _cancelSnapshot
                : null);
        final actions = visitor == null ? null : _actions(state, visitor);
        final scrollActions = isLargeText(context);
        return AppSheet(
          title: visitor?.fullName ?? l10n.visitorTitle,
          busy: state.busy,
          body: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (state.detailLoading)
                AppSkeleton(semanticLabel: l10n.homeDataLoading, itemCount: 1),
              if (state.detailError case final error?) ...[
                AppDataNotice(
                  message: localizeAppError(context, error),
                  tone: AppStatusTone.warning,
                  actionLabel: l10n.commonRetry,
                  onAction: () => state.openDetail(visitorId),
                ),
                const SizedBox(height: 16),
              ],
              if (visitor == null &&
                  !state.detailLoading &&
                  state.detailError == null &&
                  !state.busy &&
                  !_confirming &&
                  !_closingAfterCancel)
                AppEmptyState(title: l10n.visitorNotFound, message: ''),
              if (visitor != null) ...[
                MergeSemantics(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      VisitorStatusBadge(status: visitor.status),
                      const SizedBox(height: 8),
                      Text(visitorPresenceLabel(l10n, visitor.presence)),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                for (final (label, value) in [
                  (l10n.visitorStart, visitorDate(context, visitor.visitStart)),
                  (l10n.visitorEnd, visitorDate(context, visitor.visitEnd)),
                  (l10n.visitorPhone, visitor.phone ?? '—'),
                ]) ...[
                  AppListRow(title: label, trailing: Text(value)),
                  const Divider(height: 1),
                ],
                AppListRow(
                  title: l10n.visitorFieldPurpose,
                  subtitle: visitor.purpose ?? '—',
                ),
                const Divider(height: 1),
                AppListRow(
                  title: l10n.visitorNotes,
                  subtitle: visitor.notes ?? '—',
                ),
                const SizedBox(height: 24),
                Semantics(
                  header: true,
                  child: Text(
                    l10n.visitorSyncTitle,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  visitorSyncLabel(l10n, visitor.syncStatus),
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                if (visitor.noticeUrl != null) ...[
                  const SizedBox(height: 24),
                  Text(l10n.visitorNotice),
                  SelectableText(
                    '${visitor.noticeUrl}\n${visitor.noticeVersion ?? ''}',
                  ),
                ],
                if (state.mutationError case final error?) ...[
                  const SizedBox(height: 16),
                  AppDataNotice(
                    message: localizeAppError(context, error),
                    tone: AppStatusTone.danger,
                  ),
                ],
              ],
              if (scrollActions && actions != null) actions,
            ],
          ),
          actionBar: scrollActions ? null : actions,
        );
      },
    );
  }

  Widget _actions(VisitorProvider state, Visitor visitor) {
    final l10n = AppLocalizations.of(context);
    final locked = state.busy || _confirming || _closingAfterCancel;
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (visitor.canEdit) ...[
              AppSecondaryButton(
                label: l10n.visitorEdit,
                expanded: true,
                onPressed: locked
                    ? null
                    : () {
                        final navigator = Navigator.of(context);
                        navigator.pop();
                        navigator.push(
                          MaterialPageRoute<void>(
                            builder: (_) =>
                                ChangeNotifierProvider<VisitorProvider>.value(
                                  value: state,
                                  child: VisitorFormScreen(visitor: visitor),
                                ),
                          ),
                        );
                      },
              ),
              const SizedBox(height: 8),
            ],
            AppSecondaryButton(
              label: l10n.visitorCancelInvitation,
              expanded: true,
              destructive: true,
              onPressed: locked ? null : () => _cancel(state, visitor),
            ),
          ],
        ),
      ),
    );
  }
}
