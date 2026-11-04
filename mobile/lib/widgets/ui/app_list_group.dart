import 'package:flutter/material.dart';
import 'app_surface.dart';

class AppListGroup extends StatelessWidget {
  const AppListGroup({
    super.key,
    this.title,
    this.subtitle,
    required this.children,
    this.showDividers = true,
  });
  final String? title;
  final String? subtitle;
  final List<Widget> children;
  final bool showDividers;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      if (title != null)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Semantics(
            header: true,
            child: Text(title!, style: Theme.of(context).textTheme.titleMedium),
          ),
        ),
      if (subtitle != null)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text(subtitle!, style: Theme.of(context).textTheme.bodySmall),
        ),
      AppSurface(
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < children.length; i++) ...[
              if (i > 0 && showDividers) const Divider(),
              children[i],
            ],
          ],
        ),
      ),
    ],
  );
}
