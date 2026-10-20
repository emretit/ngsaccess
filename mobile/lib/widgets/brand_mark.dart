import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// NGS Plus mark, variant chosen per brand/ngsplus-polish-v1 rules: the
/// thicker-ring "small" drawing below 64 px, the white version on dark fills.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, required this.size, this.onDark});

  final double size;

  /// Surface is dark or burgundy; null follows the theme brightness.
  final bool? onDark;

  @override
  Widget build(BuildContext context) {
    final dark = onDark ?? Theme.of(context).brightness == Brightness.dark;
    final drawing = size < 64 ? 'mark-small' : 'mark';
    return SvgPicture.asset(
      'assets/branding/ngsplus-$drawing-${dark ? 'white' : 'brand'}.svg',
      width: size,
      height: size,
      excludeFromSemantics: true,
    );
  }
}
