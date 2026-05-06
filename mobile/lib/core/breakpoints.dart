import 'package:flutter/widgets.dart';

/// Ekran genişlik eşikleri ve responsive yardımcılar.
///
/// `<600` mobile, `600-1024` tablet, `>=1024` desktop. Bu sınıflandırma
/// Material 3 önerilen `compact / medium / expanded` window class'ına yakın.
class AppBreakpoints {
  AppBreakpoints._();

  static const double mobile = 600;
  static const double tablet = 1024;

  static double widthOf(BuildContext context) =>
      MediaQuery.of(context).size.width;

  static bool isMobile(BuildContext context) => widthOf(context) < mobile;

  static bool isTablet(BuildContext context) {
    final w = widthOf(context);
    return w >= mobile && w < tablet;
  }

  static bool isDesktop(BuildContext context) => widthOf(context) >= tablet;
}
