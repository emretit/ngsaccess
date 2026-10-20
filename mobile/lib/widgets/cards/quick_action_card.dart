import 'package:flutter/material.dart';

/// An accessible action which grows vertically with its label and target name.
class QuickActionCard extends StatelessWidget {
  const QuickActionCard({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
    this.subtitle,
    this.isBusy = false,
    this.busyLabel,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;
  final String? subtitle;
  final bool isBusy;
  final String? busyLabel;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final enabled = onTap != null && !isBusy;
    final target = subtitle;
    final displayLabel = isBusy ? (busyLabel ?? label) : label;
    return Semantics(
      button: true,
      liveRegion: isBusy,
      enabled: enabled,
      label: [displayLabel, ?target].join(', '),
      onTap: enabled ? onTap : null,
      excludeSemantics: true,
      child: Material(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(16),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 112, minWidth: 48),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    padding: const EdgeInsets.all(13),
                    decoration: BoxDecoration(
                      color: scheme.primaryContainer,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: color, width: 2),
                    ),
                    child: isBusy
                        ? CircularProgressIndicator(
                            strokeWidth: 2,
                            color: scheme.onPrimaryContainer,
                          )
                        : Icon(
                            icon,
                            color: scheme.onPrimaryContainer,
                            size: 24,
                          ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    displayLabel,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: enabled
                          ? scheme.onSurface
                          : scheme.onSurfaceVariant,
                    ),
                  ),
                  if (target != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      target,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
