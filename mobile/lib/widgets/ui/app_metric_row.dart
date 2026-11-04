import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../l10n/app_localizations.dart';
import 'app_ui_tokens.dart';

class AppMetric {
  const AppMetric({
    required this.label,
    required this.value,
    this.detail,
    this.semanticLabel,
  });
  final String label;
  final String value;
  final String? detail;
  final String? semanticLabel;
}

class AppMetricRow extends StatelessWidget {
  const AppMetricRow({
    super.key,
    required this.metrics,
    this.showDividers = true,
  });
  final List<AppMetric> metrics;
  final bool showDividers;
  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final valueStyle = text.headlineSmall?.copyWith(
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    double measure(String value, TextStyle? style) {
      final painter = TextPainter(
        text: TextSpan(text: value, style: style),
        textScaler: MediaQuery.textScalerOf(context),
        textDirection: Directionality.of(context),
        locale: Localizations.localeOf(context),
      )..layout();
      final width = painter.width;
      painter.dispose();
      return width;
    }

    // Equal columns must each fit the widest value or label plus their padding.
    // Optional detail text may wrap within the resulting column.
    final columnWidth = metrics.fold<double>(
      0,
      (width, m) => math.max(
        width,
        math.max(
              measure(m.value, valueStyle),
              measure(m.label, text.bodySmall),
            ) +
            16,
      ),
    );
    final dividerWidth = showDividers
        ? math.max(0, metrics.length - 1) * 32
        : 0;
    final requiredWidth = columnWidth * metrics.length + dividerWidth;
    Widget metric(AppMetric m) => Semantics(
      container: true,
      label:
          m.semanticLabel ??
          [
            m.label,
            m.value == '—'
                ? AppLocalizations.of(context).metricNoRecord
                : m.value,
            if (m.detail != null) m.detail!,
          ].join(' '),
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(m.label, style: text.bodySmall),
              Text(m.value, style: valueStyle),
              if (m.detail != null) Text(m.detail!, style: text.bodySmall),
            ],
          ),
        ),
      ),
    );
    return LayoutBuilder(
      builder: (context, c) {
        final large = isLargeText(context) || c.maxWidth < requiredWidth;
        return large
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < metrics.length; i++) ...[
                    if (i > 0 && showDividers) const Divider(),
                    metric(metrics[i]),
                  ],
                ],
              )
            : IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < metrics.length; i++) ...[
                      if (i > 0 && showDividers)
                        const VerticalDivider(width: 32),
                      Expanded(child: metric(metrics[i])),
                    ],
                  ],
                ),
              );
      },
    );
  }
}
