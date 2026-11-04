import 'package:flutter/material.dart';
import 'app_ui_tokens.dart';

/// One full-row target with the checkbox aligned to the form field edge.
class AppCheckboxRow extends StatelessWidget {
  const AppCheckboxRow({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.errorText,
    this.focusNode,
  });

  final String label;
  final bool value;
  final ValueChanged<bool?>? onChanged;
  final String? errorText;
  final FocusNode? focusNode;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final enabled = onChanged != null;
    final error = errorText;
    return Semantics(
      container: true,
      checked: value,
      enabled: enabled,
      label: [label, ?error].join(', '),
      liveRegion: error != null,
      onTap: enabled ? () => onChanged?.call(!value) : null,
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InkWell(
              focusNode: focusNode,
              onTap: enabled ? () => onChanged?.call(!value) : null,
              borderRadius: BorderRadius.circular(4),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 48),
                child: Row(
                  children: [
                    SizedBox(
                      width: 18,
                      height: 18,
                      child: ExcludeFocus(
                        child: IgnorePointer(
                          child: Checkbox(
                            value: value,
                            onChanged: onChanged,
                            materialTapTargetSize:
                                MaterialTapTargetSize.shrinkWrap,
                            visualDensity: VisualDensity.compact,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        label,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: enabled
                              ? theme.colorScheme.onSurface
                              : AppUiTokens.of(context).disabledForeground,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (error != null)
              Text(
                error,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.error,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
