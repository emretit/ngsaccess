import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/ui/app_ui_tokens.dart';
import 'app_theme_test.dart' show contrast;

void main() {
  test(
    'theme transitions interpolate every semantic pair and layout dimensions',
    () {
      final a = AppUiTokens.light;
      final b = AppUiTokens.dark.copyWith(pageInset: 24, brandOverlap: 40);
      final mid = a.lerp(b, .5);
      for (final tone in AppStatusTone.values) {
        expect(
          mid.status(tone).foreground,
          Color.lerp(a.status(tone).foreground, b.status(tone).foreground, .5),
        );
        expect(
          mid.status(tone).background,
          Color.lerp(a.status(tone).background, b.status(tone).background, .5),
        );
      }
      expect(mid.pageInset, 22);
      expect(mid.brandOverlap, 36);
      expect(a.lerp(null, .5), same(a));
      expect(a.copyWith().accent, a.accent);
      expect(a.copyWith(accent: Colors.blue).canvas, a.canvas);
    },
  );
  for (final theme in [AppTheme.lightTheme, AppTheme.darkTheme]) {
    test(
      '${theme.brightness} focus and controls remain visible; selected containers are neutral',
      () {
        final t = theme.extension<AppUiTokens>()!;
        final c = theme.colorScheme;
        expect(contrast(t.focus, t.canvas), greaterThanOrEqualTo(3));
        expect(contrast(c.outline, c.surface), greaterThanOrEqualTo(3));
        expect(
          contrast(t.accent, t.selectedBackground),
          greaterThanOrEqualTo(4.5),
        );
        expect(
          contrast(t.onBandMuted, t.bandBackground),
          greaterThanOrEqualTo(4.5),
        );
        for (final color in [
          c.surface,
          c.surfaceContainer,
          c.surfaceContainerLow,
          c.surfaceContainerHigh,
          c.surfaceContainerHighest,
          t.selectedBackground,
        ]) {
          expect((color.r - color.g).abs(), lessThan(.015));
        }
        expect(theme.cardTheme.elevation, 0);
        expect(c.surfaceTint, Colors.transparent);
        final side = theme.filledButtonTheme.style?.side?.resolve({});
        if (theme.brightness == Brightness.dark) {
          expect(side?.color, t.accent);
          expect(side?.width, 1);
        }
        for (final style in [
          theme.filledButtonTheme.style,
          theme.outlinedButtonTheme.style,
          theme.textButtonTheme.style,
        ]) {
          expect(
            style?.foregroundColor?.resolve({WidgetState.disabled}),
            t.disabledForeground,
          );
        }
      },
    );
  }
  testWidgets('tokens cannot silently fall back when extension is missing', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            expect(() => AppUiTokens.of(context), throwsStateError);
            return const SizedBox();
          },
        ),
      ),
    );
  });
}
