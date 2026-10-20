import 'package:flutter/widgets.dart';

/// Retained branches keep their state while their resources follow selection.
/// Offstage/TickerMode alone cannot stop a camera or polling.
class BranchVisibility extends InheritedWidget {
  const BranchVisibility({
    super.key,
    required this.activeIndex,
    required super.child,
  });

  final int activeIndex;

  static bool isActive(BuildContext context, int index) =>
      context
          .dependOnInheritedWidgetOfExactType<BranchVisibility>()
          ?.activeIndex ==
      index;

  @override
  bool updateShouldNotify(BranchVisibility oldWidget) =>
      activeIndex != oldWidget.activeIndex;
}
