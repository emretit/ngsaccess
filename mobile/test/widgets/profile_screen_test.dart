import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/core/safe_diagnostics.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/locale_provider.dart';
import 'package:ngsplusapp/providers/preferred_device_provider.dart';
import 'package:ngsplusapp/providers/theme_provider.dart';
import 'package:ngsplusapp/screens/profile/profile_screen.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';

import '../auth_fakes.dart';
import '../helpers/preference_store.dart';

void main() {
  late TestPreferences prefs;
  late FakeAuthRepository repository;
  late AuthProvider auth;
  late LocaleProvider locale;
  late ThemeProvider theme;
  late PreferredDeviceProvider preferred;
  Future<void> prepare() async {
    prefs = TestPreferences();
    repository = FakeAuthRepository();
    auth = AuthProvider(
      repository: repository,
      sessionStore: FakeSessionStore(),
    );
    locale = LocaleProvider(preferencesLoader: () async => prefs);
    theme = ThemeProvider(preferencesLoader: () async => prefs);
    preferred = PreferredDeviceProvider(preferencesLoader: () async => prefs);
    await auth.signIn('a@example.test', 'test-old-password');
    await preferred.setIdentity(
      'employee-a',
      projectId: 'project-a',
      deployment: 'fixture',
    );
  }

  tearDown(() {
    auth.dispose();
    locale.dispose();
    theme.dispose();
    preferred.dispose();
  });

  Future<void> mount(
    WidgetTester tester, {
    String language = 'en',
    double scale = 1,
    bool dark = false,
    bool metadataFails = false,
    SafeDiagnostics? diagnostics,
  }) async {
    tester.view.physicalSize = const Size(400, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await locale.setLocale(Locale(language));
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthProvider>.value(value: auth),
          ChangeNotifierProvider<LocaleProvider>.value(value: locale),
          ChangeNotifierProvider<ThemeProvider>.value(value: theme),
          ChangeNotifierProvider<PreferredDeviceProvider>.value(
            value: preferred,
          ),
        ],
        child: Consumer<LocaleProvider>(
          builder: (context, provider, _) => MaterialApp(
            locale: provider.locale,
            supportedLocales: AppLocalizations.supportedLocales,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            theme: ThemeData(
              brightness: dark ? Brightness.dark : Brightness.light,
            ),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(scale)),
              child: child ?? const SizedBox.shrink(),
            ),
            home: ProfileScreen(
              diagnostics: diagnostics,
              packageInfoLoader: () async {
                if (metadataFails) {
                  throw StateError('fixture metadata unavailable');
                }
                return PackageInfo(
                  appName: 'NGS Plus',
                  packageName: 'test.fixture',
                  version: '2.7.9',
                  buildNumber: '83',
                );
              },
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> openSecurity(WidgetTester tester) async {
    await tester.ensureVisible(find.text('Security'));
    await tester.tap(find.text('Security'));
    await tester.pumpAndSettle();
  }

  Future<void> fillPasswords(
    WidgetTester tester, {
    String next = 'A-safe-new-password1',
    String repeat = 'A-safe-new-password1',
  }) async {
    await tester.enterText(
      find.byType(TextFormField).at(0),
      'test-old-password',
    );
    await tester.enterText(find.byType(TextFormField).at(1), next);
    await tester.enterText(find.byType(TextFormField).at(2), repeat);
    await tester.ensureVisible(
      find.widgetWithText(FilledButton, 'Change password'),
    );
  }

  testWidgets(
    'language picker changes the live profile and saves the selected locale',
    (tester) async {
      await prepare();
      await mount(tester, language: 'tr');
      await tester.ensureVisible(find.text('Dil'));
      await tester.tap(find.text('Dil'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('İngilizce'));
      await tester.pumpAndSettle();
      expect(find.text('Language'), findsOneWidget);
      expect(locale.locale, const Locale('en'));
      expect(prefs.values['mobile_locale'], 'en');
    },
  );

  testWidgets('failed theme save keeps the picker open with localized error', (
    tester,
  ) async {
    await prepare();
    await mount(tester);
    prefs.rejectedWrites.add(prefs.writes.length + 1);
    await tester.ensureVisible(find.text('Theme'));
    await tester.tap(find.text('Theme'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Dark theme'));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsOneWidget);
    expect(
      find.text('Could not save your preference. Please try again.'),
      findsOneWidget,
    );
    expect(theme.themeMode, ThemeMode.light);
  });

  for (final language in ['en', 'tr']) {
    testWidgets(
      'runtime version is consistent in profile and About ($language)',
      (tester) async {
        await prepare();
        await mount(tester, language: language);
        final label = language == 'tr'
            ? 'Sürüm 2.7.9 (derleme 83)'
            : 'Version 2.7.9 (build 83)';
        expect(find.text(label), findsOneWidget);
        final title = language == 'tr' ? 'Uygulama Hakkında' : 'About the App';
        await tester.ensureVisible(find.text(title));
        await tester.tap(find.text(title));
        await tester.pumpAndSettle();
        expect(find.text(label), findsOneWidget);
        expect(find.textContaining('1.0.0'), findsNothing);
      },
    );
  }

  testWidgets('metadata failure has an honest fallback', (tester) async {
    await prepare();
    await mount(tester, metadataFails: true);
    expect(find.text('Version information unavailable'), findsOneWidget);
    expect(find.textContaining('1.0.0'), findsNothing);
  });

  testWidgets(
    'password validation blocks mismatched and oversized Unicode input',
    (tester) async {
      await prepare();
      await mount(tester);
      await openSecurity(tester);
      await fillPasswords(
        tester,
        next: 'A-safe-new-password1',
        repeat: 'different-password',
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Change password'));
      await tester.pumpAndSettle();
      expect(repository.passwordChangeCalls, 0);
      await fillPasswords(
        tester,
        next: 'Aa1${List.filled(18, '🔒').join()}',
        repeat: 'Aa1${List.filled(18, '🔒').join()}',
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Change password'));
      await tester.pumpAndSettle();
      expect(repository.passwordChangeCalls, 0);
      expect(
        find.text(
          'Check the password rules and that both new passwords match.',
        ),
        findsWidgets,
      );
    },
  );

  testWidgets('real password change calls backend wrapper and ends session', (
    tester,
  ) async {
    await prepare();
    await mount(tester);
    await openSecurity(tester);
    await fillPasswords(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Change password'));
    await tester.pumpAndSettle();
    expect(repository.passwordChangeCalls, 1);
    expect(auth.isAuthenticated, isFalse);
    expect(
      find.text('Password changed. Sign in with your new password.'),
      findsOneWidget,
    );
  });

  testWidgets('password failure remains on form with localized safe error', (
    tester,
  ) async {
    await prepare();
    repository.onChangePassword = (_, _) async => throw const BusinessError(
      message: 'untrusted fixture detail',
      code: 'INVALID_CREDENTIALS',
    );
    await mount(tester);
    await openSecurity(tester);
    await fillPasswords(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Change password'));
    await tester.pumpAndSettle();
    expect(auth.isAuthenticated, isTrue);
    expect(find.text('Invalid email or password'), findsOneWidget);
    expect(find.textContaining('untrusted fixture'), findsNothing);
  });

  testWidgets('help and privacy remain readable at large text in dark theme', (
    tester,
  ) async {
    await prepare();
    await mount(tester, scale: 2, dark: true);
    expect(tester.takeException(), isNull);
    await tester.tap(find.byTooltip('Help & Support'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Door selection'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Privacy information'));
    await tester.tap(find.text('Privacy information'));
    await tester.pumpAndSettle();
    expect(find.textContaining('does not replace'), findsOneWidget);
    expect(find.textContaining('not configured'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('already open help follows a runtime locale change', (
    tester,
  ) async {
    await prepare();
    await mount(tester);
    await tester.tap(find.byTooltip('Help & Support'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Door selection'), findsOneWidget);
    await locale.setLocale(const Locale('tr'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Kapı seçimi'), findsOneWidget);
    expect(find.textContaining('Door selection'), findsNothing);
  });

  for (final language in ['en', 'tr']) {
    testWidgets(
      'support export is explicitly copied and local log clears ($language)',
      (tester) async {
        await prepare();
        final diagnostics = SafeDiagnostics();
        diagnostics.record(
          const ServerError(
            statusCode: 503,
            body: 'sensitive-token-qr@example.test',
          ),
          operation: DiagnosticOperation.query,
          stack: StackTrace.fromString(
            '#0 secret (package:ngsplusapp/main.dart:2:3)',
          ),
        );
        final copies = <String>[];
        tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          (call) async {
            if (call.method == 'Clipboard.setData') {
              final arguments = call.arguments as Map<Object?, Object?>;
              copies.add(arguments['text'] as String);
            }
            return null;
          },
        );
        addTearDown(
          () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
            SystemChannels.platform,
            null,
          ),
        );
        await mount(
          tester,
          language: language,
          diagnostics: diagnostics,
          scale: 2,
          dark: true,
        );
        await tester.tap(
          find.byTooltip(
            language == 'tr' ? 'Yardım & Destek' : 'Help & Support',
          ),
        );
        await tester.pumpAndSettle();
        expect(copies, isEmpty);
        final l10n = AppLocalizations.of(
          tester.element(find.byType(Scaffold).last),
        );
        expect(find.text(l10n.profileDiagnosticsBody), findsOneWidget);
        await tester.ensureVisible(find.text(l10n.profileDiagnosticsCopy));
        await tester.tap(find.text(l10n.profileDiagnosticsCopy));
        await tester.pumpAndSettle();
        expect(copies, hasLength(1));
        expect(copies.single, isNot(contains('sensitive-token')));
        final report = jsonDecode(copies.single) as Map<String, Object?>;
        expect(report['schemaVersion'], 1);
        expect(report['events'], hasLength(1));
        expect(find.text(l10n.profileDiagnosticsCopied), findsOneWidget);
        await tester.ensureVisible(find.text(l10n.profileDiagnosticsClear));
        expect(
          find.text(l10n.profileDiagnosticsClear).hitTestable(),
          findsOneWidget,
          reason: 'Support feedback must not cover Clear at large text sizes',
        );
        await tester.tap(find.text(l10n.profileDiagnosticsClear));
        await tester.pumpAndSettle();
        expect(diagnostics.events, isEmpty);
        expect(
          copies,
          hasLength(1),
          reason: 'Clearing memory must not silently replace clipboard data',
        );
        expect(find.text(l10n.profileDiagnosticsEmpty), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets(
    'clipboard rejection has a safe localized failure and keeps local evidence',
    (tester) async {
      await prepare();
      final diagnostics = SafeDiagnostics();
      diagnostics.record(
        const TimeoutError(),
        operation: DiagnosticOperation.query,
      );
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData') {
            throw PlatformException(
              code: 'sensitive-platform-token',
              message: 'private-marker',
            );
          }
          return null;
        },
      );
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        ),
      );
      await mount(tester, diagnostics: diagnostics);
      await tester.tap(find.byTooltip('Help & Support'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Copy support report'));
      await tester.tap(find.text('Copy support report'));
      await tester.pumpAndSettle();
      expect(
        find.text('Could not copy the report. Please try again.'),
        findsOneWidget,
      );
      expect(find.textContaining('private-marker'), findsNothing);
      expect(find.textContaining('sensitive-platform-token'), findsNothing);
      expect(diagnostics.events, hasLength(1));
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'leaving Help during clipboard operation does not update a disposed widget',
    (tester) async {
      await prepare();
      final pending = Completer<Object?>();
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          return call.method == 'Clipboard.setData' ? pending.future : null;
        },
      );
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        ),
      );
      await mount(tester, diagnostics: SafeDiagnostics());
      await tester.tap(find.byTooltip('Help & Support'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Copy support report'));
      await tester.tap(find.text('Copy support report'));
      await tester.pump();
      await tester.pageBack();
      await tester.pumpAndSettle();
      pending.complete(null);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(
        find.text(
          'Support report copied. Share it only with your organization’s support team.',
        ),
        findsNothing,
      );
    },
  );
}
