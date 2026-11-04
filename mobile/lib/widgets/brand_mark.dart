import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Compact white mark for the burgundy brand band.
class BrandMark extends StatelessWidget {
  const BrandMark.band({super.key, this.size = 32});

  final double size;

  @override
  Widget build(BuildContext context) => SvgPicture.asset(
    'assets/branding/ngsplus-mark-small-white.svg',
    width: size,
    height: size,
    excludeFromSemantics: true,
  );
}
