import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../responsive_card_grid.dart';

class ProgressHeroSegment {
  const ProgressHeroSegment({required this.value, required this.color});

  final int value;
  final Color color;
}

class ProgressHeroChip {
  const ProgressHeroChip({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final int value;
  final String label;
  final Color color;
}

class ProgressHeroCard extends StatelessWidget {
  const ProgressHeroCard({
    super.key,
    this.title,
    required this.summary,
    required this.totalUnits,
    required this.segments,
    required this.chips,
  });

  final String? title;
  final String summary;
  final int totalUnits;
  final List<ProgressHeroSegment> segments;
  final List<ProgressHeroChip> chips;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final filled = segments.fold<int>(
      0,
      (sum, s) => sum + math.max(0, s.value),
    );
    final ratio = totalUnits > 0 ? (filled / totalUnits).clamp(0.0, 1.0) : 0.0;
    final percent = NumberFormat.percentPattern(
      Localizations.localeOf(context).toLanguageTag(),
    ).format(ratio);
    final heading = title;

    return Card(
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 12,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  summary,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  percent,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: scheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            if (heading != null) ...[
              const SizedBox(height: 4),
              Text(
                heading,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
              ),
            ],
            const SizedBox(height: 16),
            _SegmentedBar(
              segments: segments,
              totalUnits: totalUnits,
              trackColor: scheme.surfaceContainerHighest,
              semanticsValue: percent,
            ),
            const SizedBox(height: 16),
            ResponsiveCardGrid(
              maximumColumns: 3,
              minimumCardWidth: 140,
              children: [
                for (final chip in chips)
                  _MetricChip(
                    data: chip,
                    background: scheme.surfaceContainerHighest,
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SegmentedBar extends StatelessWidget {
  const _SegmentedBar({
    required this.segments,
    required this.totalUnits,
    required this.trackColor,
    required this.semanticsValue,
  });

  final List<ProgressHeroSegment> segments;
  final int totalUnits;
  final Color trackColor;
  final String semanticsValue;

  @override
  Widget build(BuildContext context) {
    final positive = segments.where((segment) => segment.value > 0).toList();
    final sum = positive.fold<int>(
      0,
      (value, segment) => value + segment.value,
    );
    final denominator = math.max(totalUnits, sum);
    return Semantics(
      value: semanticsValue,
      child: ExcludeSemantics(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: SizedBox(
            height: 12,
            child: ColoredBox(
              color: trackColor,
              child: totalUnits <= 0 || sum == 0
                  ? const SizedBox.expand()
                  : Row(
                      children: [
                        for (final segment in positive)
                          Expanded(
                            flex: segment.value,
                            child: ColoredBox(
                              color: segment.color,
                              child: const SizedBox.expand(),
                            ),
                          ),
                        if (denominator > sum)
                          Expanded(
                            flex: denominator - sum,
                            child: const SizedBox.expand(),
                          ),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip({required this.data, required this.background});

  final ProgressHeroChip data;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
      decoration: BoxDecoration(
        color: background,
        border: Border.all(color: data.color.withValues(alpha: 0.5)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Icon(
                data.icon,
                size: 16,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              const SizedBox(width: 6),
              Text(
                data.value.toString(),
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            data.label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
