import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/request_provider.dart';
import 'package:ngsplusapp/screens/requests/requests_screen.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import 'package:provider/provider.dart';
import '../../auth_fakes.dart';
import '../../providers/request_provider_test.dart' show RequestFakeRepository;
import 'layout_states_test.dart' show app;

void main() {
  late AuthProvider auth;
  late RequestProvider provider;
  late RequestFakeRepository repo;
  setUp(() async {
    auth = AuthProvider(
      repository: FakeAuthRepository(),
      sessionStore: FakeSessionStore(),
    );
    await auth.bootstrap();
    await auth.signIn('fixture', 'password');
    repo = RequestFakeRepository();
    provider = RequestProvider(repository: repo)..synchronizeSession(auth);
  });
  tearDown(() {
    provider.dispose();
    auth.dispose();
  });
  Future<void> mount(WidgetTester tester, Widget child) async {
    await tester.pumpWidget(
      ChangeNotifierProvider<RequestProvider>.value(
        value: provider,
        child: app(child, dark: false, scale: 1),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('correction focuses the first invalid reason then missing time', (
    tester,
  ) async {
    await mount(tester, const RequestFormScreen(isLeave: false));
    await tester.tap(find.byKey(const Key('request-submit')));
    await tester.pumpAndSettle();
    final reason = tester.widget<AppTextField>(
      find.byKey(const Key('request-reason')),
    );
    expect(reason.focusNode?.hasFocus, isTrue);
    expect(reason.errorText, 'Gerekçe 5–300 karakter olmalı');
    expect(repo.submits, 0);
    await tester.enterText(
      find.byType(TextField),
      'Geçerli düzeltme gerekçesi',
    );
    await tester.tap(find.byKey(const Key('request-submit')));
    await tester.pumpAndSettle();
    final time = tester.widget<AppTimeField>(
      find.byKey(const Key('request-check-in-time')),
    );
    expect(time.focusNode?.hasFocus, isTrue);
    expect(
      time.errorText,
      'Düzeltme türüne uygun giriş ve çıkış saatlerini belirtin',
    );
    expect(repo.submits, 0);
  });
  testWidgets(
    'busy form blocks back and duplicate callbacks until result reaches list',
    (tester) async {
      await mount(tester, const RequestsScreen());
      await tester.tap(find.text('Yeni talep'));
      await tester.pumpAndSettle();
      final submit = tester
          .widget<AppPrimaryButton>(find.byKey(const Key('request-submit')))
          .onPressed;
      repo.gate = Completer();
      submit?.call();
      submit?.call();
      await tester.pump();
      final form = find.byType(RequestFormScreen);
      expect(repo.submits, 1);
      expect(
        tester
            .widget<AppTextField>(find.byKey(const Key('request-notes')))
            .enabled,
        isFalse,
      );
      expect(
        tester
            .widget<AppPrimaryButton>(find.byKey(const Key('request-submit')))
            .busy,
        isTrue,
      );
      await Navigator.of(tester.element(form)).maybePop();
      await tester.pump();
      expect(form, findsOneWidget);
      repo.gate?.complete('id');
      await tester.pumpAndSettle();
      expect(form, findsNothing);
      expect(find.text('İzin talebi gönderildi'), findsOneWidget);
      expect(repo.submits, 1);
    },
  );
  testWidgets(
    'covered form removes itself after success without popping or notifying another route',
    (tester) async {
      await mount(tester, const RequestsScreen());
      await tester.tap(find.text('Yeni talep'));
      await tester.pumpAndSettle();
      repo.gate = Completer();
      await tester.tap(find.byKey(const Key('request-submit')));
      await tester.pump();
      final navigator = Navigator.of(
        tester.element(find.byType(RequestFormScreen)),
      );
      unawaited(
        navigator.push<void>(
          MaterialPageRoute(
            builder: (_) => const Scaffold(body: Text('Other route')),
          ),
        ),
      );
      await tester.pumpAndSettle();
      repo.gate?.complete('id');
      await tester.pumpAndSettle();
      expect(find.text('Other route'), findsOneWidget);
      expect(find.byType(SnackBar), findsNothing);
      expect(repo.submits, 1);
      navigator.pop();
      await tester.pumpAndSettle();
      expect(find.byType(RequestFormScreen), findsNothing);
      expect(find.byType(RequestsScreen), findsOneWidget);
      expect(find.byType(SnackBar), findsNothing);
      expect(repo.submits, 1);
    },
  );
}
