import 'dart:async';
import 'dart:ui' show SemanticsAction;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:ngsplusapp/core/branch_visibility.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/router/app_router.dart';
import 'package:ngsplusapp/screens/splash_screen.dart';
import 'package:ngsplusapp/services/session_store.dart';
import 'package:ngsplusapp/widgets/app_bottom_navigation.dart';

import '../auth_fakes.dart';

class _RetainedPage extends StatefulWidget {
  const _RetainedPage(this.name);
  final String name;
  @override
  State<_RetainedPage> createState() => _RetainedPageState();
}

class _RetainedPageState extends State<_RetainedPage> {
  int taps = 0;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Column(
      children: [
        Text('${widget.name}:$taps'),
        TextButton(
          onPressed: () => setState(() => taps++),
          child: const Text('Increment'),
        ),
      ],
    ),
  );
}

class _VisibilityPage extends StatelessWidget {
  const _VisibilityPage();
  @override
  Widget build(BuildContext context) =>
      Text(BranchVisibility.isActive(context, 2) ? 'QR active' : 'QR inactive');
}

// Exercises nested screens whose scroll views and FABs do not own a SafeArea.
class _ScrollingPage extends StatelessWidget {
  const _ScrollingPage();
  @override
  Widget build(BuildContext context) => Scaffold(
    floatingActionButton: FloatingActionButton(
      key: const Key('fixture_create'),
      onPressed: () {},
      child: const Icon(Icons.add),
    ),
    body: SingleChildScrollView(
      child: Column(
        children: [
          const Text('Visitor target'),
          for (var i = 0; i < 20; i++) const SizedBox(height: 80),
          TextButton(
            key: const Key('fixture_last_action'),
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Reached final action')),
            ),
            child: const Text('Final action'),
          ),
        ],
      ),
    ),
  );
}

void main() {
  late FakeAuthRepository repository;
  late FakeSessionStore store;
  late AuthProvider auth;
  GoRouter? router;

  void initialize() {
    repository = FakeAuthRepository();
    store = FakeSessionStore();
    auth = AuthProvider(repository: repository, sessionStore: store);
  }

  tearDown(() {
    router?.dispose();
    router = null;
    auth.dispose();
  });

  Future<void> mount(WidgetTester tester, String location) async {
    router = buildRouter(
      auth,
      initialLocation: location,
      screenBuilders: {
        AppRoute.login: (_) => const Scaffold(body: Text('Login target')),
        AppRoute.home: (_) => const _RetainedPage('Home'),
        AppRoute.history: (_) => const _RetainedPage('History'),
        AppRoute.qr: (_) => const _VisibilityPage(),
        AppRoute.visitor: (_) => const _ScrollingPage(),
        AppRoute.profile: (_) => const Text('Profile target'),
        AppRoute.requests: (_) => const Text('Requests target'),
      },
    );
    await tester.pumpWidget(
      MaterialApp.router(
        locale: const Locale('en'),
        routerConfig: router,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
      ),
    );
    await tester.pump();
  }

  Uri location() => router?.routeInformationProvider.value.uri ?? Uri();

  testWidgets(
    'cold protected link waits for restore and keeps original target',
    (tester) async {
      initialize();
      final pending = Completer<AuthUser>();
      store.session = const StoredSession(token: 'fixture-session');
      repository.onMe = () => pending.future;
      final bootstrap = auth.bootstrap();
      await mount(tester, '/history');
      expect(find.byType(SplashScreen), findsOneWidget);
      expect(location().path, AppRoute.splash);
      expect(location().queryParameters['from'], AppRoute.history);
      expect(find.text('Login target'), findsNothing);
      pending.complete(authTestUser);
      await bootstrap;
      await tester.pumpAndSettle();
      expect(find.text('History:0'), findsOneWidget);
      expect(repository.meCalls, 1);
      expect(store.reads, 1);
    },
  );

  for (final target in [
    '/requests',
    'ngsplus://requests',
    'ngsplus:///requests',
  ]) {
    testWidgets('requests protected route and deep link: $target', (
      tester,
    ) async {
      initialize();
      await auth.bootstrap();
      await mount(tester, target);
      await tester.pumpAndSettle();
      expect(location().path, AppRoute.login);
      expect(location().queryParameters['from'], AppRoute.requests);
      await auth.signIn('fixture@example.test', 'fixture-password');
      await tester.pumpAndSettle();
      expect(location().path, AppRoute.requests);
      expect(find.text('Requests target'), findsOneWidget);
      expect(find.byType(AppBottomNavigation), findsNothing);
    });
  }

  testWidgets('unauthenticated target survives login and auth notify', (
    tester,
  ) async {
    initialize();
    await auth.bootstrap();
    await mount(tester, '/history');
    await tester.pumpAndSettle();
    expect(location().path, AppRoute.login);
    expect(location().queryParameters['from'], AppRoute.history);
    await auth.signIn('fixture@example.test', 'fixture-password');
    await tester.pumpAndSettle();
    expect(location().path, AppRoute.history);
    expect(find.text('History:0'), findsOneWidget);
  });

  testWidgets(
    'temporary restore failure exposes retry then returns without password login',
    (tester) async {
      initialize();
      store.session = const StoredSession(token: 'fixture-session');
      repository.onMe = () async => throw const NetworkError();
      await auth.bootstrap();
      await mount(tester, '/history');
      await tester.pumpAndSettle();
      expect(auth.phase, AuthPhase.retryableFailure);
      expect(location().path, AppRoute.splash);
      expect(find.text('Try again'), findsOneWidget);
      repository.onMe = () async => authTestUser;
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(location().path, AppRoute.history);
      expect(repository.signInCalls, 0);
      expect(repository.meCalls, 2);
    },
  );

  testWidgets(
    'abandon retry restores login target and never retries remembered credentials',
    (tester) async {
      initialize();
      store.session = const StoredSession(token: 'fixture-session');
      repository.onMe = () async => throw const NetworkError();
      await auth.bootstrap();
      await mount(tester, '/history');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Return to sign in'));
      await tester.pumpAndSettle();
      expect(location().path, AppRoute.login);
      expect(location().queryParameters['from'], AppRoute.history);
      expect(store.session, isNull);
      expect(repository.signInCalls, 0);
    },
  );

  for (final target in [
    'https://attacker.invalid/history',
    '//attacker.invalid/history',
    '/history?from=https://attacker.invalid',
    '/history#fragment',
    '/unknown',
  ]) {
    testWidgets('external or unlisted return target is rejected: $target', (
      tester,
    ) async {
      initialize();
      await auth.bootstrap();
      await mount(
        tester,
        Uri(path: AppRoute.login, queryParameters: {'from': target}).toString(),
      );
      await tester.pumpAndSettle();
      expect(location().queryParameters['from'], isNull);
      await auth.signIn('fixture@example.test', 'fixture-password');
      await tester.pumpAndSettle();
      expect(location().path, AppRoute.home);
      expect(location().hasAuthority, isFalse);
    });
  }

  for (final target in ['/', '/unknown', 'https://attacker.invalid/history']) {
    testWidgets('root and unknown paths use guarded home fallback: $target', (
      tester,
    ) async {
      initialize();
      await auth.bootstrap();
      await mount(tester, target);
      await tester.pumpAndSettle();
      expect(location().path, AppRoute.login);
      expect(location().queryParameters['from'], AppRoute.home);
    });
  }

  for (final target in ['ngsplus://history', 'ngsplus:///history']) {
    testWidgets('custom URI normalizes to history: $target', (tester) async {
      initialize();
      await auth.signIn('fixture@example.test', 'fixture-password');
      await mount(tester, target);
      await tester.pumpAndSettle();
      expect(location().path, AppRoute.history);
    });
  }

  testWidgets('late A restore cannot replace authenticated B or its route', (
    tester,
  ) async {
    initialize();
    final pendingA = Completer<AuthUser>();
    store.session = const StoredSession(token: 'fixture-session-a');
    repository.onMe = () => pendingA.future;
    final bootstrapA = auth.bootstrap();
    await mount(tester, '/history');
    await repository.meStarted.future;
    await auth.signOut();
    repository.onSignIn = (_, _) async =>
        authResult(token: 'fixture-session-b', user: otherAuthTestUser);
    await auth.signIn('fixture-b@example.test', 'fixture-password');
    await tester.pumpAndSettle();
    pendingA.complete(authTestUser);
    await bootstrapA;
    await tester.pumpAndSettle();
    expect(auth.currentUser?.id, otherAuthTestUser.id);
    expect(location().path, AppRoute.history);
    expect(repository.clientToken, 'fixture-session-b');
  });

  testWidgets(
    'navigation exposes five named selected controls; keyboard activates QR',
    (tester) async {
      initialize();
      await auth.signIn('fixture@example.test', 'fixture-password');
      await mount(tester, '/home');
      await tester.pumpAndSettle();
      final semantics = tester.ensureSemantics();
      try {
        expect(find.byType(AppBottomNavigation), findsOneWidget);
        Finder destination(String label) => find
            .descendant(
              of: find.byType(AppBottomNavigation),
              matching: find.bySemanticsLabel(RegExp(label)),
            )
            .first;
        var selectedCount = 0;
        for (final label in [
          'Home',
          'History',
          'QR Actions',
          'Visitor',
          'Profile',
        ]) {
          expect(destination(label), findsOneWidget);
          final data = tester
              .getSemantics(destination(label))
              .getSemanticsData();
          expect(data.flagsCollection.isButton, isTrue);
          expect(data.hasAction(SemanticsAction.tap), isTrue);
          if (data.flagsCollection.isSelected.toBoolOrNull() == true) {
            selectedCount++;
          }
        }
        expect(selectedCount, 1);
        final qr = destination('QR Actions');
        expect(
          tester
              .getSemantics(qr)
              .getSemanticsData()
              .hasAction(SemanticsAction.tap),
          isTrue,
        );
        // Tab through all five destinations and activate the focused QR.
        for (
          var i = 0;
          i < 12 &&
              FocusManager.instance.primaryFocus?.context
                      ?.findAncestorWidgetOfExactType<InkWell>()
                      ?.key !=
                  const ValueKey('app_nav_button_2');
          i++
        ) {
          await tester.sendKeyEvent(LogicalKeyboardKey.tab);
          await tester.pump();
        }
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();
        expect(location().path, AppRoute.qr);
        expect(
          tester
              .widget<AppBottomNavigation>(find.byType(AppBottomNavigation))
              .selectedIndex,
          2,
        );
        expect(
          tester
              .getSemantics(destination('QR Actions'))
              .getSemanticsData()
              .flagsCollection
              .isSelected
              .toBoolOrNull(),
          isTrue,
        );
        expect(find.text('QR active'), findsOneWidget);
      } finally {
        semantics.dispose();
      }
    },
  );

  testWidgets(
    'retained history state survives branch switching and QR becomes inactive',
    (tester) async {
      initialize();
      await auth.signIn('fixture@example.test', 'fixture-password');
      await mount(tester, '/history');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Increment'));
      await tester.pump();
      await tester.tap(find.text('Home'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Increment'));
      await tester.pump();
      await tester.tap(find.text('QR Actions'));
      await tester.pumpAndSettle();
      expect(find.text('QR active'), findsOneWidget);
      await tester.tap(find.text('History'));
      await tester.pumpAndSettle();
      expect(find.text('History:1'), findsOneWidget);
      expect(find.text('QR inactive', skipOffstage: false), findsOneWidget);
      await tester.tap(find.text('Home'));
      await tester.pumpAndSettle();
      expect(find.text('Home:1'), findsOneWidget);
    },
  );

  testWidgets(
    'keyboard hides floating navigation without losing branch state',
    (tester) async {
      initialize();
      await auth.signIn('fixture@example.test', 'fixture-password');
      await mount(tester, '/history');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Increment'));
      await tester.pump();
      tester.view.viewInsets = const FakeViewPadding(bottom: 280);
      addTearDown(tester.view.resetViewInsets);
      await tester.pumpAndSettle();
      expect(find.byType(AppBottomNavigation), findsNothing);
      expect(location().path, AppRoute.history);
      expect(find.text('History:1'), findsOneWidget);
      tester.view.resetViewInsets();
      await tester.pumpAndSettle();
      expect(find.byType(AppBottomNavigation), findsOneWidget);
      expect(find.text('History:1'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'floating bar never covers nested screen FAB or final scroll action',
    (tester) async {
      initialize();
      await auth.signIn('fixture@example.test', 'fixture-password');
      await mount(tester, '/visitor');
      await tester.pumpAndSettle();
      final barTop = tester.getTopLeft(find.byType(AppBottomNavigation)).dy;
      expect(
        tester.getRect(find.byKey(const Key('fixture_create'))).bottom,
        lessThanOrEqualTo(barTop),
      );
      final lastAction = find.byKey(const Key('fixture_last_action'));
      await tester.scrollUntilVisible(lastAction, 400);
      await tester.pumpAndSettle();
      expect(tester.getRect(lastAction).bottom, lessThanOrEqualTo(barTop));
      await tester.tap(lastAction);
      await tester.pump();
      expect(find.text('Reached final action'), findsOneWidget);
      expect(location().path, AppRoute.visitor);
      expect(tester.takeException(), isNull);
    },
  );
}
