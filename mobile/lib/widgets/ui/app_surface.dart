import 'package:flutter/material.dart';
import 'app_ui_tokens.dart';

enum AppSurfaceKind { group, attendanceOverlap, qr }

class AppSurface extends StatelessWidget {
  const AppSurface({
    super.key,
    required this.child,
    this.kind = AppSurfaceKind.group,
    this.padding = const EdgeInsets.all(20),
  });
  final Widget child;
  final AppSurfaceKind kind;
  final EdgeInsetsGeometry padding;
  @override
  Widget build(BuildContext context) {
    final t = AppUiTokens.of(context);
    final c = Theme.of(context).colorScheme;
    return Container(
      clipBehavior: Clip.antiAlias,
      padding: padding,
      decoration: BoxDecoration(
        color: kind == AppSurfaceKind.qr ? Colors.white : c.surface,
        border: Border.all(color: c.outlineVariant),
        borderRadius: BorderRadius.circular(
          kind == AppSurfaceKind.qr ? t.qrRadius : t.groupRadius,
        ),
        boxShadow: kind == AppSurfaceKind.group
            ? null
            : const [
                BoxShadow(
                  color: Color(0x08252523),
                  offset: Offset(0, 3),
                  blurRadius: 9,
                ),
              ],
      ),
      child: child,
    );
  }
}
