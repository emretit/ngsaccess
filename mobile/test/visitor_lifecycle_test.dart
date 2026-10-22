import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/models/visitor.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/visitor_provider.dart';
import 'package:ngsplusapp/router/app_router.dart';
import 'package:ngsplusapp/screens/visitor/visitor_screen.dart';
import 'package:ngsplusapp/widgets/app_bottom_navigation.dart';
import 'package:ngsplusapp/widgets/visitor/visitor_detail.dart';
import 'package:provider/provider.dart';

import 'auth_fakes.dart';
import 'visitor_provider_test.dart'
    show FakeVisitorRepository, visitorFixture, visitorPage;

class LifecycleVisitors extends FakeVisitorRepository {
  int detailCalls = 0;
  bool active = false;

  @override
  Future<Visitor> detail(String id) {
    detailCalls++;
    return detailResult?.call(id) ??
        Future.value(visitorFixture(id, active: active));
  }
}

void main() {
  testWidgets(
    'disposing the detail widget releases polling without relying on a route future',
    (tester) async {
      final repo = LifecycleVisitors();
      final state = VisitorProvider(repository: repo);
      await state.openDetail('own');
      await tester.pumpWidget(
        ChangeNotifierProvider<VisitorProvider>.value(
          value: state,
          child: const MaterialApp(
            locale: Locale('en'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(body: VisitorDetail(visitorId: 'own')),
          ),
        ),
      );
      await tester.pump(const Duration(seconds: 30));
      await tester.pumpAndSettle();
      expect(repo.detailCalls, 2);
      await tester.pumpWidget(const SizedBox.shrink());
      expect(state.selected, isNull);
      await tester.pump(const Duration(seconds: 60));
      expect(repo.detailCalls, 2);
      state.dispose();
    },
  );

  testWidgets(
    'AUD-02 real root detail polls activation while the covered list stays idle',
    (tester) async {
      final auth = AuthProvider(
        repository: FakeAuthRepository(),
        sessionStore: FakeSessionStore(),
      );
      await auth.signIn('a@example.test', 'synthetic-password');
      final repo = LifecycleVisitors();
      repo.listResult = () async =>
          visitorPage([visitorFixture('own', active: repo.active)]);
      final state = VisitorProvider(repository: repo);
      final router = buildRouter(
        auth,
        initialLocation: AppRoute.visitor,
        screenBuilders: {
          AppRoute.home: (_) => const SizedBox.shrink(),
          AppRoute.history: (_) => const SizedBox.shrink(),
          AppRoute.qr: (_) => const SizedBox.shrink(),
          AppRoute.profile: (_) => const SizedBox.shrink(),
          AppRoute.visitor: (_) => const VisitorScreen(),
        },
      );
      await tester.pumpWidget(
        ChangeNotifierProvider<VisitorProvider>.value(
          value: state,
          child: MaterialApp.router(
            routerConfig: router,
            locale: const Locale('en'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Synthetic own'));
      await tester.pumpAndSettle();
      expect(repo.detailCalls, 1);
      expect(
        Navigator.of(tester.element(find.byType(VisitorDetail))),
        same(router.routerDelegate.navigatorKey.currentState),
      );
      expect(find.byType(AppBottomNavigation).hitTestable(), findsNothing);
      final listCalls = repo.listCalls;
      repo.active = true;
      await tester.pump(const Duration(seconds: 30));
      await tester.pumpAndSettle();
      expect(repo.detailCalls, 2);
      expect(repo.listCalls, listCalls);
      expect(state.selected?.status, VisitorAccessStatus.active);
      expect(find.text('Access active').hitTestable(), findsOneWidget);

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump(const Duration(seconds: 60));
      expect(repo.detailCalls, 2);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(repo.detailCalls, 3);
      await tester.pump(const Duration(seconds: 30));
      await tester.pumpAndSettle();
      expect(repo.detailCalls, 4);

      await tester.tap(find.byTooltip('Close'));
      await tester.pumpAndSettle();
      expect(state.selected, isNull);
      expect(find.byType(AppBottomNavigation).hitTestable(), findsOneWidget);
      expect(state.visitors.single.status, VisitorAccessStatus.active);
      final resumedListCalls = repo.listCalls;
      await tester.pump(const Duration(seconds: 30));
      await tester.pumpAndSettle();
      expect(repo.detailCalls, 4);
      expect(repo.listCalls, resumedListCalls + 1);

      await tester.pumpWidget(const SizedBox.shrink());
      router.dispose();
      state.dispose();
      auth.dispose();
      await tester.pump(const Duration(seconds: 60));
      expect(repo.detailCalls, 4);
    },
  );

  testWidgets(
    'background, dismiss, account change and dispose reject late detail',
    (tester) async {
      final repo = LifecycleVisitors();
      final state = VisitorProvider(repository: repo);
      state.setVisible(true);
      await tester.pump();
      await state.openDetail('own');
      state.retainDetail('own');
      state.setVisible(false);
      final pending = Completer<Visitor>();
      repo.detailResult = (_) => pending.future;
      final oldRead = state.openDetail('own');
      state.setForeground(false);
      pending.complete(visitorFixture('own', active: true));
      await oldRead;
      expect(state.selected?.status, VisitorAccessStatus.preRegistered);
      final calls = repo.detailCalls;
      await tester.pump(const Duration(seconds: 60));
      expect(repo.detailCalls, calls);

      repo.detailResult = null;
      state.setForeground(true);
      await tester.pump();
      final dismissed = Completer<Visitor>();
      repo.detailResult = (_) => dismissed.future;
      final closingRead = state.openDetail('own');
      state.closeDetail();
      dismissed.complete(visitorFixture('own'));
      await closingRead;
      expect(state.selected, isNull);
      final closedCalls = repo.detailCalls;
      await tester.pump(const Duration(seconds: 60));
      expect(repo.detailCalls, closedCalls);

      final accountRead = Completer<Visitor>();
      repo.detailResult = (_) => accountRead.future;
      final oldAccountRead = state.openDetail('own');
      state.retainDetail('own');
      repo.session = 'B';
      state.synchronizeSession();
      accountRead.complete(visitorFixture('own'));
      await oldAccountRead;
      expect(state.selected, isNull);
      final changedCalls = repo.detailCalls;
      await tester.pump(const Duration(seconds: 60));
      expect(repo.detailCalls, changedCalls);
      repo.session = null;
      state.synchronizeSession();
      state.dispose();
      await tester.pump(const Duration(seconds: 60));
      expect(repo.detailCalls, changedCalls);
    },
  );
}
