import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/locale_provider.dart';
import 'package:ngsplusapp/providers/preferred_device_provider.dart';
import 'package:ngsplusapp/providers/theme_provider.dart';
import 'package:ngsplusapp/screens/profile/profile_screen.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';

import '../../../screenshot_test/_harness.dart'
    show loadAuditFonts, resolveAuditFontFallbacks;
import '../../auth_fakes.dart';
import '../../helpers/preference_store.dart';
import '../../widgets/login_screen_test.dart' show wrapLogin;

const _output = String.fromEnvironment('AUDIT_OUTPUT_DIR');

Future<void> capture(WidgetTester tester, String name) async {
  expect(tester.takeException(), isNull);
  if (_output.isNotEmpty) {
    await resolveAuditFontFallbacks(tester);
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile(Uri.file('$_output/$name.png')),
    );
  }
}

void main() {
  setUpAll(() async {
    if (_output.isNotEmpty) await loadAuditFonts();
  });
  for (final dark in [false, true]) {
    testWidgets('login access closed at 130 percent $dark', (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final repository = FakeAuthRepository()
        ..onSignIn = (_, _) async => throw const EmploymentEndedError();
      final auth = AuthProvider(
        repository: repository,
        sessionStore: FakeSessionStore(),
      );
      addTearDown(auth.dispose);
      await tester.pumpWidget(
        wrapLogin(
          auth,
          brightness: dark ? Brightness.dark : Brightness.light,
          textScale: 1.3,
        ),
      );
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextFormField).first,
        'ayse.yilmaz@example.test',
      );
      await tester.enterText(
        find.byType(TextFormField).last,
        'fixture-password',
      );
      await tester.ensureVisible(find.byKey(const ValueKey('login-submit')));
      await tester.tap(find.byType(FilledButton));
      await tester.pumpAndSettle();
      final l10n = AppLocalizations.of(
        tester.element(find.byType(AppDataNotice)),
      );
      expect(find.text(l10n.errorEmploymentEnded), findsOneWidget);
      expect(
        tester.widget<TextField>(find.byType(TextField).last).obscureText,
        isTrue,
      );
      expect(repository.signInCalls, 1);
      await tester.ensureVisible(find.byType(AppDataNotice));
      await capture(
        tester,
        'd2b_login_access_closed_130_${dark ? 'dark' : 'light'}',
      );
    });

    testWidgets('profile theme sheet selected state $dark', (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final prefs = TestPreferences();
      final theme = ThemeProvider(preferencesLoader: () async => prefs);
      final locale = LocaleProvider(preferencesLoader: () async => prefs);
      final preferred = PreferredDeviceProvider(
        preferencesLoader: () async => prefs,
      );
      final auth = AuthProvider(
        repository: FakeAuthRepository(),
        sessionStore: FakeSessionStore(),
      );
      addTearDown(() {
        auth.dispose();
        theme.dispose();
        locale.dispose();
        preferred.dispose();
      });
      await theme.setThemeMode(dark ? ThemeMode.dark : ThemeMode.light);
      await locale.setLocale(const Locale('tr'));
      await auth.signIn('ayse.yilmaz@example.test', 'fixture-password');
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: auth),
            ChangeNotifierProvider<ThemeProvider>.value(value: theme),
            ChangeNotifierProvider<LocaleProvider>.value(value: locale),
            ChangeNotifierProvider<PreferredDeviceProvider>.value(
              value: preferred,
            ),
          ],
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
            locale: const Locale('tr'),
            supportedLocales: AppLocalizations.supportedLocales,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            home: ProfileScreen(
              packageInfoLoader: () async => PackageInfo(
                appName: 'NGS Plus',
                packageName: 'test',
                version: '2.7.9',
                buildNumber: '83',
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Tema'));
      await tester.pumpAndSettle();
      final selected = tester
          .widgetList<AppListRow>(
            find.descendant(
              of: find.byType(AppSheet),
              matching: find.byType(AppListRow),
            ),
          )
          .where((row) => row.selected);
      expect(selected, hasLength(1));
      final l10n = AppLocalizations.of(tester.element(find.byType(AppSheet)));
      expect(
        selected.single.title,
        dark ? l10n.profileThemeModeDark : l10n.profileThemeModeLight,
      );
      await capture(tester, 'd2b_profile_theme_${dark ? 'dark' : 'light'}');
    });
  }
}
