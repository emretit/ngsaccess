import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import 'app_ui_tokens.dart';

/// Floating navigation with a prominent QR destination, inspired by Huggin.
class AppBottomNavigation extends StatelessWidget {
  const AppBottomNavigation({
    super.key,
    required this.selectedIndex,
    required this.onDestinationSelected,
  }) : assert(selectedIndex >= 0 && selectedIndex < 5);

  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final c = theme.colorScheme;
    final l10n = AppLocalizations.of(context);
    final labels = [
      l10n.navHome,
      l10n.navHistory,
      l10n.qrTabTitle,
      l10n.navVisitor,
      l10n.navProfile,
    ];
    const icons = [
      Icons.home_outlined,
      Icons.history_outlined,
      Icons.qr_code_scanner_rounded,
      Icons.people_outline_rounded,
      Icons.person_outline_rounded,
    ];
    const selectedIcons = [
      Icons.home_rounded,
      Icons.history_rounded,
      Icons.qr_code_scanner_rounded,
      Icons.people_rounded,
      Icons.person_rounded,
    ];
    const radius = BorderRadius.all(Radius.circular(28));

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: radius,
                boxShadow: [
                  BoxShadow(
                    color: c.shadow.withValues(
                      alpha: theme.brightness == Brightness.dark ? 0.3 : 0.12,
                    ),
                    blurRadius: 24,
                    spreadRadius: -4,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: radius,
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: c.surface.withValues(alpha: 0.9),
                      borderRadius: radius,
                      border: Border.all(color: c.outlineVariant),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 8,
                      ),
                      child: FocusTraversalGroup(
                        policy: OrderedTraversalPolicy(),
                        child: LayoutBuilder(
                          builder: (context, constraints) => Row(
                            children: [
                              for (
                                var index = 0;
                                index < labels.length;
                                index++
                              )
                                if (index == 2 &&
                                    constraints.maxWidth >= 320 &&
                                    MediaQuery.textScalerOf(context).scale(1) <=
                                        1.3)
                                  SizedBox(
                                    width: 76,
                                    child: _destination(
                                      index,
                                      labels,
                                      icons,
                                      selectedIcons,
                                    ),
                                  )
                                else
                                  Expanded(
                                    child: _destination(
                                      index,
                                      labels,
                                      icons,
                                      selectedIcons,
                                    ),
                                  ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _destination(
    int index,
    List<String> labels,
    List<IconData> icons,
    List<IconData> selectedIcons,
  ) => FocusTraversalOrder(
    order: NumericFocusOrder(index.toDouble()),
    child: _NavigationButton(
      index: index,
      label: labels[index],
      icon: selectedIndex == index ? selectedIcons[index] : icons[index],
      selected: selectedIndex == index,
      prominent: index == 2,
      onTap: () => onDestinationSelected(index),
    ),
  );
}

class _NavigationButton extends StatefulWidget {
  const _NavigationButton({
    required this.index,
    required this.label,
    required this.icon,
    required this.selected,
    required this.prominent,
    required this.onTap,
  });

  final int index;
  final String label;
  final IconData icon;
  final bool selected;
  final bool prominent;
  final VoidCallback onTap;

  @override
  State<_NavigationButton> createState() => _NavigationButtonState();
}

class _NavigationButtonState extends State<_NavigationButton> {
  bool focused = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final c = theme.colorScheme;
    final t = AppUiTokens.of(context);
    final accent = t.accent;
    final muted = c.onSurfaceVariant;
    final duration = MediaQuery.disableAnimationsOf(context)
        ? Duration.zero
        : const Duration(milliseconds: 220);
    final foreground = widget.selected ? accent : muted;
    const radius = BorderRadius.all(Radius.circular(18));

    return Semantics(
      button: true,
      selected: widget.selected,
      label: widget.label,
      onTap: widget.onTap,
      child: Tooltip(
        message: widget.label,
        excludeFromSemantics: true,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 1),
          child: AnimatedContainer(
            duration: duration,
            curve: Curves.easeOut,
            foregroundDecoration: BoxDecoration(
              borderRadius: radius,
              border: Border.all(
                color: focused ? t.focus : Colors.transparent,
                width: 2,
              ),
            ),
            decoration: BoxDecoration(
              color: widget.selected && !widget.prominent
                  ? t.selectedBackground
                  : Colors.transparent,
              borderRadius: radius,
            ),
            child: Material(
              type: MaterialType.transparency,
              child: InkWell(
                key: ValueKey('app_nav_button_${widget.index}'),
                borderRadius: radius,
                excludeFromSemantics: true,
                onFocusChange: (value) => setState(() => focused = value),
                focusColor: t.focus.withValues(alpha: 0.2),
                hoverColor: accent.withValues(alpha: 0.08),
                onTap: widget.onTap,
                child: Ink(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      minWidth: 48,
                      minHeight: 52,
                    ),
                    child: Padding(
                      padding: EdgeInsets.symmetric(
                        horizontal: 2,
                        vertical: widget.prominent ? 0 : 7,
                      ),
                      child: ExcludeSemantics(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (widget.prominent)
                              LayoutBuilder(
                                builder: (context, constraints) =>
                                    AnimatedContainer(
                                      duration: duration,
                                      width: constraints.maxWidth.clamp(
                                        0.0,
                                        64.0,
                                      ),
                                      height: constraints.maxWidth.clamp(
                                        0.0,
                                        64.0,
                                      ),
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: t.bandBackground,
                                        border: Border.all(
                                          color: widget.selected
                                              ? t.onBand
                                              : Colors.transparent,
                                          width: 3,
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: t.bandBackground.withValues(
                                              alpha: 0.25,
                                            ),
                                            blurRadius: 12,
                                            offset: const Offset(0, 4),
                                          ),
                                        ],
                                      ),
                                      child: Icon(
                                        widget.icon,
                                        size: 28,
                                        color: t.onBand,
                                      ),
                                    ),
                              )
                            else
                              Icon(widget.icon, size: 23, color: foreground),
                            SizedBox(height: widget.prominent ? 5 : 3),
                            if (widget.prominent)
                              Wrap(
                                alignment: WrapAlignment.center,
                                spacing: 3,
                                children: [
                                  for (final part in widget.label.split(' '))
                                    Text(
                                      part,
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 11,
                                        height: 1.15,
                                        fontWeight: FontWeight.w700,
                                        color: foreground,
                                      ),
                                    ),
                                ],
                              )
                            else
                              Text(
                                widget.label,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 11,
                                  height: 1.15,
                                  fontWeight:
                                      widget.selected || widget.prominent
                                      ? FontWeight.w700
                                      : FontWeight.w500,
                                  color: foreground,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
