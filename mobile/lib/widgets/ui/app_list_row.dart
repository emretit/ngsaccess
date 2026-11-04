import 'package:flutter/material.dart';
import 'app_ui_tokens.dart';

class AppListRow extends StatelessWidget {
  const AppListRow({
    super.key,
    required this.title,
    this.subtitle,
    this.supporting,
    this.leadingText,
    this.leadingIcon,
    this.trailing,
    this.onTap,
    this.enabled = true,
    this.selected = false,
    this.radio = false,
    this.showChevron = false,
    this.tone,
    this.semanticLabel,
  });
  final String title;
  final String? subtitle;

  /// Extra content under the subtitle (e.g. badge + status line), so it does
  /// not compete with [trailing] for width.
  final Widget? supporting;
  final String? leadingText;
  final IconData? leadingIcon;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool enabled;
  final bool selected;
  final bool radio;
  final bool showChevron;
  final AppStatusTone? tone;
  final String? semanticLabel;
  @override
  Widget build(BuildContext context) {
    final t = AppUiTokens.of(context);
    final theme = Theme.of(context);
    final disabled = onTap != null && !enabled;
    final fg = disabled
        ? t.disabledForeground
        : tone != null
        ? t.status(tone!).foreground
        : theme.colorScheme.onSurface;
    final large = isLargeText(context);
    final titleBlock = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: theme.textTheme.titleSmall?.copyWith(color: fg)),
        if (subtitle != null)
          Text(
            subtitle!,
            style: theme.textTheme.bodySmall?.copyWith(
              color: disabled
                  ? t.disabledForeground
                  : theme.colorScheme.onSurfaceVariant,
            ),
          ),
        if (supporting != null) ...[const SizedBox(height: 4), supporting!],
      ],
    );
    final content = ConstrainedBox(
      constraints: BoxConstraints(minHeight: t.rowMinHeight),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: large
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (leadingText != null)
                    Text(
                      leadingText!,
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: fg,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  if (leadingText != null) const SizedBox(height: 4),
                  if (leadingIcon != null) ...[
                    Icon(leadingIcon, color: fg),
                    const SizedBox(height: 4),
                  ],
                  titleBlock,
                  if (trailing != null) ...[
                    const SizedBox(height: 4),
                    trailing!,
                  ],
                  if (showChevron && onTap != null)
                    const Icon(Icons.chevron_right),
                ],
              )
            : Row(
                children: [
                  if (leadingText != null)
                    SizedBox(
                      width: 56 * MediaQuery.textScalerOf(context).scale(1),
                      child: Text(
                        leadingText!,
                        style: theme.textTheme.titleSmall?.copyWith(
                          color: fg,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                  if (leadingIcon != null) ...[
                    Icon(leadingIcon, color: fg, size: 24),
                    const SizedBox(width: 12),
                  ],
                  Expanded(child: titleBlock),
                  if (trailing != null) ...[
                    const SizedBox(width: 12),
                    Flexible(child: trailing!),
                  ],
                  if (showChevron && onTap != null)
                    Icon(Icons.chevron_right, color: fg),
                ],
              ),
      ),
    );
    return Semantics(
      button: onTap != null,
      enabled: onTap == null ? null : enabled,
      selected: selected ? true : null,
      inMutuallyExclusiveGroup: radio,
      checked: radio ? selected : null,
      label: semanticLabel,
      onTap: enabled ? onTap : null,
      excludeSemantics: semanticLabel != null,
      child: Material(
        color: selected ? t.selectedBackground : Colors.transparent,
        child: onTap == null
            ? content
            : _AppRowTapTarget(onTap: enabled ? onTap : null, child: content),
      ),
    );
  }
}

class _AppRowTapTarget extends StatefulWidget {
  const _AppRowTapTarget({required this.onTap, required this.child});
  final VoidCallback? onTap;
  final Widget child;
  @override
  State<_AppRowTapTarget> createState() => _AppRowTapTargetState();
}

class _AppRowTapTargetState extends State<_AppRowTapTarget> {
  bool focused = false;
  @override
  Widget build(BuildContext context) => InkWell(
    excludeFromSemantics: true,
    onTap: widget.onTap,
    onFocusChange: (value) => setState(() => focused = value),
    child: Stack(
      children: [
        widget.child,
        if (focused)
          Positioned.fill(
            child: IgnorePointer(
              child: Padding(
                padding: const EdgeInsets.all(3),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppUiTokens.of(context).focus,
                      width: 2,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    ),
  );
}
