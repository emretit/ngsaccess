import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

class ProgressHeroSegment {
  const ProgressHeroSegment({
    required this.value,
    required this.color,
  });

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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final trackColor = isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey[200]!;
    final chipBackground =
        isDark ? AppTheme.surfaceVariantDark : AppTheme.surfaceVariantLight;

    final filled = segments.fold<int>(0, (sum, s) => sum + s.value);
    final percent = totalUnits > 0 ? (filled / totalUnits) * 100 : 0;

    return Card(
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Text(
                    summary,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
                Text(
                  '${percent.toStringAsFixed(percent >= 10 ? 0 : 1)}%',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: AppTheme.primaryBurgundy,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ),
            if (title != null) ...[
              const SizedBox(height: 4),
              Text(
                title!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.grey[isDark ? 400 : 600],
                    ),
              ),
            ],
            const SizedBox(height: 16),
            _SegmentedBar(
              segments: segments,
              totalUnits: totalUnits,
              trackColor: trackColor,
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                for (var i = 0; i < chips.length; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(
                    child: _MetricChip(
                      data: chips[i],
                      background: chipBackground,
                    ),
                  ),
                ],
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
  });

  final List<ProgressHeroSegment> segments;
  final int totalUnits;
  final Color trackColor;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: SizedBox(
        height: 12,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final width = constraints.maxWidth;
            return Stack(
              children: [
                Container(width: width, color: trackColor),
                if (totalUnits > 0)
                  Row(
                    children: [
                      for (final seg in segments)
                        if (seg.value > 0)
                          SizedBox(
                            width: width * (seg.value / totalUnits),
                            child: Container(color: seg.color),
                          ),
                    ],
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip({
    required this.data,
    required this.background,
  });

  final ProgressHeroChip data;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(data.icon, size: 16, color: data.color),
              const SizedBox(width: 6),
              Text(
                data.value.toString(),
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: data.color,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            data.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.grey[600],
                  fontWeight: FontWeight.w500,
                ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
