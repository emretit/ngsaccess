import 'package:flutter/widgets.dart';

/// Uses the available content width and text size, without fixing card height.
class ResponsiveCardGrid extends StatelessWidget {
  const ResponsiveCardGrid({
    super.key,
    required this.children,
    this.minimumCardWidth = 136,
    this.spacing = 12,
    this.maximumColumns = 4,
  }) : assert(minimumCardWidth > 0),
       assert(maximumColumns > 0);

  final List<Widget> children;
  final double minimumCardWidth;
  final double spacing;
  final int maximumColumns;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final textScale = MediaQuery.textScalerOf(context).scale(16) / 16;
        final minimum = minimumCardWidth * textScale.clamp(1.0, 2.0);
        final columns = ((constraints.maxWidth + spacing) / (minimum + spacing))
            .floor()
            .clamp(1, maximumColumns);
        final width =
            (constraints.maxWidth - spacing * (columns - 1)) / columns;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            for (final child in children) SizedBox(width: width, child: child),
          ],
        );
      },
    );
  }
}
