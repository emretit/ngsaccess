import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'app_ui_tokens.dart';
import 'app_primary_button.dart';
import 'app_secondary_button.dart';

class AppFormActionBar extends StatelessWidget {
  const AppFormActionBar({
    super.key,
    required this.primaryAction,
    this.secondaryAction,
    this.supportingText,
  });
  final Widget primaryAction;
  final Widget? secondaryAction;
  final String? supportingText;
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surface,
      border: Border(
        top: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
      ),
    ),
    child: SafeArea(
      top: false,
      bottom: MediaQuery.viewInsetsOf(context).bottom == 0,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (supportingText != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  supportingText!,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            LayoutBuilder(
              builder: (context, constraints) {
                final primaryWidth = _actionWidth(context, primaryAction);
                final secondaryWidth = secondaryAction == null
                    ? null
                    : _actionWidth(context, secondaryAction!);
                final stacked =
                    isLargeText(context) ||
                    primaryWidth == null ||
                    secondaryWidth == null ||
                    primaryWidth + secondaryWidth + 12 > constraints.maxWidth;
                return secondaryAction == null
                    ? primaryAction
                    : stacked
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          secondaryAction!,
                          const SizedBox(height: 8),
                          primaryAction,
                        ],
                      )
                    : Row(
                        children: [
                          SizedBox(
                            width: secondaryWidth,
                            child: secondaryAction!,
                          ),
                          const SizedBox(width: 12),
                          Expanded(child: primaryAction),
                        ],
                      );
              },
            ),
          ],
        ),
      ),
    ),
  );
  double? _actionWidth(BuildContext context, Widget action) {
    final (String label, String? busyLabel, IconData? icon) data;
    if (action is AppPrimaryButton) {
      data = (action.label, action.busyLabel, action.icon);
    } else if (action is AppSecondaryButton) {
      data = (action.label, action.busyLabel, action.icon);
    } else {
      // Unknown action widgets retain the public API and safely stack.
      return null;
    }
    double measure(String label) {
      final painter = TextPainter(
        text: TextSpan(
          text: label,
          style: Theme.of(context).textTheme.labelLarge,
        ),
        textScaler: MediaQuery.textScalerOf(context),
        textDirection: Directionality.of(context),
      )..layout();
      final width = painter.width;
      painter.dispose();
      return width;
    }

    return math.max(
      48,
      math.max(
            measure(data.$1) + (data.$3 == null ? 0 : 36),
            measure(data.$2 ?? data.$1) + 28,
          ) +
          32,
    );
  }
}
