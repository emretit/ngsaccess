import 'package:flutter/material.dart';

/// Status text and its background must travel together.
enum AppStatusTone { success, warning, danger, info }

@immutable
class AppStatusColors {
  const AppStatusColors({required this.foreground, required this.background});

  final Color foreground;
  final Color background;
}

class AppTheme {
  static const Color primaryBurgundy = Color(0xFF800020);
  static const Color primaryBurgundy2 = Color(0xFF9E1B3B);
  static const Color tabBarBackground = Color(0xFFF5F5F5);
  static const Color inactiveGray = Color(0xFF6B6B6B);
  static const Color darkBackground = Color(0xFF121212);
  static const Color darkSurface = Color(0xFF1E1E1E);
  static const Color primaryColor = primaryBurgundy;

  // Compatibility accents. For text use ColorScheme or statusColors instead.
  static const Color success = Color(0xFF22C55E);
  static const Color warning = Color(0xFFF59E0B);
  static const Color danger = Color(0xFFEF4444);
  static const Color info = Color(0xFF3B82F6);
  static const Color surfaceVariantLight = Color(0xFFF5F5F5);
  static const Color surfaceVariantDark = Color(0xFF2A2A2A);

  static AppStatusColors statusColors(
    BuildContext context,
    AppStatusTone tone,
  ) => statusColorsFor(Theme.of(context).brightness, tone);

  static AppStatusColors statusColorsFor(
    Brightness brightness,
    AppStatusTone tone,
  ) {
    if (brightness == Brightness.dark) {
      return switch (tone) {
        AppStatusTone.success => const AppStatusColors(
          foreground: Color(0xFFB7F5CD),
          background: Color(0xFF123B29),
        ),
        AppStatusTone.warning => const AppStatusColors(
          foreground: Color(0xFFFFE0A3),
          background: Color(0xFF49320B),
        ),
        AppStatusTone.danger => const AppStatusColors(
          foreground: Color(0xFFFFDAD6),
          background: Color(0xFF601410),
        ),
        AppStatusTone.info => const AppStatusColors(
          foreground: Color(0xFFD3E4FF),
          background: Color(0xFF15365C),
        ),
      };
    }
    return switch (tone) {
      AppStatusTone.success => const AppStatusColors(
        foreground: Color(0xFF14532D),
        background: Color(0xFFDCFCE7),
      ),
      AppStatusTone.warning => const AppStatusColors(
        foreground: Color(0xFF713F12),
        background: Color(0xFFFEF3C7),
      ),
      AppStatusTone.danger => const AppStatusColors(
        foreground: Color(0xFF991B1B),
        background: Color(0xFFFEE2E2),
      ),
      AppStatusTone.info => const AppStatusColors(
        foreground: Color(0xFF1E40AF),
        background: Color(0xFFDBEAFE),
      ),
    };
  }

  static final ThemeData lightTheme = _build(Brightness.light);
  static final ThemeData darkTheme = _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final scheme = ColorScheme.fromSeed(
      seedColor: primaryBurgundy,
      brightness: brightness,
    ).copyWith(surface: dark ? darkSurface : Colors.white);
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: dark ? darkBackground : const Color(0xFFFAFAFA),
      textTheme:
          (dark
                  ? Typography.material2021().white
                  : Typography.material2021().black)
              .apply(
                bodyColor: scheme.onSurface,
                displayColor: scheme.onSurface,
              ),
      appBarTheme: AppBarTheme(
        backgroundColor: dark ? darkBackground : scheme.surface,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        titleTextStyle: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: scheme.onSurface,
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: dark ? darkSurface : tabBarBackground,
        selectedItemColor: scheme.primary,
        unselectedItemColor: scheme.onSurfaceVariant,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: scheme.primary,
          foregroundColor: scheme.onPrimary,
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 2,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(12)),
        ),
        color: scheme.surface,
        surfaceTintColor: Colors.transparent,
      ),
    );
  }
}
