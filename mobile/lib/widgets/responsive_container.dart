import 'package:flutter/widgets.dart';

import '../core/spacing.dart';

/// İçeriği [maxWidth] ile sınırlayıp ortalayan responsive sarmalayıcı.
///
/// Mobile (`width < maxWidth`) akışta etkisiz; tablet/landscape gibi geniş
/// ekranlarda form ve card'ların kenarlara yapışmasını engeller.
class ResponsiveContainer extends StatelessWidget {
  const ResponsiveContainer({
    super.key,
    required this.child,
    this.maxWidth = AppSpacing.contentMaxWidth,
  });

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}
