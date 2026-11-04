import 'package:flutter/material.dart';
import 'app_ui_tokens.dart';

enum AppSkeletonKind { list, attendance, form, qr, metrics }

class AppSkeleton extends StatelessWidget {
  const AppSkeleton({
    super.key,
    required this.semanticLabel,
    this.kind = AppSkeletonKind.list,
    this.itemCount = 3,
  }) : assert(itemCount >= 0);
  final String semanticLabel;
  final AppSkeletonKind kind;
  final int itemCount;
  @override
  Widget build(BuildContext context) {
    final t = AppUiTokens.of(context);
    final height = switch (kind) {
      AppSkeletonKind.list => 64.0,
      AppSkeletonKind.form => 56.0,
      AppSkeletonKind.qr => 224.0,
      AppSkeletonKind.attendance => 156.0,
      AppSkeletonKind.metrics => 80.0,
    };
    return Semantics(
      label: semanticLabel,
      liveRegion: true,
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < itemCount; i++)
              Padding(
                padding: EdgeInsets.only(bottom: i == itemCount - 1 ? 0 : 12),
                child: Container(
                  height: height,
                  decoration: BoxDecoration(
                    color: t.subtle,
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
