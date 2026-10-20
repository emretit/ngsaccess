import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/error_localizer.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/visitor_provider.dart';
import '../../screens/visitor/visitor_form_screen.dart';
import 'visitor_labels.dart';

class VisitorDetail extends StatelessWidget {
  const VisitorDetail({super.key, required this.visitorId});
  final String visitorId;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Consumer<VisitorProvider>(
      builder: (context, state, _) {
        final visitor = state.selected?.id == visitorId ? state.selected : null;
        return ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * .9,
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: Alignment.centerRight,
                  child: IconButton(
                    tooltip: l10n.commonClose,
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close),
                  ),
                ),
                if (state.detailLoading) const LinearProgressIndicator(),
                if (state.detailError case final error?) ...[
                  Text(localizeAppError(context, error)),
                  TextButton(
                    onPressed: () => state.openDetail(visitorId),
                    child: Text(l10n.commonRetry),
                  ),
                ],
                if (visitor != null) ...[
                  Text(
                    visitor.fullName,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 12),
                  Text(visitorStatusLabel(l10n, visitor.status)),
                  Text(visitorPresenceLabel(l10n, visitor.presence)),
                  const SizedBox(height: 8),
                  Text(
                    l10n.visitorSyncTitle,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  Text(visitorSyncLabel(l10n, visitor.syncStatus)),
                  const Divider(),
                  Text(
                    '${l10n.visitorStart}: ${visitorDate(context, visitor.visitStart)}',
                  ),
                  Text(
                    '${l10n.visitorEnd}: ${visitorDate(context, visitor.visitEnd)}',
                  ),
                  Text('${l10n.visitorPhone}: ${visitor.phone ?? ''}'),
                  Text('${l10n.visitorFieldPurpose}: ${visitor.purpose ?? ''}'),
                  if (visitor.notes case final notes?)
                    Text('${l10n.visitorNotes}: $notes'),
                  if (visitor.noticeUrl != null) ...[
                    const Divider(),
                    Text(l10n.visitorNotice),
                    SelectableText(
                      '${visitor.noticeUrl}\n${visitor.noticeVersion ?? ''}',
                    ),
                  ],
                  if (state.mutationError case final error?)
                    Text(localizeAppError(context, error)),
                  const SizedBox(height: 16),
                  if (visitor.canEdit)
                    OutlinedButton(
                      onPressed: state.busy
                          ? null
                          : () async {
                              Navigator.of(context).pop();
                              Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) =>
                                      VisitorFormScreen(visitor: visitor),
                                ),
                              );
                            },
                      child: Text(l10n.visitorEdit),
                    ),
                  TextButton(
                    onPressed: state.busy
                        ? null
                        : () async {
                            final confirmed = await showDialog<bool>(
                              context: context,
                              builder: (dialogContext) => AlertDialog(
                                title: Text(l10n.visitorCancelConfirm),
                                actions: [
                                  TextButton(
                                    onPressed: () =>
                                        Navigator.of(dialogContext).pop(false),
                                    child: Text(l10n.commonCancel),
                                  ),
                                  FilledButton(
                                    onPressed: () =>
                                        Navigator.of(dialogContext).pop(true),
                                    child: Text(l10n.visitorCancelInvitation),
                                  ),
                                ],
                              ),
                            );
                            if (!context.mounted || confirmed != true) return;
                            final result = await state.cancel(visitorId);
                            if (!context.mounted || result == null) return;
                            if (result) {
                              final messenger = ScaffoldMessenger.of(context);
                              Navigator.of(context).pop();
                              messenger.showSnackBar(
                                SnackBar(content: Text(l10n.visitorCancelled)),
                              );
                            } else {
                              await showDialog<void>(
                                context: context,
                                builder: (dialogContext) => AlertDialog(
                                  content: Text(l10n.visitorOperatorRequired),
                                  actions: [
                                    TextButton(
                                      onPressed: () =>
                                          Navigator.of(dialogContext).pop(),
                                      child: Text(l10n.commonClose),
                                    ),
                                  ],
                                ),
                              );
                            }
                          },
                    child: Text(l10n.visitorCancelInvitation),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
