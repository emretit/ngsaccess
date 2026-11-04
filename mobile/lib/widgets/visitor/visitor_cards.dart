import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../../models/visitor.dart';
import '../ui/ui.dart';
import 'visitor_labels.dart';

class VisitorStatusBadge extends StatelessWidget {
  const VisitorStatusBadge({super.key, required this.status});
  final VisitorAccessStatus status;

  @override
  Widget build(BuildContext context) => AppStatusBadge(
    label: visitorStatusLabel(AppLocalizations.of(context), status),
    tone: visitorStatusTone(status),
  );
}

class VisitorRecordCard extends StatelessWidget {
  const VisitorRecordCard({
    super.key,
    required this.visitor,
    required this.onTap,
  });
  final Visitor visitor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => AppListRow(
    title: visitor.fullName,
    subtitle: visitorPeriod(context, visitor.visitStart, visitor.visitEnd),
    supporting: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        VisitorStatusBadge(status: visitor.status),
        if (visitor.presence != VisitorPresence.unknown) ...[
          const SizedBox(height: 8),
          Text(
            visitorPresenceLabel(
              AppLocalizations.of(context),
              visitor.presence,
            ),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ],
    ),
    showChevron: true,
    onTap: onTap,
  );
}

/// Always covers all invitation pages, independent of the current list filter.
class VisitorSummaryCard extends StatelessWidget {
  const VisitorSummaryCard({super.key, required this.summary});
  final VisitorSummary summary;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(
            l10n.visitorSummaryTitle,
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
        const SizedBox(height: 12),
        AppMetricRow(
          metrics: [
            for (final (label, count) in [
              (l10n.visitorStatTotal, summary.total),
              (
                l10n.visitorAccessActive,
                summary.counts[VisitorAccessStatus.active] ?? 0,
              ),
              (
                l10n.visitorMetricPending,
                summary.counts[VisitorAccessStatus.preRegistered] ?? 0,
              ),
            ])
              AppMetric(
                label: label,
                value: '$count${summary.overflow ? '+' : ''}',
              ),
          ],
        ),
        for (final status in [
          VisitorAccessStatus.checkedOut,
          VisitorAccessStatus.expired,
        ])
          if ((summary.counts[status] ?? 0) > 0)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                '${visitorStatusLabel(l10n, status)}: ${summary.counts[status]}${summary.overflow ? '+' : ''}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
        if (summary.overflow)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              l10n.visitorSummaryLimited,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
      ],
    );
  }
}
