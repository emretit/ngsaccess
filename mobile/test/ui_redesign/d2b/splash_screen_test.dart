import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/screens/splash_screen.dart';
import 'package:ngsplusapp/theme/app_theme.dart';

void main() {
  for (final dark in [false, true]) {
    for (final language in [dark ? 'en' : 'tr']) {
      testWidgets('startup failure actions $dark $language at 200 percent', (
        tester,
      ) async {
        tester.view.physicalSize = const Size(320, 568);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        var retries = 0;
        var logins = 0;
        await tester.pumpWidget(
          MaterialApp(
            theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
            locale: Locale(language),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(2)),
              child: child ?? const SizedBox(),
            ),
            home: SplashScreen(
              isFailure: true,
              onRetry: () => retries++,
              onUseLogin: () => logins++,
            ),
          ),
        );
        await tester.pumpAndSettle();
        final l10n = AppLocalizations.of(
          tester.element(find.byType(SplashScreen)),
        );
        expect(find.text(l10n.startupBandTitle), findsNothing);
        expect(find.text(l10n.startupFailureTitle), findsOneWidget);
        expect(find.byType(CircularProgressIndicator), findsNothing);
        await tester.ensureVisible(find.text(l10n.startupRetry));
        await tester.tap(find.text(l10n.startupRetry));
        await tester.ensureVisible(find.text(l10n.startupUseLogin));
        await tester.tap(find.text(l10n.startupUseLogin));
        expect(retries, 1);
        expect(logins, 1);
        expect(tester.takeException(), isNull);
      });
    }
  }
}
