import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:ngsplusapp/config/convex_config.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/screens/auth/login_screen.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../helpers/mocks.dart';

Widget wrapLogin(AuthProvider auth) {
  return MaterialApp(
    locale: const Locale('tr'),
    supportedLocales: AppLocalizations.supportedLocales,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    home: ChangeNotifierProvider<AuthProvider>.value(
      value: auth,
      child: const LoginScreen(),
    ),
  );
}

void main() {
  late MockAuthRepository repo;
  late AuthProvider auth;

  setUpAll(() {
    registerCommonFallbacks();
    SharedPreferences.setMockInitialValues({});
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await ConvexConfig.initialize();
    repo = MockAuthRepository();
    auth = AuthProvider(repository: repo);
  });

  Future<void> setupLargeViewport(WidgetTester tester) async {
    tester.view.physicalSize = const Size(720, 1600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  testWidgets('boş email ile validation hatası gösterir', (tester) async {
    await setupLargeViewport(tester);
    await tester.pumpWidget(wrapLogin(auth));
    await tester.pumpAndSettle();

    final submit = find.byType(ElevatedButton);
    expect(submit, findsOneWidget);
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await tester.pump();

    expect(find.text('E-posta adresinizi girin'), findsOneWidget);
    expect(find.text('Şifrenizi girin'), findsOneWidget);
  });

  testWidgets('geçersiz email format hatası gösterir', (tester) async {
    await setupLargeViewport(tester);
    await tester.pumpWidget(wrapLogin(auth));
    await tester.pumpAndSettle();

    final emailField = find.widgetWithText(TextFormField, 'E-posta');
    final pwField = find.widgetWithText(TextFormField, 'Şifre');

    await tester.enterText(emailField, 'gecersiz');
    await tester.enterText(pwField, '123456');

    final submit = find.byType(ElevatedButton);
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await tester.pump();

    expect(find.text('Geçerli bir e-posta adresi girin'), findsOneWidget);
  });

  testWidgets('kısa şifre hatası gösterir', (tester) async {
    await setupLargeViewport(tester);
    await tester.pumpWidget(wrapLogin(auth));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextFormField, 'E-posta'),
      'a@b.c',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Şifre'),
      '123',
    );

    final submit = find.byType(ElevatedButton);
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await tester.pump();

    expect(find.text('Şifre en az 6 karakter olmalı'), findsOneWidget);
  });

  testWidgets('signIn başarısız olunca SnackBar gösterir', (tester) async {
    await setupLargeViewport(tester);
    when(() => repo.signIn(
          email: any(named: 'email'),
          password: any(named: 'password'),
        )).thenThrow(const BusinessError(message: 'E-posta veya şifre hatalı'));

    await tester.pumpWidget(wrapLogin(auth));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextFormField, 'E-posta'),
      'a@b.c',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Şifre'),
      'secret123',
    );

    final submit = find.byType(ElevatedButton);
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await tester.pumpAndSettle();

    expect(find.byType(SnackBar), findsOneWidget);
    expect(find.text('E-posta veya şifre hatalı'), findsOneWidget);
  });
}
