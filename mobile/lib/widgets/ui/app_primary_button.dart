import 'package:flutter/material.dart';
import 'app_ui_tokens.dart';

class AppPrimaryButton extends StatelessWidget {
  const AppPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.busy = false,
    this.busyLabel,
    this.expanded = true,
    this.focusNode,
    this.semanticLabel,
  });
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool busy;
  final String? busyLabel;
  final bool expanded;
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
    builder: (onFocus) => FilledButton(
      focusNode: focusNode,
      style: ButtonStyle(
        animationDuration: MediaQuery.disableAnimationsOf(context)
            ? Duration.zero
            : const Duration(milliseconds: 120),
      ),
      onFocusChange: onFocus,
      onPressed: busy ? null : onPressed,
      child: AppButtonContent(
        label: label,
        busyLabel: busyLabel,
        icon: icon,
        busy: busy,
      ),
    ),
  );
}

/// Shared focus ring and single accessibility announcement for kit actions.
class AppButtonFrame extends StatefulWidget {
  const AppButtonFrame({
    super.key,
    required this.label,
    required this.busy,
    required this.expanded,
    required this.onPressed,
    required this.builder,
    this.busyLabel,
    this.semanticLabel,
  });
  final String label;
  final String? busyLabel;
  final String? semanticLabel;
  final bool busy;
  final bool expanded;
  final VoidCallback? onPressed;
  final Widget Function(ValueChanged<bool>) builder;
  @override
  State<AppButtonFrame> createState() => _AppButtonFrameState();
}

class _AppButtonFrameState extends State<AppButtonFrame> {
  bool focused = false;
  @override
  Widget build(BuildContext context) {
    final t = AppUiTokens.of(context);
    return Semantics(
      button: true,
      enabled: !widget.busy && widget.onPressed != null,
      liveRegion: widget.busy,
      label:
          widget.semanticLabel ??
          (widget.busy ? widget.busyLabel ?? widget.label : widget.label),
      onTap: widget.busy ? null : widget.onPressed,
      child: ExcludeSemantics(
        child: SizedBox(
          width: widget.expanded ? double.infinity : null,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              SizedBox(
                width: widget.expanded ? double.infinity : null,
                child: widget.builder((v) => setState(() => focused = v)),
              ),
              if (focused)
                Positioned(
                  left: -5,
                  top: -5,
                  right: -5,
                  bottom: -5,
                  child: IgnorePointer(
                    child: DecoratedBox(
                      decoration: ShapeDecoration(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(
                            t.controlRadius + 5,
                          ),
                          side: BorderSide(color: t.focus, width: 2),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class AppButtonContent extends StatelessWidget {
  const AppButtonContent({
    super.key,
    required this.label,
    required this.busy,
    this.icon,
    this.busyLabel,
  });
  final String label;
  final String? busyLabel;
  final IconData? icon;
  final bool busy;
  @override
  Widget build(BuildContext context) {
    Widget content({required bool loading, bool measuring = false}) => Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (loading) ...[
          SizedBox(
            width: 20,
            height: 20,
            child: measuring
                ? null
                : const CircularProgressIndicator(strokeWidth: 2),
          ),
          const SizedBox(width: 8),
        ] else if (icon != null) ...[
          Icon(icon, size: 24),
          const SizedBox(width: 12),
        ],
        Flexible(
          child: measuring
              ? RichText(
                  text: TextSpan(
                    text: loading ? busyLabel ?? label : label,
                    style: DefaultTextStyle.of(context).style,
                  ),
                  textScaler: MediaQuery.textScalerOf(context),
                  textAlign: TextAlign.center,
                )
              : Text(
                  loading ? busyLabel ?? label : label,
                  textAlign: TextAlign.center,
                ),
        ),
      ],
    );
    return Stack(
      alignment: Alignment.center,
      children: [
        Visibility(
          visible: false,
          maintainSize: true,
          maintainAnimation: true,
          maintainState: true,
          child: content(loading: !busy, measuring: true),
        ),
        content(loading: busy),
      ],
    );
  }
}
