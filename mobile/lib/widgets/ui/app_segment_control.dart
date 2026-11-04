import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app_ui_tokens.dart';

class AppSegment<T extends Object> {
  const AppSegment({
    required this.value,
    required this.label,
    this.icon,
    this.enabled = true,
    this.key,
  });
  final T value;
  final String label;
  final IconData? icon;
  final bool enabled;
  final Key? key;
}

class AppSegmentControl<T extends Object> extends StatefulWidget {
  const AppSegmentControl({
    super.key,
    required this.segments,
    required this.selected,
    required this.onChanged,
    this.semanticLabel,
  });
  final List<AppSegment<T>> segments;
  final T selected;
  final ValueChanged<T>? onChanged;
  final String? semanticLabel;
  @override
  State<AppSegmentControl<T>> createState() => _AppSegmentControlState<T>();
}

class _AppSegmentControlState<T extends Object>
    extends State<AppSegmentControl<T>> {
  final Map<T, FocusNode> _nodes = {};
  FocusNode _node(T value) => _nodes.putIfAbsent(value, FocusNode.new);
  @override
  void dispose() {
    for (final node in _nodes.values) {
      node.dispose();
    }
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant AppSegmentControl<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    final values = widget.segments.map((segment) => segment.value).toSet();
    for (final removed
        in _nodes.keys.where((value) => !values.contains(value)).toList()) {
      _nodes.remove(removed)?.dispose();
    }
  }

  void _move(int delta) {
    if (widget.onChanged == null) return;
    final index = widget.segments.indexWhere((s) => s.value == widget.selected);
    for (var offset = 1; offset <= widget.segments.length; offset++) {
      final next = (index + delta * offset) % widget.segments.length;
      if (next == index) return;
      if (widget.segments[next].enabled) {
        _node(widget.segments[next].value).requestFocus();
        widget.onChanged?.call(widget.segments[next].value);
        break;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    assert(widget.segments.length >= 2 && widget.segments.length <= 3);
    assert(
      widget.segments.map((s) => s.value).toSet().length ==
          widget.segments.length,
    );
    assert(widget.segments.any((s) => s.value == widget.selected));
    final t = AppUiTokens.of(context);
    final theme = Theme.of(context);
    return Semantics(
      label: widget.semanticLabel,
      child: Focus(
        onKeyEvent: (node, event) {
          if (event is! KeyDownEvent) return KeyEventResult.ignored;
          if (event.logicalKey == LogicalKeyboardKey.arrowRight ||
              event.logicalKey == LogicalKeyboardKey.arrowDown) {
            _move(1);
            return KeyEventResult.handled;
          }
          if (event.logicalKey == LogicalKeyboardKey.arrowLeft ||
              event.logicalKey == LogicalKeyboardKey.arrowUp) {
            _move(-1);
            return KeyEventResult.handled;
          }
          return KeyEventResult.ignored;
        },
        child: LayoutBuilder(
          builder: (context, c) {
            double width = 0;
            for (final segment in widget.segments) {
              final painter = TextPainter(
                text: TextSpan(
                  text: segment.label,
                  style: theme.textTheme.labelMedium,
                ),
                textScaler: MediaQuery.textScalerOf(context),
                textDirection: Directionality.of(context),
              )..layout();
              width = math.max(width, painter.width + 44);
              painter.dispose();
            }
            final vertical =
                c.hasBoundedWidth &&
                (isLargeText(context) ||
                    width * widget.segments.length > c.maxWidth - 10);
            final segmentWidth = c.hasBoundedWidth
                ? vertical
                      ? c.maxWidth - 10
                      : (c.maxWidth - 10) / widget.segments.length
                : width;
            return Container(
              width: c.hasBoundedWidth
                  ? null
                  : width * widget.segments.length + 10,
              decoration: BoxDecoration(
                color: t.subtle,
                border: Border.all(color: theme.colorScheme.outlineVariant),
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.all(4),
              child: Flex(
                mainAxisSize: MainAxisSize.min,
                direction: vertical ? Axis.vertical : Axis.horizontal,
                children: [
                  for (final s in widget.segments)
                    SizedBox(
                      width: segmentWidth,
                      child: Semantics(
                        selected: s.value == widget.selected,
                        child: TextButton(
                          key: s.key,
                          focusNode: _node(s.value),
                          onPressed: widget.onChanged == null || !s.enabled
                              ? null
                              : () {
                                  _node(s.value).requestFocus();
                                  widget.onChanged?.call(s.value);
                                },
                          style:
                              TextButton.styleFrom(
                                backgroundColor: s.value == widget.selected
                                    ? theme.colorScheme.surface
                                    : Colors.transparent,
                                foregroundColor: t.accent,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 12,
                                ),
                              ).copyWith(
                                animationDuration:
                                    MediaQuery.disableAnimationsOf(context)
                                    ? Duration.zero
                                    : const Duration(milliseconds: 120),
                                side: WidgetStateProperty.resolveWith(
                                  (states) =>
                                      states.contains(WidgetState.focused)
                                      ? BorderSide(color: t.focus, width: 2)
                                      : BorderSide.none,
                                ),
                              ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              if (s.value == widget.selected) ...[
                                const Icon(Icons.check, size: 16),
                                const SizedBox(width: 4),
                              ] else if (s.icon != null) ...[
                                Icon(s.icon, size: 16),
                                const SizedBox(width: 4),
                              ],
                              Flexible(
                                child: Text(
                                  s.label,
                                  style: theme.textTheme.labelMedium?.copyWith(
                                    color:
                                        !s.enabled || widget.onChanged == null
                                        ? t.disabledForeground
                                        : t.accent,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
