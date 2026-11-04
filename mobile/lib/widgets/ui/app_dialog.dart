import 'package:flutter/material.dart';
import 'app_primary_button.dart';
import 'app_secondary_button.dart';

class AppDialog extends StatelessWidget {
  const AppDialog({
    super.key,
    required this.title,
    required this.body,
    this.confirmLabel,
    this.onConfirm,
    this.cancelLabel,
    this.onCancel,
    this.busy = false,
    this.destructive = false,
  });
  final String title;
  final Widget body;
  final String? confirmLabel;
  final VoidCallback? onConfirm;
  final String? cancelLabel;
  final VoidCallback? onCancel;
  final bool busy;
  final bool destructive;
  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !busy,
    child: AlertDialog(
      constraints: const BoxConstraints(maxWidth: 480),
      insetPadding: const EdgeInsets.all(20),
      scrollable: true,
      title: Semantics(header: true, child: Text(title)),
      content: body,
      actions: [
        if (cancelLabel != null)
          AppSecondaryButton(
            label: cancelLabel!,
            onPressed: busy
                ? null
                : onCancel ?? () => Navigator.maybePop(context),
          ),
        if (confirmLabel != null)
          if (destructive)
            AppSecondaryButton(
              label: confirmLabel!,
              onPressed: onConfirm,
              busy: busy,
              destructive: true,
            )
          else
            AppPrimaryButton(
              label: confirmLabel!,
              onPressed: onConfirm,
              busy: busy,
              expanded: false,
            ),
      ],
    ),
  );
}
