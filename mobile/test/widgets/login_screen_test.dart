import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/repositories/auth_repository.dart';
import 'package:ngsplusapp/screens/auth/login_screen.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:provider/provider.dart';

import '../auth_fakes.dart';

Widget wrapLogin(
  AuthProvider auth, {
  Locale locale = const Locale('tr'),
  Brightness brightness = Brightness.light,
  double textScale = 1,
}) => MaterialApp(
  theme: brightness == Brightness.dark
      ? AppTheme.darkTheme
      : AppTheme.lightTheme,
  builder: (context, child) => MediaQuery(
    data: MediaQuery.of(
      context,
    ).copyWith(textScaler: TextScaler.linear(textScale)),
    child: child ?? const SizedBox.shrink(),
  ),
  locale: locale,
  supportedLocales: AppLocalizations.supportedLocales,
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  home: ChangeNotifierProvider<AuthProvider>.value(
    value: auth,
    child: const LoginScreen(),
  ),
);

void main() {
  late FakeAuthRepository repo;
  late FakeSessionStore store;
  late AuthProvider auth;
  setUp(() {
    repo = FakeAuthRepository();
    store = FakeSessionStore();
  });
  tearDown(() => auth.dispose());

  Future<void> mount(
    WidgetTester tester, {
    Locale locale = const Locale('tr'),
    Size size = const Size(720, 1600),
    Brightness brightness = Brightness.light,
    double textScale = 1,
    double keyboardHeight = 0,
  }) async {
    // Create async owners in testWidgets' fake-async zone. A Future created in
    // setUp belongs to the outer zone and cannot be advanced by tester.pump.
    auth = AuthProvider(repository: repo, sessionStore: store);
    tester.view.physicalSize = size;
    tester.view.viewInsets = FakeViewPadding(bottom: keyboardHeight);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetViewInsets);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      wrapLogin(
        auth,
        locale: locale,
        brightness: brightness,
        textScale: textScale,
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> enterCredentials(WidgetTester tester) async {
    await tester.enterText(find.byType(TextFormField).at(0), 'a@example.test');
    await tester.enterText(find.byType(TextFormField).at(1), 'test-password');
  }

  testWidgets('empty email and password show validation errors', (
    tester,
  ) async {
    await mount(tester);
    await tester.tap(find.byType(ElevatedButton));
    await tester.pump();
    expect(find.text('E-posta adresinizi girin'), findsOneWidget);
    expect(find.text('Şifrenizi girin'), findsOneWidget);
    expect(repo.signInCalls, 0);
  });

  testWidgets('invalid email and short password do not submit', (tester) async {
    await mount(tester);
    await tester.enterText(find.byType(TextFormField).at(0), 'invalid');
    await tester.enterText(find.byType(TextFormField).at(1), '123');
    await tester.tap(find.byType(ElevatedButton));
    await tester.pump();
    expect(find.text('Geçerli bir e-posta adresi girin'), findsOneWidget);
    expect(find.text('Şifre en az 6 karakter olmalı'), findsOneWidget);
    expect(repo.signInCalls, 0);
  });

  testWidgets(
    'remembered user fills only email and clearly labels the option',
    (tester) async {
      store.email = 'saved@example.test';
      await mount(tester);
      final fields = tester
          .widgetList<TextFormField>(find.byType(TextFormField))
          .toList();
      expect(fields.first.controller?.text, 'saved@example.test');
      expect(fields.last.controller?.text, isEmpty);
      expect(find.text('E-postamı hatırla'), findsOneWidget);
    },
  );

  testWidgets('late remembered email cannot replace user input', (
    tester,
  ) async {
    final remembered = Completer<String?>();
    store.onReadRememberedEmail = () => remembered.future;
    await mount(tester);
    await tester.enterText(
      find.byType(TextFormField).first,
      'edited@example.test',
    );
    remembered.complete('previous@example.test');
    await tester.pumpAndSettle();
    final fields = tester
        .widgetList<TextFormField>(find.byType(TextFormField))
        .toList();
    expect(fields.first.controller?.text, 'edited@example.test');
    expect(fields.last.controller?.text, isEmpty);
    expect(repo.signInCalls, 0);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'late remembered email is ignored after login screen is removed',
    (tester) async {
      final remembered = Completer<String?>();
      store.onReadRememberedEmail = () => remembered.future;
      await mount(tester);
      await tester.pumpWidget(const MaterialApp(home: SizedBox()));
      remembered.complete('previous@example.test');
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(auth.isAuthenticated, isFalse);
      expect(repo.signInCalls, 0);
    },
  );

  testWidgets('failed login shows localized error and enables retry', (
    tester,
  ) async {
    repo.onSignIn = (email, password) async => throw const BusinessError(
      message: 'E-posta veya şifre hatalı',
      code: 'INVALID_CREDENTIALS',
    );
    await mount(tester);
    await enterCredentials(tester);
    await tester.tap(find.byType(ElevatedButton));
    await tester.pumpAndSettle();
    expect(find.byType(SnackBar), findsOneWidget);
    expect(find.text('E-posta veya şifre hatalı'), findsOneWidget);
    expect(
      tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed,
      isNotNull,
    );
  });

  testWidgets(
    'submit disables while pending and repeated tap does not duplicate login',
    (tester) async {
      final reply = Completer<SignInResult>();
      repo.onSignIn = (email, password) => reply.future;
      await mount(tester);
      await enterCredentials(tester);
      await tester.tap(find.byType(ElevatedButton));
      await tester.pump();
      expect(
        tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed,
        isNull,
      );
      expect(
        tester.widget<IconButton>(find.byType(IconButton)).onPressed,
        isNull,
      );
      expect(
        tester
            .widget<CheckboxListTile>(find.byType(CheckboxListTile))
            .onChanged,
        isNull,
      );
      expect(
        tester.widget<TextButton>(find.byType(TextButton)).onPressed,
        isNull,
      );
      expect(
        tester
            .widgetList<TextFormField>(find.byType(TextFormField))
            .every((field) => !field.enabled),
        isTrue,
      );
      await tester.tap(find.byType(ElevatedButton));
      await tester.pump();
      expect(repo.signInCalls, 1);
      reply.complete(authResult());
      await tester.pumpAndSettle();
      expect(auth.isAuthenticated, isTrue);
      expect(
        tester
            .widgetList<TextFormField>(find.byType(TextFormField))
            .last
            .controller
            ?.text,
        isEmpty,
      );
    },
  );

  testWidgets('disposed login screen never reads controllers after success', (
    tester,
  ) async {
    final reply = Completer<SignInResult>();
    repo.onSignIn = (email, password) => reply.future;
    await mount(tester);
    await enterCredentials(tester);
    await tester.tap(find.byType(ElevatedButton));
    await tester.pump();
    await tester.pumpWidget(const MaterialApp(home: SizedBox()));
    reply.complete(authResult());
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(auth.isAuthenticated, isTrue);
  });

  testWidgets('English remember option states email scope', (tester) async {
    await mount(tester, locale: const Locale('en'));
    expect(find.text('Remember my email'), findsOneWidget);
  });

  testWidgets('password visibility toggles without changing credentials', (
    tester,
  ) async {
    await mount(tester);
    await enterCredentials(tester);
    final password = find.byType(TextField).last;
    expect(tester.widget<TextField>(password).obscureText, isTrue);
    await tester.tap(find.byTooltip('Şifreyi göster'));
    await tester.pumpAndSettle();
    expect(tester.widget<TextField>(password).obscureText, isFalse);
    expect(
      tester.widget<TextField>(password).controller?.text,
      'test-password',
    );
    await tester.tap(find.byTooltip('Şifreyi gizle'));
    await tester.pumpAndSettle();
    expect(tester.widget<TextField>(password).obscureText, isTrue);
    expect(repo.signInCalls, 0);
  });

  for (final locale in const [Locale('tr'), Locale('en')]) {
    testWidgets(
      'small screen with keyboard and large ${locale.languageCode} text remains usable',
      (tester) async {
        await mount(
          tester,
          locale: locale,
          size: const Size(320, 568),
          brightness: Brightness.dark,
          textScale: 2,
          keyboardHeight: 260,
        );
        expect(tester.takeException(), isNull);
        final password = find.byType(TextFormField).last;
        await tester.ensureVisible(password);
        await tester.enterText(password, 'test-password');
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.ensureVisible(find.byType(CheckboxListTile));
        await tester.tap(find.byType(CheckboxListTile));
        await tester.pumpAndSettle();
        expect(
          tester.widget<CheckboxListTile>(find.byType(CheckboxListTile)).value,
          isTrue,
        );
        await tester.ensureVisible(find.byType(ElevatedButton));
        await tester.tap(find.byType(ElevatedButton));
        await tester.pumpAndSettle();
        expect(
          find.text(
            locale.languageCode == 'tr'
                ? 'E-posta adresinizi girin'
                : 'Please enter your email address',
          ),
          findsOneWidget,
        );
        expect(repo.signInCalls, 0);
        await tester.ensureVisible(find.byType(TextButton));
        expect(
          tester.getRect(find.byType(TextButton)).bottom,
          lessThanOrEqualTo(568 - 260),
        );
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('login controls meet Android touch target guidelines', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    try {
      await mount(tester, size: const Size(390, 844));
      expect(tester.takeException(), isNull);
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    } finally {
      semantics.dispose();
    }
  });
}
