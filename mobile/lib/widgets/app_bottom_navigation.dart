import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../theme/app_theme.dart';

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
    final isDark = Theme.of(context).brightness == Brightness.dark;
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
                    color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.12),
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
                      color: (isDark ? AppTheme.darkSurface : Colors.white)
                          .withValues(alpha: 0.9),
                      borderRadius: radius,
                      border: Border.all(
                        color: Colors.white.withValues(
                          alpha: isDark ? 0.12 : 0.7,
                        ),
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 8,
                      ),
                      child: FocusTraversalGroup(
                        policy: OrderedTraversalPolicy(),
                        child: Row(
                          children: [
                            for (var index = 0; index < labels.length; index++)
                              if (index == 2)
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

class _NavigationButton extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent = isDark ? const Color(0xFFF3A8BD) : AppTheme.primaryBurgundy;
    final muted = isDark ? const Color(0xFFC9B8C0) : const Color(0xFF71626A);
    final duration = MediaQuery.disableAnimationsOf(context)
        ? Duration.zero
        : const Duration(milliseconds: 220);
    final foreground = selected ? accent : muted;
    const radius = BorderRadius.all(Radius.circular(18));

    return Semantics(
      button: true,
      selected: selected,
      label: label,
      onTap: onTap,
      child: Tooltip(
        message: label,
        excludeFromSemantics: true,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 1),
          child: AnimatedContainer(
            duration: duration,
            curve: Curves.easeOut,
            decoration: BoxDecoration(
              color: selected && !prominent
                  ? accent.withValues(alpha: isDark ? 0.14 : 0.09)
                  : Colors.transparent,
              borderRadius: radius,
            ),
            child: Material(
              type: MaterialType.transparency,
              child: InkWell(
                key: ValueKey('app_nav_button_$index'),
                borderRadius: radius,
                excludeFromSemantics: true,
                focusColor: accent.withValues(alpha: 0.2),
                hoverColor: accent.withValues(alpha: 0.08),
                onTap: onTap,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(
                    minWidth: 48,
                    minHeight: 52,
                  ),
                  child: Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: 2,
                      vertical: prominent ? 0 : 7,
                    ),
                    child: ExcludeSemantics(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (prominent)
                            AnimatedContainer(
                              duration: duration,
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppTheme.primaryBurgundy,
                                border: Border.all(
                                  color: selected
                                      ? const Color(0xFFEFC5D0)
                                      : Colors.transparent,
                                  width: 3,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppTheme.primaryBurgundy.withValues(
                                      alpha: 0.25,
                                    ),
                                    blurRadius: 12,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: Icon(icon, size: 28, color: Colors.white),
                            )
                          else
                            Icon(icon, size: 23, color: foreground),
                          SizedBox(height: prominent ? 5 : 3),
                          Text(
                            label,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 11,
                              height: 1.15,
                              fontWeight: selected || prominent
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
    );
  }
}
