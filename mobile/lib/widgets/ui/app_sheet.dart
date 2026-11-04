import 'package:flutter/material.dart';
import '../../l10n/app_localizations.dart';

class AppSheet extends StatelessWidget {
  const AppSheet({
    super.key,
    required this.title,
    required this.body,
    this.actionBar,
    this.busy = false,
    this.onClose,
    this.showClose = true,
    this.bodyOwnsScroll = false,
  });
  final String title;
  final Widget body;
  final Widget? actionBar;
  final bool busy;
  final VoidCallback? onClose;
  final bool showClose;
  final bool bodyOwnsScroll;
  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !busy,
    // BottomSheet's drag dismissal uses Navigator.pop and bypasses PopScope.
    // Win vertical gestures inside the sheet while busy; PopScope still guards
    // barrier taps and back, which use maybePop.
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      excludeFromSemantics: true,
      onVerticalDragUpdate: busy ? (_) {} : null,
      child: Semantics(
        scopesRoute: true,
        explicitChildNodes: true,
        namesRoute: true,
        label: title,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: ExcludeSemantics(
                child: Container(
                  width: 32,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.outlineVariant,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text(
                        title,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                  ),
                  if (showClose)
                    IconButton(
                      tooltip: MaterialLocalizations.of(
                        context,
                      ).closeButtonTooltip,
                      onPressed: busy
                          ? null
                          : onClose ?? () => Navigator.maybePop(context),
                      icon: const Icon(Icons.close),
                    ),
                ],
              ),
            ),
            if (busy)
              Semantics(
                label: AppLocalizations.of(context).commonLoading,
                liveRegion: true,
                child: const ExcludeSemantics(child: LinearProgressIndicator()),
              ),
            Flexible(
              child: bodyOwnsScroll
                  ? body
                  : SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                      child: body,
                    ),
            ),
            ?actionBar,
          ],
        ),
      ),
    ),
  );
}
