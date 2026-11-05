import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/repositories/auth_repository.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import '../auth_fakes.dart';
import 'package:ngsplusapp/widgets/brand_mark.dart';
import '../helpers/login_app.dart';

void main() {
  group('login screen', () {
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
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'a@example.test',
      );
      await tester.enterText(find.byType(TextFormField).at(1), 'test-password');
    }

    testWidgets(
      'restored remember row and centered password help have 48dp targets',
      (tester) async {
        await mount(tester, size: const Size(390, 844));
        final row = find.byType(CheckboxListTile);
        final checkbox = find.descendant(
          of: row,
          matching: find.byType(Checkbox),
        );
        expect(checkbox, findsOneWidget);
        final title = find.text('E-postamı hatırla');
        final fieldLeft = tester.getRect(find.byType(TextFormField).first).left;
        expect(tester.getRect(row).height, greaterThanOrEqualTo(48));
        expect(tester.getRect(row).left, closeTo(fieldLeft, 1));
        expect(tester.getRect(title).left - fieldLeft, closeTo(56, 1));
        expect(
          tester.getRect(find.text('Şifre yardımı')).center.dx,
          closeTo(tester.getRect(find.byType(FilledButton)).center.dx, 1),
        );
        expect(
          tester.getRect(find.byType(TextButton)).height,
          greaterThanOrEqualTo(48),
        );
      },
    );

    testWidgets('empty email and password show validation errors', (
      tester,
    ) async {
      await mount(tester);
      await tester.tap(find.byType(FilledButton));
      await tester.pump();
      expect(find.text('E-posta adresinizi girin'), findsOneWidget);
      expect(find.text('Şifrenizi girin'), findsOneWidget);
      expect(repo.signInCalls, 0);
    });

    testWidgets('invalid email and short password do not submit', (
      tester,
    ) async {
      await mount(tester);
      await tester.enterText(find.byType(TextFormField).at(0), 'invalid');
      await tester.enterText(find.byType(TextFormField).at(1), '123');
      await tester.tap(find.byType(FilledButton));
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
      await tester.tap(find.byType(FilledButton));
      await tester.pumpAndSettle();
      expect(find.byType(AppDataNotice), findsOneWidget);
      expect(find.text('E-posta veya şifre hatalı'), findsOneWidget);
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
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
        await tester.tap(find.byType(FilledButton));
        await tester.pump();
        expect(
          tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
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
        await tester.tap(find.byType(FilledButton));
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
      await tester.tap(find.byType(FilledButton));
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
            tester
                .widget<CheckboxListTile>(find.byType(CheckboxListTile))
                .value,
            isTrue,
          );
          await tester.ensureVisible(find.byType(FilledButton));
          await tester.tap(find.byType(FilledButton));
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
  });
  group('login focus feedback', () {
    testWidgets('restored login retains first-invalid-field and next focus', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final repo = FakeAuthRepository();
      final auth = AuthProvider(
        repository: repo,
        sessionStore: FakeSessionStore(),
      );
      addTearDown(auth.dispose);
      await tester.pumpWidget(wrapLogin(auth));
      await tester.pumpAndSettle();
      expect(find.text('Hoş geldiniz!'), findsOneWidget);
      expect(tester.getSize(find.byType(BrandMark)), const Size(44, 44));
      final email = find.byKey(const ValueKey('login-email'));
      final password = find.byKey(const ValueKey('login-password'));
      final submit = find.byKey(const ValueKey('login-submit'));
      expect(
        tester.getRect(email).top,
        greaterThan(tester.getRect(find.text('Hoş geldiniz!')).bottom),
      );
      await tester.tap(submit);
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<TextField>(
              find.descendant(of: email, matching: find.byType(TextField)),
            )
            .focusNode
            ?.hasFocus,
        isTrue,
      );
      await tester.enterText(email, 'a@example.test');
      await tester.testTextInput.receiveAction(TextInputAction.next);
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<TextField>(
              find.descendant(of: password, matching: find.byType(TextField)),
            )
            .focusNode
            ?.hasFocus,
        isTrue,
      );
      await tester.ensureVisible(submit);
      await tester.tap(submit);
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<TextField>(
              find.descendant(of: password, matching: find.byType(TextField)),
            )
            .focusNode
            ?.hasFocus,
        isTrue,
      );
      expect(repo.signInCalls, 0);
      expect(tester.takeException(), isNull);
    });
  });
}
