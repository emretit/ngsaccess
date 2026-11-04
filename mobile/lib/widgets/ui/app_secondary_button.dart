import 'package:flutter/material.dart';
import 'app_ui_tokens.dart';
import 'app_primary_button.dart';

class AppSecondaryButton extends StatelessWidget {
  const AppSecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.busy = false,
    this.busyLabel,
    this.expanded = false,
    this.destructive = false,
    this.focusNode,
    this.semanticLabel,
  });
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool busy;
  final String? busyLabel;
  final bool expanded;
  final bool destructive;
  final FocusNode? focusNode;
  final String? semanticLabel;
  @override
  Widget build(BuildContext context) => AppButtonFrame(
    label: label,
    busyLabel: busyLabel,
    busy: busy,
    expanded: expanded,
    semanticLabel: semanticLabel,
    onPressed: onPressed,
    builder: (onFocus) => OutlinedButton(
      focusNode: focusNode,
      onFocusChange: onFocus,
      onPressed: busy ? null : onPressed,
      style: ButtonStyle(
        foregroundColor: destructive
            ? WidgetStateProperty.resolveWith(
                (states) => states.contains(WidgetState.disabled)
                    ? AppUiTokens.of(context).disabledForeground
                    : AppUiTokens.of(context).danger.foreground,
              )
            : null,
        animationDuration: MediaQuery.disableAnimationsOf(context)
            ? Duration.zero
            : const Duration(milliseconds: 120),
      ),
      child: AppButtonContent(
        label: label,
        busyLabel: busyLabel,
        icon: icon,
        busy: busy,
      ),
    ),
  );
}
