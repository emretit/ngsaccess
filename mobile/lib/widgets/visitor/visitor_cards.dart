import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../../models/visitor.dart';
import '../../theme/app_theme.dart';
import 'visitor_labels.dart';

class VisitorStatusBadge extends StatelessWidget {
  const VisitorStatusBadge({super.key, required this.status});
  final VisitorAccessStatus status;

  @override
  Widget build(BuildContext context) {
    final tone = switch (status) {
      VisitorAccessStatus.preRegistered => AppStatusTone.warning,
      VisitorAccessStatus.active => AppStatusTone.success,
      VisitorAccessStatus.checkedOut => AppStatusTone.info,
      VisitorAccessStatus.expired => AppStatusTone.danger,
    };
    final colors = AppTheme.statusColors(context, tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(9),
      ),
      child: Text(
        visitorStatusLabel(AppLocalizations.of(context), status),
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: colors.foreground,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
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
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 10),
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: colors.outlineVariant.withValues(alpha: .5)),
      ),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      visitor.fullName,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: colors.onSurfaceVariant,
                    size: 20,
                  ),
                ],
              ),
              const SizedBox(height: 7),
              Text(
                visitorPeriod(context, visitor.visitStart, visitor.visitEnd),
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: colors.onSurfaceVariant),
              ),
              const SizedBox(height: 10),
              VisitorStatusBadge(status: visitor.status),
            ],
          ),
        ),
      ),
    );
  }
}

/// Always covers all invitation pages, independent of the current list filter.
class VisitorSummaryCard extends StatelessWidget {
  const VisitorSummaryCard({super.key, required this.summary});
  final VisitorSummary summary;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = Theme.of(context).colorScheme;
    final metrics = [
      (l10n.visitorStatTotal, summary.total),
      (
        l10n.visitorAccessActive,
        summary.counts[VisitorAccessStatus.active] ?? 0,
      ),
      (
        l10n.visitorPendingShort,
        summary.counts[VisitorAccessStatus.preRegistered] ?? 0,
      ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(
            l10n.visitorSummaryTitle,
            style: Theme.of(
              context,
            ).textTheme.labelLarge?.copyWith(color: colors.onSurfaceVariant),
          ),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: colors.outlineVariant.withValues(alpha: .5),
            ),
          ),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final stacked =
                  MediaQuery.textScalerOf(context).scale(14) > 19 ||
                  constraints.maxWidth < 280;
              final cells = [
                for (final (label, count) in metrics)
                  Semantics(
                    label: '$label: $count${summary.overflow ? '+' : ''}',
                    excludeSemantics: true,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: 10,
                        horizontal: 8,
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            '$count${summary.overflow ? '+' : ''}',
                            style: Theme.of(context).textTheme.headlineSmall
                                ?.copyWith(
                                  color: colors.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            label,
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ),
              ];
              if (stacked) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: cells,
                );
              }
              return IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final (i, cell) in cells.indexed) ...[
                      if (i > 0)
                        VerticalDivider(
                          width: 1,
                          color: colors.outlineVariant.withValues(alpha: .5),
                        ),
                      Expanded(child: cell),
                    ],
                  ],
                ),
              );
            },
          ),
        ),
        if ((summary.counts[VisitorAccessStatus.checkedOut] ?? 0) > 0 ||
            (summary.counts[VisitorAccessStatus.expired] ?? 0) > 0) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              for (final status in [
                VisitorAccessStatus.checkedOut,
                VisitorAccessStatus.expired,
              ])
                if ((summary.counts[status] ?? 0) > 0)
                  Text(
                    '${visitorStatusLabel(l10n, status)}: ${summary.counts[status]}${summary.overflow ? '+' : ''}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
            ],
          ),
        ],
        if (summary.overflow) ...[
          const SizedBox(height: 8),
          Text(
            l10n.visitorSummaryLimited,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ],
    );
  }
}
