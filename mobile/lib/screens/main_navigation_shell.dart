import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../l10n/app_localizations.dart';
import '../theme/app_theme.dart';

/// Bottom navigation içeren ana shell.
///
/// `StatefulShellRoute.indexedStack` ile her tab kendi navigator stack'ini
/// korur (örn. QR scan ekranındaki token countdown tab değişiminde resetlenmez).
class MainNavigationShell extends StatelessWidget {
  const MainNavigationShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _goBranch(int index) {
    navigationShell.goBranch(
      index,
      // Aynı tab'a tekrar tıklanırsa, o branch stack'inin köküne dön.
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final l10n = AppLocalizations.of(context);
    final currentIndex = navigationShell.currentIndex;

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : AppTheme.tabBarBackground,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.1),
              blurRadius: 8,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 8.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildNavItem(
                  context,
                  index: 0,
                  icon: Icons.home,
                  label: l10n.navHome,
                  isDark: isDark,
                  selected: currentIndex == 0,
                ),
                _buildNavItem(
                  context,
                  index: 1,
                  icon: Icons.history,
                  label: l10n.navHistory,
                  isDark: isDark,
                  selected: currentIndex == 1,
                ),
                _buildQRScanButton(context, isDark: isDark),
                _buildNavItem(
                  context,
                  index: 3,
                  icon: Icons.people,
                  label: l10n.navVisitor,
                  isDark: isDark,
                  selected: currentIndex == 3,
                ),
                _buildNavItem(
                  context,
                  index: 4,
                  icon: Icons.person,
                  label: l10n.navProfile,
                  isDark: isDark,
                  selected: currentIndex == 4,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(
    BuildContext context, {
    required int index,
    required IconData icon,
    required String label,
    required bool isDark,
    required bool selected,
  }) {
    final color = selected
        ? (isDark ? AppTheme.primaryBurgundy2 : AppTheme.primaryBurgundy)
        : AppTheme.inactiveGray;

    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => _goBranch(index),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: color, size: 24),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 12,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQRScanButton(BuildContext context, {required bool isDark}) {
    return GestureDetector(
      onTap: () => _goBranch(2),
      child: Container(
        width: 64,
        height: 64,
        decoration: BoxDecoration(
          color: isDark ? AppTheme.primaryBurgundy2 : AppTheme.primaryBurgundy,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: (isDark ? AppTheme.primaryBurgundy2 : AppTheme.primaryBurgundy)
                  .withValues(alpha: 0.3),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: const Icon(
          Icons.qr_code_scanner,
          color: Colors.white,
          size: 28,
        ),
      ),
    );
  }
}
