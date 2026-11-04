import 'dart:ui' show lerpDouble;
import 'package:flutter/material.dart';

enum AppStatusTone { success, warning, danger, info }

@immutable
class AppStatusColors {
  const AppStatusColors({required this.foreground, required this.background});
  final Color foreground;
  final Color background;
  AppStatusColors copyWith({Color? foreground, Color? background}) =>
      AppStatusColors(
        foreground: foreground ?? this.foreground,
        background: background ?? this.background,
      );
  static AppStatusColors lerp(AppStatusColors a, AppStatusColors b, double t) =>
      AppStatusColors(
        foreground: Color.lerp(a.foreground, b.foreground, t)!,
        background: Color.lerp(a.background, b.background, t)!,
      );
}

@immutable
class AppUiTokens extends ThemeExtension<AppUiTokens> {
  const AppUiTokens({
    required this.canvas,
    required this.subtle,
    required this.accent,
    required this.selectedBackground,
    required this.bandBackground,
    required this.onBand,
    required this.onBandMuted,
    required this.bandAvatarBackground,
    required this.focus,
    required this.focusOnBand,
    required this.disabledForeground,
    required this.disabledBackground,
    required this.success,
    required this.warning,
    required this.danger,
    required this.info,
    this.pageInset = 20,
    this.badgeRadius = 4,
    this.controlRadius = 12,
    this.groupRadius = 16,
    this.qrRadius = 16,
    this.sheetRadius = 20,
    this.minTapExtent = 48,
    this.buttonMinHeight = 52,
    this.rowMinHeight = 64,
    this.navigationMinHeight = 64,
    this.brandOverlap = 32,
  });
  final Color canvas;
  final Color subtle;
  final Color accent;
  final Color selectedBackground;
  final Color bandBackground;
  final Color onBand;
  final Color onBandMuted;
  final Color bandAvatarBackground;
  final Color focus;
  final Color focusOnBand;
  final Color disabledForeground;
  final Color disabledBackground;
  final AppStatusColors success;
  final AppStatusColors warning;
  final AppStatusColors danger;
  final AppStatusColors info;
  final double pageInset;
  final double badgeRadius;
  final double controlRadius;
  final double groupRadius;
  final double qrRadius;
  final double sheetRadius;
  final double minTapExtent;
  final double buttonMinHeight;
  final double rowMinHeight;
  final double navigationMinHeight;
  final double brandOverlap;
  static AppUiTokens of(BuildContext context) {
    final tokens = Theme.of(context).extension<AppUiTokens>();
    if (tokens == null) {
      throw StateError('AppUiTokens is missing from ThemeData');
    }
    return tokens;
  }

  AppStatusColors status(AppStatusTone tone) => switch (tone) {
    AppStatusTone.success => success,
    AppStatusTone.warning => warning,
    AppStatusTone.danger => danger,
    AppStatusTone.info => info,
  };
  static const light = AppUiTokens(
    canvas: Color(0xfff7f7f5),
    subtle: Color(0xfff3f3f2),
    accent: Color(0xff7a1f1f),
    selectedBackground: Color(0xfff3f3f2),
    bandBackground: Color(0xff7a1f1f),
    onBand: Color(0xffffffff),
    onBandMuted: Color(0xfff1dcd8),
    bandAvatarBackground: Color(0xff551919),
    focus: Color(0xff7a1f1f),
    focusOnBand: Color(0xffffffff),
    disabledForeground: Color(0xff777774),
    disabledBackground: Color(0xffeeeeeb),
    success: AppStatusColors(
      foreground: Color(0xff356047),
      background: Color(0xffedf4ef),
    ),
    warning: AppStatusColors(
      foreground: Color(0xff795619),
      background: Color(0xfffaf3e5),
    ),
    danger: AppStatusColors(
      foreground: Color(0xff963e36),
      background: Color(0xfffaefed),
    ),
    info: AppStatusColors(
      foreground: Color(0xff3b5c76),
      background: Color(0xffedf2f7),
    ),
  );
  static const dark = AppUiTokens(
    canvas: Color(0xff181817),
    subtle: Color(0xff2a2a27),
    accent: Color(0xffe7b3ad),
    selectedBackground: Color(0xff2a2a27),
    bandBackground: Color(0xff7a1f1f),
    onBand: Color(0xffffffff),
    onBandMuted: Color(0xfff1dcd8),
    bandAvatarBackground: Color(0xff551919),
    focus: Color(0xffe7b3ad),
    focusOnBand: Color(0xffffffff),
    disabledForeground: Color(0xffa4a49f),
    disabledBackground: Color(0xff2a2a27),
    success: AppStatusColors(
      foreground: Color(0xffbbdcc6),
      background: Color(0xff21362a),
    ),
    warning: AppStatusColors(
      foreground: Color(0xffeacd97),
      background: Color(0xff3d321d),
    ),
    danger: AppStatusColors(
      foreground: Color(0xfff0bbb5),
      background: Color(0xff422927),
    ),
    info: AppStatusColors(
      foreground: Color(0xffb7d3e8),
      background: Color(0xff253440),
    ),
  );
  @override
  AppUiTokens copyWith({
    Color? canvas,
    Color? subtle,
    Color? accent,
    Color? selectedBackground,
    Color? bandBackground,
    Color? onBand,
    Color? onBandMuted,
    Color? bandAvatarBackground,
    Color? focus,
    Color? focusOnBand,
    Color? disabledForeground,
    Color? disabledBackground,
    AppStatusColors? success,
    AppStatusColors? warning,
    AppStatusColors? danger,
    AppStatusColors? info,
    double? pageInset,
    double? badgeRadius,
    double? controlRadius,
    double? groupRadius,
    double? qrRadius,
    double? sheetRadius,
    double? minTapExtent,
    double? buttonMinHeight,
    double? rowMinHeight,
    double? navigationMinHeight,
    double? brandOverlap,
  }) => AppUiTokens(
    canvas: canvas ?? this.canvas,
    subtle: subtle ?? this.subtle,
    accent: accent ?? this.accent,
    selectedBackground: selectedBackground ?? this.selectedBackground,
    bandBackground: bandBackground ?? this.bandBackground,
    onBand: onBand ?? this.onBand,
    onBandMuted: onBandMuted ?? this.onBandMuted,
    bandAvatarBackground: bandAvatarBackground ?? this.bandAvatarBackground,
    focus: focus ?? this.focus,
    focusOnBand: focusOnBand ?? this.focusOnBand,
    disabledForeground: disabledForeground ?? this.disabledForeground,
    disabledBackground: disabledBackground ?? this.disabledBackground,
    success: success ?? this.success,
    warning: warning ?? this.warning,
    danger: danger ?? this.danger,
    info: info ?? this.info,
    pageInset: pageInset ?? this.pageInset,
    badgeRadius: badgeRadius ?? this.badgeRadius,
    controlRadius: controlRadius ?? this.controlRadius,
    groupRadius: groupRadius ?? this.groupRadius,
    qrRadius: qrRadius ?? this.qrRadius,
    sheetRadius: sheetRadius ?? this.sheetRadius,
    minTapExtent: minTapExtent ?? this.minTapExtent,
    buttonMinHeight: buttonMinHeight ?? this.buttonMinHeight,
    rowMinHeight: rowMinHeight ?? this.rowMinHeight,
    navigationMinHeight: navigationMinHeight ?? this.navigationMinHeight,
    brandOverlap: brandOverlap ?? this.brandOverlap,
  );
  @override
  AppUiTokens lerp(covariant AppUiTokens? other, double t) {
    if (other == null) return this;
    return AppUiTokens(
      canvas: Color.lerp(canvas, other.canvas, t)!,
      subtle: Color.lerp(subtle, other.subtle, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      selectedBackground: Color.lerp(
        selectedBackground,
        other.selectedBackground,
        t,
      )!,
      bandBackground: Color.lerp(bandBackground, other.bandBackground, t)!,
      onBand: Color.lerp(onBand, other.onBand, t)!,
      onBandMuted: Color.lerp(onBandMuted, other.onBandMuted, t)!,
      bandAvatarBackground: Color.lerp(
        bandAvatarBackground,
        other.bandAvatarBackground,
        t,
      )!,
      focus: Color.lerp(focus, other.focus, t)!,
      focusOnBand: Color.lerp(focusOnBand, other.focusOnBand, t)!,
      disabledForeground: Color.lerp(
        disabledForeground,
        other.disabledForeground,
        t,
      )!,
      disabledBackground: Color.lerp(
        disabledBackground,
        other.disabledBackground,
        t,
      )!,
      success: AppStatusColors.lerp(success, other.success, t),
      warning: AppStatusColors.lerp(warning, other.warning, t),
      danger: AppStatusColors.lerp(danger, other.danger, t),
      info: AppStatusColors.lerp(info, other.info, t),
      pageInset: lerpDouble(pageInset, other.pageInset, t)!,
      badgeRadius: lerpDouble(badgeRadius, other.badgeRadius, t)!,
      controlRadius: lerpDouble(controlRadius, other.controlRadius, t)!,
      groupRadius: lerpDouble(groupRadius, other.groupRadius, t)!,
      qrRadius: lerpDouble(qrRadius, other.qrRadius, t)!,
      sheetRadius: lerpDouble(sheetRadius, other.sheetRadius, t)!,
      minTapExtent: lerpDouble(minTapExtent, other.minTapExtent, t)!,
      buttonMinHeight: lerpDouble(buttonMinHeight, other.buttonMinHeight, t)!,
      rowMinHeight: lerpDouble(rowMinHeight, other.rowMinHeight, t)!,
      navigationMinHeight: lerpDouble(
        navigationMinHeight,
        other.navigationMinHeight,
        t,
      )!,
      brandOverlap: lerpDouble(brandOverlap, other.brandOverlap, t)!,
    );
  }
}

/// The kit reflows content after 130% scaling without reducing the text size.
bool isLargeText(BuildContext context) =>
    MediaQuery.textScalerOf(context).scale(16) > 20.8;
