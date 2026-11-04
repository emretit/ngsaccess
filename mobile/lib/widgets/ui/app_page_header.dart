import 'package:flutter/material.dart';
import 'app_ui_tokens.dart';

class AppPageHeader extends StatelessWidget {
  const AppPageHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.showBack = false,
    this.onBack,
    this.actions = const <Widget>[],
    this.consumeTopInset = true,
  });
  final String title;
  final String? subtitle;
  final bool showBack;
  final VoidCallback? onBack;
  final List<Widget> actions;
  final bool consumeTopInset;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final large = isLargeText(context);
    return ColoredBox(
      color: AppUiTokens.of(context).canvas,
      child: SafeArea(
        top: consumeTopInset,
        bottom: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (showBack)
                        BackButton(
                          onPressed:
                              onBack ?? () => Navigator.maybePop(context),
                        ),
                      Expanded(
                        child: Semantics(
                          header: true,
                          child: Text(
                            title,
                            style: theme.textTheme.headlineMedium,
                          ),
                        ),
                      ),
                      if (!large) ...actions,
                    ],
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 8),
                    Text(subtitle!, style: theme.textTheme.bodySmall),
                  ],
                  if (large && actions.isNotEmpty)
                    Wrap(alignment: WrapAlignment.end, children: actions),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
