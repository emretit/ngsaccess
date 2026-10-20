import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/theme/app_theme.dart';

double contrast(Color foreground, Color background) {
  final first = foreground.computeLuminance();
  final second = background.computeLuminance();
  return (math.max(first, second) + .05) / (math.min(first, second) + .05);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  for (final brightness in Brightness.values) {
    test(
      '$brightness status text has readable foreground/background pairs',
      () {
        for (final tone in AppStatusTone.values) {
          final colors = AppTheme.statusColorsFor(brightness, tone);
          expect(
            contrast(colors.foreground, colors.background),
            greaterThanOrEqualTo(4.5),
            reason: '$tone in $brightness',
          );
        }
      },
    );
    test('$brightness button and card text use readable theme colors', () {
      final theme = brightness == Brightness.dark
          ? AppTheme.darkTheme
          : AppTheme.lightTheme;
      final scheme = theme.colorScheme;
      final style = theme.elevatedButtonTheme.style;
      expect(style, isNotNull);
      final foreground = style?.foregroundColor?.resolve({});
      final background = style?.backgroundColor?.resolve({});
      expect(foreground, isNotNull);
      expect(background, isNotNull);
      if (foreground != null && background != null) {
        expect(contrast(foreground, background), greaterThanOrEqualTo(4.5));
      }
      expect(
        contrast(scheme.onSurface, scheme.surface),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrast(scheme.onSurfaceVariant, scheme.surface),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrast(scheme.onPrimaryContainer, scheme.primaryContainer),
        greaterThanOrEqualTo(4.5),
      );
    });
  }
}
