import 'package:flutter/material.dart';
import 'app_ui_tokens.dart';

IconData appStatusIcon(AppStatusTone tone) => switch (tone) {
  AppStatusTone.success => Icons.check,
  AppStatusTone.warning => Icons.schedule,
  AppStatusTone.danger => Icons.error_outline,
  AppStatusTone.info => Icons.info_outline,
};

class AppStatusBadge extends StatelessWidget {
  const AppStatusBadge({
    super.key,
    required this.label,
    required this.tone,
    this.icon,
    this.semanticLabel,
  });
  final String label;
  final AppStatusTone tone;
  final IconData? icon;
  final String? semanticLabel;
  @override
  Widget build(BuildContext context) {
    final t = AppUiTokens.of(context);
    final colors = t.status(tone);
    return Semantics(
      label: semanticLabel ?? label,
      child: ExcludeSemantics(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: colors.background,
            borderRadius: BorderRadius.circular(t.badgeRadius),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon ?? appStatusIcon(tone),
                size: 16,
                color: colors.foreground,
              ),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  label,
                  style: Theme.of(
                    context,
                  ).textTheme.labelMedium?.copyWith(color: colors.foreground),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
