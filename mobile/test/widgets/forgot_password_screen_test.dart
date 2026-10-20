import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/screens/auth/forgot_password_screen.dart';
import 'package:provider/provider.dart';

import '../auth_fakes.dart';

void main() {
  testWidgets(
    'recovery clears stale login error and copies an honest admin request',
    (tester) async {
      final repo = FakeAuthRepository()
        ..onSignIn = (email, password) async => throw const NetworkError();
      final auth = AuthProvider(
        repository: repo,
        sessionStore: FakeSessionStore(),
      );
      addTearDown(auth.dispose);
      await auth.signIn('a@example.test', 'test-password');
      expect(auth.lastError, isNotNull);
      String? copied;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData') {
            final args = call.arguments as Map<Object?, Object?>;
            copied = args['text'] as String?;
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
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('tr'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          home: ChangeNotifierProvider<AuthProvider>.value(
            value: auth,
            child: const ForgotPasswordScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(auth.lastError, isNull);
      expect(find.byType(TextFormField), findsNothing);
      expect(
        find.text('Bu ekran e-posta göndermez veya şifrenizi değiştirmez.'),
        findsOneWidget,
      );
      await tester.ensureVisible(
        find.byWidgetPredicate((widget) => widget is ElevatedButton),
      );
      await tester.tap(
        find.byWidgetPredicate((widget) => widget is ElevatedButton),
      );
      await tester.pumpAndSettle();
      expect(copied, contains('kurulum bağlantısı'));
      expect(
        find.text('Talep kopyalandı. Yöneticinizle paylaşabilirsiniz.'),
        findsOneWidget,
      );
      expect(repo.signInCalls, 1);
    },
  );
}
