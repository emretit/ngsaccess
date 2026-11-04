import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../widgets/ui/app_ui_tokens.dart';
export '../widgets/ui/app_ui_tokens.dart' show AppStatusTone, AppStatusColors;

class AppTheme {
  @Deprecated('Use AppUiTokens or ColorScheme; compatibility until D4.')
  static const Color primaryBurgundy = Color(0xff7a1f1f);
  @Deprecated('Use AppUiTokens or ColorScheme; compatibility until D4.')
  static const Color primaryBurgundy2 = Color(0xff7a1f1f);
  @Deprecated('Use AppUiTokens or ColorScheme; compatibility until D4.')
  static const Color primaryColor = Color(0xff7a1f1f);
  @Deprecated('Use AppUiTokens or ColorScheme; compatibility until D4.')
  static const Color tabBarBackground = Color(0xfff3f3f2);
  @Deprecated('Use AppUiTokens or ColorScheme; compatibility until D4.')
  static const Color surfaceVariantLight = Color(0xfff3f3f2);
  @Deprecated('Use AppUiTokens or ColorScheme; compatibility until D4.')
  static const Color inactiveGray = Color(0xff646461);
  @Deprecated('Use AppUiTokens or ColorScheme; compatibility until D4.')
  static const Color darkBackground = Color(0xff181817);
  @Deprecated('Use AppUiTokens or ColorScheme; compatibility until D4.')
  static const Color darkSurface = Color(0xff20201e);
  @Deprecated('Use AppUiTokens or ColorScheme; compatibility until D4.')
  static const Color surfaceVariantDark = Color(0xff2a2a27);
  @Deprecated('Use AppUiTokens or ColorScheme; compatibility until D4.')
  static const Color success = Color(0xff356047);
  @Deprecated('Use AppUiTokens or ColorScheme; compatibility until D4.')
  static const Color warning = Color(0xff795619);
  @Deprecated('Use AppUiTokens or ColorScheme; compatibility until D4.')
  static const Color danger = Color(0xff963e36);
  @Deprecated('Use AppUiTokens or ColorScheme; compatibility until D4.')
  static const Color info = Color(0xff3b5c76);
  @Deprecated('Use AppUiTokens.of(context).status(tone).')
  static AppStatusColors statusColors(
    BuildContext context,
    AppStatusTone tone,
  ) => statusColorsFor(Theme.of(context).brightness, tone);
  @Deprecated('Use AppUiTokens status pairs.')
  static AppStatusColors statusColorsFor(
    Brightness brightness,
    AppStatusTone tone,
  ) => (brightness == Brightness.dark ? AppUiTokens.dark : AppUiTokens.light)
      .status(tone);
  static final lightTheme = _build(Brightness.light);
  static final darkTheme = _build(Brightness.dark);
  static ThemeData _build(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final t = dark ? AppUiTokens.dark : AppUiTokens.light;
    final c = ColorScheme(
      brightness: brightness,
      primary: const Color(0xff7a1f1f),
      onPrimary: const Color(0xffffffff),
      primaryContainer: dark
          ? const Color(0xff2a2a27)
          : const Color(0xfff3f3f2),
      onPrimaryContainer: dark
          ? const Color(0xffe7b3ad)
          : const Color(0xff7a1f1f),
      primaryFixed: const Color(0xfff3f3f2),
      primaryFixedDim: const Color(0xffe2e2e0),
      onPrimaryFixed: const Color(0xff7a1f1f),
      onPrimaryFixedVariant: const Color(0xff646461),
      secondary: dark ? const Color(0xffb8b8b2) : const Color(0xff646461),
      onSecondary: dark ? const Color(0xff20201e) : const Color(0xffffffff),
      secondaryContainer: dark
          ? const Color(0xff2a2a27)
          : const Color(0xfff3f3f2),
      onSecondaryContainer: dark
          ? const Color(0xfff3f3f0)
          : const Color(0xff252523),
      secondaryFixed: const Color(0xfff3f3f2),
      secondaryFixedDim: const Color(0xffe2e2e0),
      onSecondaryFixed: const Color(0xff252523),
      onSecondaryFixedVariant: const Color(0xff646461),
      tertiary: dark ? const Color(0xffb8b8b2) : const Color(0xff646461),
      onTertiary: dark ? const Color(0xff20201e) : const Color(0xffffffff),
      tertiaryContainer: dark
          ? const Color(0xff2a2a27)
          : const Color(0xfff3f3f2),
      onTertiaryContainer: dark
          ? const Color(0xfff3f3f0)
          : const Color(0xff252523),
      tertiaryFixed: const Color(0xfff3f3f2),
      tertiaryFixedDim: const Color(0xffe2e2e0),
      onTertiaryFixed: const Color(0xff252523),
      onTertiaryFixedVariant: const Color(0xff646461),
      error: dark ? const Color(0xfff0bbb5) : const Color(0xff963e36),
      onError: dark ? const Color(0xff422927) : const Color(0xffffffff),
      errorContainer: dark ? const Color(0xff422927) : const Color(0xfffaefed),
      onErrorContainer: dark
          ? const Color(0xfff0bbb5)
          : const Color(0xff963e36),
      surface: dark ? const Color(0xff20201e) : const Color(0xffffffff),
      onSurface: dark ? const Color(0xfff3f3f0) : const Color(0xff252523),
      surfaceDim: dark ? const Color(0xff181817) : const Color(0xffe8e8e5),
      surfaceBright: dark ? const Color(0xff353531) : const Color(0xffffffff),
      surfaceContainerLowest: dark
          ? const Color(0xff141413)
          : const Color(0xffffffff),
      surfaceContainerLow: dark
          ? const Color(0xff20201e)
          : const Color(0xfffafaf8),
      surfaceContainer: dark
          ? const Color(0xff262624)
          : const Color(0xfff3f3f2),
      surfaceContainerHigh: dark
          ? const Color(0xff2d2d2a)
          : const Color(0xffeeeeeb),
      surfaceContainerHighest: dark
          ? const Color(0xff353531)
          : const Color(0xffe8e8e5),
      onSurfaceVariant: dark
          ? const Color(0xffb8b8b2)
          : const Color(0xff646461),
      outline: dark ? const Color(0xff9a9a93) : const Color(0xff858582),
      outlineVariant: dark ? const Color(0xff3c3c37) : const Color(0xffe2e2e0),
      inverseSurface: dark ? const Color(0xfff3f3f0) : const Color(0xff252523),
      onInverseSurface: dark
          ? const Color(0xff252523)
          : const Color(0xfff3f3f0),
      inversePrimary: dark ? const Color(0xff7a1f1f) : const Color(0xffe7b3ad),
      shadow: const Color(0xff000000),
      scrim: const Color(0xff000000),
      surfaceTint: const Color(0x00000000),
    );
    TextStyle text(double size, double line, FontWeight weight) => TextStyle(
      fontSize: size,
      height: line / size,
      fontWeight: weight,
      letterSpacing: 0,
      color: c.onSurface,
    );
    final textTheme = TextTheme(
      displayLarge: text(32, 40, FontWeight.w600),
      displayMedium: text(30, 38, FontWeight.w600),
      displaySmall: text(28, 36, FontWeight.w600),
      headlineLarge: text(28, 36, FontWeight.w600),
      headlineMedium: text(26, 32, FontWeight.w600),
      headlineSmall: text(24, 30, FontWeight.w600),
      titleLarge: text(20, 26, FontWeight.w600),
      titleMedium: text(18, 24, FontWeight.w600),
      titleSmall: text(16, 22, FontWeight.w600),
      bodyLarge: text(16, 24, FontWeight.w400),
      bodyMedium: text(15, 22, FontWeight.w400),
      bodySmall: text(13, 18, FontWeight.w400),
      labelLarge: text(16, 22, FontWeight.w600),
      labelMedium: text(13, 18, FontWeight.w600),
      labelSmall: text(12, 16, FontWeight.w500),
    );
    WidgetStateProperty<Color?> foreground(Color normal) =>
        WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.disabled)
              ? t.disabledForeground
              : normal,
        );
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
    );
    final base = ButtonStyle(
      minimumSize: const WidgetStatePropertyAll(Size(48, 52)),
      padding: const WidgetStatePropertyAll(
        EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      shape: WidgetStatePropertyAll(shape),
      textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
      animationDuration: const Duration(milliseconds: 120),
      tapTargetSize: MaterialTapTargetSize.padded,
      visualDensity: VisualDensity.standard,
      elevation: const WidgetStatePropertyAll(0),
    );
    final filled = base.copyWith(
      foregroundColor: foreground(c.onPrimary),
      backgroundColor: WidgetStateProperty.resolveWith(
        (s) =>
            s.contains(WidgetState.disabled) ? t.disabledBackground : c.primary,
      ),
      side: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.disabled)
            ? BorderSide.none
            : s.contains(WidgetState.focused)
            ? BorderSide(color: t.focus, width: 2)
            : dark
            ? BorderSide(color: t.accent)
            : BorderSide.none,
      ),
      overlayColor: WidgetStateProperty.resolveWith(
        (s) => c.onPrimary.withValues(
          alpha: s.contains(WidgetState.pressed) ? 0.08 : 0.04,
        ),
      ),
    );
    final outlined = base.copyWith(
      foregroundColor: foreground(c.onSurface),
      backgroundColor: WidgetStateProperty.resolveWith(
        (s) =>
            s.contains(WidgetState.disabled) ? t.disabledBackground : c.surface,
      ),
      side: WidgetStateProperty.resolveWith(
        (s) =>
            s.contains(WidgetState.focused) && !s.contains(WidgetState.disabled)
            ? BorderSide(color: t.focus, width: 2)
            : BorderSide(color: c.outline),
      ),
      overlayColor: WidgetStateProperty.resolveWith(
        (s) => c.onSurface.withValues(
          alpha: s.contains(WidgetState.pressed) ? 0.08 : 0.04,
        ),
      ),
    );
    final textButton = base.copyWith(
      minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
      foregroundColor: foreground(t.accent),
      side: WidgetStateProperty.resolveWith(
        (s) =>
            s.contains(WidgetState.focused) && !s.contains(WidgetState.disabled)
            ? BorderSide(color: t.focus, width: 2)
            : BorderSide.none,
      ),
      overlayColor: outlined.overlayColor,
    );
    OutlineInputBorder border(Color color, [double width = 1]) =>
        OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: color, width: width),
        );
    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: c,
      extensions: [t],
      scaffoldBackgroundColor: t.canvas,
      textTheme: textTheme,
      visualDensity: VisualDensity.standard,
      materialTapTargetSize: MaterialTapTargetSize.padded,
      appBarTheme: AppBarTheme(
        backgroundColor: t.canvas,
        foregroundColor: c.onSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: textTheme.headlineMedium,
        systemOverlayStyle: dark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
      ),
      filledButtonTheme: FilledButtonThemeData(style: filled),
      elevatedButtonTheme: ElevatedButtonThemeData(style: filled),
      outlinedButtonTheme: OutlinedButtonThemeData(style: outlined),
      textButtonTheme: TextButtonThemeData(style: textButton),
      iconButtonTheme: IconButtonThemeData(
        style: textButton.copyWith(iconSize: const WidgetStatePropertyAll(24)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.surface,
        border: border(c.outline),
        enabledBorder: border(c.outline),
        disabledBorder: border(c.outlineVariant),
        focusedBorder: border(t.focus, 2),
        errorBorder: border(t.danger.foreground),
        focusedErrorBorder: border(t.danger.foreground, 2),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        labelStyle: textTheme.bodySmall,
        hintStyle: textTheme.bodyLarge?.copyWith(color: c.onSurfaceVariant),
        helperStyle: textTheme.bodySmall,
        errorStyle: textTheme.bodySmall?.copyWith(color: t.danger.foreground),
        errorMaxLines: 10,
        helperMaxLines: 10,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        height: 64,
        indicatorColor: t.selectedBackground,
        labelTextStyle: WidgetStatePropertyAll(textTheme.labelSmall),
        iconTheme: WidgetStateProperty.resolveWith(
          (s) => IconThemeData(
            size: 24,
            color: s.contains(WidgetState.selected)
                ? t.accent
                : c.onSurfaceVariant,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        color: c.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: c.outlineVariant),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: c.outlineVariant,
        thickness: 1,
        space: 1,
      ),
      listTileTheme: ListTileThemeData(
        textColor: c.onSurface,
        iconColor: c.onSurfaceVariant,
        selectedColor: t.accent,
        selectedTileColor: t.selectedBackground,
        minTileHeight: 64,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 12,
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        titleTextStyle: textTheme.titleLarge,
        contentTextStyle: textTheme.bodyMedium,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: c.inverseSurface,
        contentTextStyle: textTheme.bodyMedium?.copyWith(
          color: c.onInverseSurface,
        ),
        actionTextColor: c.inversePrimary,
        behavior: SnackBarBehavior.floating,
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: c.inverseSurface,
          borderRadius: BorderRadius.circular(4),
        ),
        textStyle: textTheme.bodySmall?.copyWith(color: c.onInverseSurface),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: t.accent,
        linearTrackColor: t.subtle,
        circularTrackColor: t.subtle,
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: t.accent,
        selectionColor: t.selectedBackground,
        selectionHandleColor: t.accent,
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: t.accent,
        unselectedLabelColor: c.onSurfaceVariant,
        indicatorColor: t.accent,
        dividerColor: c.outlineVariant,
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: outlined.copyWith(
          backgroundColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected)
                ? t.selectedBackground
                : c.surface,
          ),
          foregroundColor: foreground(t.accent),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: c.surface,
        selectedColor: t.selectedBackground,
        labelStyle: textTheme.labelMedium?.copyWith(color: t.accent),
        side: BorderSide(color: c.outlineVariant),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStatePropertyAll(t.subtle),
        checkColor: foreground(t.accent),
        side: WidgetStateBorderSide.resolveWith(
          (s) => BorderSide(
            color: s.contains(WidgetState.selected) ? t.accent : c.outline,
            width: 2,
          ),
        ),
      ),
      radioTheme: RadioThemeData(fillColor: foreground(t.accent)),
      switchTheme: SwitchThemeData(
        thumbColor: foreground(t.accent),
        trackColor: WidgetStatePropertyAll(t.subtle),
        trackOutlineColor: WidgetStatePropertyAll(c.outline),
      ),
      datePickerTheme: DatePickerThemeData(
        backgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        headerBackgroundColor: c.surface,
        headerForegroundColor: c.onSurface,
        dayForegroundColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.disabled)
              ? t.disabledForeground
              : s.contains(WidgetState.selected)
              ? t.accent
              : c.onSurface,
        ),
        dayBackgroundColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? t.selectedBackground : null,
        ),
        todayForegroundColor: WidgetStatePropertyAll(t.accent),
        todayBackgroundColor: const WidgetStatePropertyAll(Colors.transparent),
        todayBorder: BorderSide(color: t.focus, width: 2),
        rangeSelectionBackgroundColor: t.subtle,
        rangePickerBackgroundColor: c.surface,
        rangePickerSurfaceTintColor: Colors.transparent,
        rangePickerHeaderBackgroundColor: c.surface,
        rangePickerHeaderForegroundColor: c.onSurface,
        cancelButtonStyle: textButton,
        confirmButtonStyle: textButton,
      ),
      timePickerTheme: TimePickerThemeData(
        backgroundColor: c.surface,
        hourMinuteColor: WidgetStateColor.resolveWith(
          (s) => s.contains(WidgetState.selected)
              ? t.selectedBackground
              : c.surface,
        ),
        hourMinuteTextColor: WidgetStateColor.resolveWith(
          (s) => s.contains(WidgetState.selected) ? t.accent : c.onSurface,
        ),
        dialBackgroundColor: t.subtle,
        dialHandColor: t.accent,
        dialTextColor: WidgetStateColor.resolveWith(
          (s) => s.contains(WidgetState.selected) ? c.surface : c.onSurface,
        ),
        dayPeriodColor: t.selectedBackground,
        dayPeriodTextColor: t.accent,
        cancelButtonStyle: textButton,
        confirmButtonStyle: textButton,
      ),
    );
  }
}
