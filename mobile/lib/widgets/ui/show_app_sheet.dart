import 'dart:math' as math;
import 'package:flutter/material.dart';

Future<T?> showAppSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool isDismissible = true,
  bool enableDrag = true,
  bool useRootNavigator = true,
  RouteSettings? routeSettings,
}) async {
  final previous = FocusManager.instance.primaryFocus;
  final result = await showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    isDismissible: isDismissible,
    enableDrag: enableDrag,
    useRootNavigator: useRootNavigator,
    routeSettings: routeSettings,
    barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
    constraints: const BoxConstraints(maxWidth: 640),
    builder: (sheetContext) {
      final media = MediaQuery.of(sheetContext);
      return Padding(
        padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: math.max(
              0,
              (media.size.height -
                      media.viewInsets.bottom -
                      media.padding.top) *
                  0.9,
            ),
          ),
          child: FocusScope(autofocus: true, child: builder(sheetContext)),
        ),
      );
    },
  );
  if (previous?.context?.mounted ?? false) previous?.requestFocus();
  return result;
}
