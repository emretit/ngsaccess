import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ngsplusapp/config/convex_config.dart';
import 'package:ngsplusapp/core/safe_diagnostics.dart';
import 'package:ngsplusapp/main.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/locale_provider.dart';
import 'package:ngsplusapp/providers/preferred_device_provider.dart';
import 'package:ngsplusapp/providers/visitor_provider.dart';
import 'package:ngsplusapp/screens/auth/login_screen.dart';
import 'package:ngsplusapp/screens/history/history_screen.dart';
import 'package:ngsplusapp/screens/profile/profile_screen.dart';
import 'package:ngsplusapp/screens/qr_scan/qr_scan_screen.dart';
import 'package:ngsplusapp/screens/settings/select_device_screen.dart';
import 'package:ngsplusapp/screens/splash_screen.dart';
import 'package:ngsplusapp/services/session_store.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../auth_fakes.dart';

const _employeeA = <String, Object?>{
  'id': 'fixture-employee-a',
  'email': 'a@example.test',
  'firstName': 'A',
  'lastName': 'Fixture',
  'cardNumber': 'fixture-card-a',
  'projectId': 'fixture-project-a',
};
const _employeeB = <String, Object?>{
  'id': 'fixture-employee-b',
  'email': 'b@example.test',
  'firstName': 'B',
  'lastName': 'Fixture',
  'cardNumber': 'fixture-card-b',
  'projectId': 'fixture-project-b',
};
http.Response _success(Object? value) => http.Response(
  jsonEncode({'status': 'success', 'value': value}),
  200,
  headers: {'content-type': 'application/json'},
);

class _Backend {
  int meCalls = 0;
  int signInCalls = 0;
  int visitorCalls = 0;
  Future<http.Response> Function()? me;
  Map<String, Object?> employee = _employeeA;
  Future<http.Response> handle(http.Request request) async {
    final Object? body = jsonDecode(request.body);
    if (body is! Map<String, Object?>) {
      throw StateError('Invalid test request');
    }
    final args = body['args'];
    final firstArgs = args is List<Object?> && args.isNotEmpty
        ? args.first
        : null;
    final values = firstArgs is Map<String, Object?>
        ? firstArgs
        : <String, Object?>{};
    switch (body['path']) {
      case 'employeeAuth:me':
        meCalls++;
        return me == null
            ? _success(employee)
            : await me?.call() ?? _success(employee);
      case 'employeeAuth:signIn':
        signInCalls++;
        return _success({
          'token': 'fixture-session-b',
          'expiresAt': '2099-01-01T00:00:00Z',
          'employee': employee,
        });
      case 'employeeAuth:signOut':
        return _success(null);
      case 'mobileAttendance:listPage':
        return _success({
          'page': <Object?>[],
          'isDone': true,
          'continueCursor': '',
        });
      case 'mobileAttendance:summary':
        final start = values['startDate'];
        final end = values['endDate'];
        if (start is! String || end is! String) {
          throw StateError('Missing summary range');
        }
        final first = DateTime.parse(start);
        final last = DateTime.parse(end);
        return _success({
          'timeZone': 'Europe/Istanbul',
          'startDate': start,
          'endDate': end,
          'generatedAt': '2026-10-19T10:00:00Z',
          'days': [
            for (
              var day = first;
              !day.isAfter(last);
              day = day.add(const Duration(days: 1))
            )
              {
                'date': day.toIso8601String().split('T').first,
                'entryCount': 0,
                'exitCount': 0,
                'deniedCount': 0,
                'unknownCount': 0,
                'firstEntry': null,
                'lastEntry': null,
                'lastExit': null,
                'lastDirection': 'unknown',
              },
          ],
          'totals': {
            'entryCount': 0,
            'exitCount': 0,
            'deniedCount': 0,
            'unknownCount': 0,
            'presentDays': 0,
          },
        });
      case 'mobileVisitors:listPage':
        visitorCalls++;
        return _success({
          'page': <Object?>[],
          'isDone': true,
          'continueCursor': '',
          'scanLimited': false,
        });
      case 'mobileVisitors:summary':
        return _success({
          'total': 0,
          'counts': {
            'active': 0,
            'checkedOut': 0,
            'expired': 0,
            'preRegistered': 0,
          },
          'overflow': false,
          'scanned': 0,
          'limit': 1000,
          'evaluatedAt': DateTime.utc(2026, 10, 19).millisecondsSinceEpoch,
        });
      case 'mobileAccess:listTargets':
        return _success(<Object?>[]);
      case 'employeeCheckIn:createMyCheckInToken':
        return _success({
          'token': 'fixture-qr',
          'expiresAt': '2099-01-01T00:00:00Z',
          'serverTime': '2026-10-19T10:00:00Z',
          'status': 'active',
        });
      default:
        // Unexpected calls fail visibly in the relevant provider, never touch a service.
        return http.Response('', 503);
    }
  }
}

class _TrackedClient extends HttpConvexClient {
  _TrackedClient(_Backend backend)
    : super(
        deploymentUrl: 'https://fixture.convex.cloud',
        httpClient: MockClient(backend.handle),
        maxRetries: 1,
      );
  int closes = 0;
  int callbackClears = 0;
  AuthExpiryCallback? callback;
  @override
  void setOnAuthExpired(AuthExpiryCallback? value) {
    callback = value;
    super.setOnAuthExpired(value);
  }

  @override
  void clearOnAuthExpired([AuthExpiryCallback? value]) {
    callbackClears++;
    if (value == null || identical(value, callback)) {
      callback = null;
    }
    super.clearOnAuthExpired(value);
  }

  @override
  void close() {
    closes++;
    callback = null;
    super.close();
  }
}

void main() {
  late _Backend backend;
  late _TrackedClient client;
  late FakeSessionStore store;

  void initialize() {
    SharedPreferences.setMockInitialValues({'mobile_locale': 'en'});
    SafeDiagnostics.instance.clear();
    backend = _Backend();
    client = _TrackedClient(backend);
    store = FakeSessionStore();
  }

  tearDown(() {
    if (client.closes == 0) client.close();
  });

  Future<void> mount(
    WidgetTester tester, {
    String initial = '/history',
    bool owned = false,
    bool keepDiagnosticHandler = false,
  }) async {
    tester.view.physicalSize = const Size(720, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final testErrorHandler = FlutterError.onError;
    await tester.pumpWidget(
      MyApp(
        client: owned ? null : client,
        clientFactory: owned ? () async => client : null,
        sessionStore: store,
        initialLocation: initial,
      ),
    );
    // Keep the test binding in charge of failures. Dedicated lifecycle tests
    // exercise the production handler and restore it before making assertions.
    if (!keepDiagnosticHandler) {
      FlutterError.onError = testErrorHandler;
    }
    await tester.pump();
  }

  BuildContext pageContext(WidgetTester tester) =>
      tester.element(find.byType(Navigator).first);
  Future<void> remove(
    WidgetTester tester, {
    bool allowFrameworkDiagnostic = false,
  }) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    if (!allowFrameworkDiagnostic) {
      expect(
        SafeDiagnostics.instance.events.where(
          (event) => event['operation'] == 'framework',
        ),
        isEmpty,
      );
    }
  }

  testWidgets(
    'real root restores token once before opening cold history link',
    (tester) async {
      initialize();
      final pending = Completer<http.Response>();
      backend.me = () => pending.future;
      store.session = const StoredSession(token: 'fixture-session-a');
      await mount(tester);
      expect(find.byType(SplashScreen), findsOneWidget);
      expect(find.byType(LoginScreen), findsNothing);
      pending.complete(_success(_employeeA));
      await tester.pumpAndSettle();
      expect(find.byType(HistoryScreen), findsOneWidget);
      expect(backend.meCalls, 1);
      expect(store.reads, 1);
      expect(tester.takeException(), isNull);
      await remove(tester);
    },
  );

  testWidgets('real login form auth notification restores history target', (
    tester,
  ) async {
    initialize();
    await mount(tester);
    await tester.pumpAndSettle();
    expect(find.byType(LoginScreen), findsOneWidget);
    final loginContext = tester.element(find.byType(LoginScreen));
    expect(
      GoRouter.of(
        loginContext,
      ).routeInformationProvider.value.uri.queryParameters['from'],
      '/history',
    );
    await tester.enterText(find.byType(TextFormField).at(0), 'a@example.test');
    await tester.enterText(
      find.byType(TextFormField).at(1),
      'fixture-password',
    );
    await tester.tap(find.byType(ElevatedButton));
    await tester.pumpAndSettle();
    expect(find.byType(HistoryScreen), findsOneWidget);
    expect(backend.signInCalls, 1);
    await remove(tester);
  });

  testWidgets(
    'invalid saved token returns to login without offering endless retry',
    (tester) async {
      initialize();
      store.session = const StoredSession(token: 'fixture-invalid-session');
      backend.me = () async => http.Response('', 401);
      await mount(tester);
      await tester.pumpAndSettle();
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byType(SplashScreen), findsNothing);
      expect(store.session, isNull);
      expect(backend.meCalls, 1);
      await remove(tester);
    },
  );

  testWidgets(
    'late real HTTP restore for A cannot overwrite B or B scoped preference',
    (tester) async {
      initialize();
      final pendingA = Completer<http.Response>();
      backend.me = () => pendingA.future;
      store.session = const StoredSession(token: 'fixture-session-a');
      await mount(tester);
      final auth = pageContext(tester).read<AuthProvider>();
      final preferred = pageContext(tester).read<PreferredDeviceProvider>();
      expect(backend.meCalls, 1);
      await auth.signOut();
      backend.employee = _employeeB;
      await auth.signIn('b@example.test', 'fixture-password');
      await tester.pumpAndSettle();
      expect(
        await preferred.setDevice(id: 'fixture-door-b', name: 'Fixture B'),
        isTrue,
      );
      pendingA.complete(_success(_employeeA));
      await tester.pumpAndSettle();
      expect(auth.currentUser?.id, 'fixture-employee-b');
      expect(preferred.deviceId, 'fixture-door-b');
      expect(client.sessionToken, 'fixture-session-b');
      expect(find.byType(HistoryScreen), findsOneWidget);
      await remove(tester);
    },
  );

  testWidgets('root retries temporary offline restore without issuing signIn', (
    tester,
  ) async {
    initialize();
    store.session = const StoredSession(token: 'fixture-session-a');
    backend.me = () async => throw const SocketException('fixture offline');
    await mount(tester);
    await tester.pumpAndSettle();
    expect(find.byType(SplashScreen), findsOneWidget);
    expect(find.byType(LoginScreen), findsNothing);
    backend.me = () async => _success(_employeeA);
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.byType(HistoryScreen), findsOneWidget);
    expect(backend.meCalls, 2);
    expect(backend.signInCalls, 0);
    await remove(tester);
  });

  testWidgets(
    'root binds locale and clears preferred device immediately across auth epochs',
    (tester) async {
      initialize();
      store.session = const StoredSession(token: 'fixture-session-a');
      await mount(tester, initial: '/profile');
      await tester.pumpAndSettle();
      final context = tester.element(find.byType(ProfileScreen));
      final auth = context.read<AuthProvider>();
      final preferred = context.read<PreferredDeviceProvider>();
      final locale = context.read<LocaleProvider>();
      expect(preferred.hasIdentity, isTrue);
      expect(
        await preferred.setDevice(id: 'fixture-door-a', name: 'Fixture A'),
        isTrue,
      );
      expect(preferred.deviceId, 'fixture-door-a');
      await locale.setLocale(const Locale('tr'));
      await tester.pumpAndSettle();
      expect(
        tester.widget<MaterialApp>(find.byType(MaterialApp)).locale,
        const Locale('tr'),
      );
      final logout = auth.signOut();
      expect(preferred.deviceId, isNull);
      expect(preferred.hasIdentity, isFalse);
      await logout;
      backend.employee = _employeeB;
      await auth.signIn('b@example.test', 'fixture-password');
      await tester.pumpAndSettle();
      expect(preferred.hasIdentity, isTrue);
      expect(preferred.deviceId, isNull);
      expect(auth.currentUser?.id, 'fixture-employee-b');
      await remove(tester);
    },
  );

  testWidgets(
    'stackless device selection has a working back fallback to profile',
    (tester) async {
      initialize();
      store.session = const StoredSession(token: 'fixture-session-a');
      await mount(tester, initial: '/select-device');
      await tester.pumpAndSettle();
      expect(find.byType(SelectDeviceScreen), findsOneWidget);
      await tester.tap(find.byTooltip('Back'));
      await tester.pumpAndSettle();
      expect(find.byType(ProfileScreen), findsOneWidget);
      await remove(tester);
    },
  );

  testWidgets('real retained QR and visitor branches stop hidden resources', (
    tester,
  ) async {
    initialize();
    store.session = const StoredSession(token: 'fixture-session-a');
    await mount(tester);
    await tester.pumpAndSettle();
    expect(backend.visitorCalls, 0);
    await tester.tap(find.text('QR Actions'));
    await tester.pumpAndSettle();
    expect(
      tester.widget<QRScanScreen>(find.byType(QRScanScreen)).isActive,
      isTrue,
    );
    await tester.tap(find.text('Visitor').last);
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<QRScanScreen>(find.byType(QRScanScreen, skipOffstage: false))
          .isActive,
      isFalse,
    );
    expect(backend.visitorCalls, greaterThan(0));
    final visitors = pageContext(tester).read<VisitorProvider>();
    expect(visitors.loaded, isTrue);
    expect(visitors.error, isNull);
    expect(visitors.summary, isNotNull);
    expect(visitors.summaryError, isNull);
    final calls = backend.visitorCalls;
    await tester.tap(find.text('History').last);
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 31));
    expect(backend.visitorCalls, calls);
    expect(visitors.loading, isFalse);
    await remove(tester);
  });

  testWidgets(
    'visitor polling pauses in background and resumes only on its active branch',
    (tester) async {
      initialize();
      store.session = const StoredSession(token: 'fixture-session-a');
      await mount(tester, initial: '/visitor');
      await tester.pumpAndSettle();
      final activeCalls = backend.visitorCalls;
      expect(activeCalls, greaterThan(0));
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump(const Duration(seconds: 31));
      expect(backend.visitorCalls, activeCalls);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(backend.visitorCalls, greaterThan(activeCalls));
      await remove(tester);
    },
  );

  testWidgets(
    'owned client closes, expiry callback detaches and diagnostic hooks restore',
    (tester) async {
      initialize();
      final priorFramework = FlutterError.onError;
      final priorPlatform = PlatformDispatcher.instance.onError;
      await mount(tester, owned: true, keepDiagnosticHandler: true);
      await tester.pumpAndSettle();
      final hadCallback = client.callback != null;
      FlutterError.reportError(
        FlutterErrorDetails(
          exception: StateError('fixture-private-body'),
          stack: StackTrace.fromString(
            '#0 boot (package:ngsplusapp/main.dart:1:2)',
          ),
        ),
      );
      PlatformDispatcher.instance.onError?.call(
        StateError('fixture-private-body'),
        StackTrace.empty,
      );
      final events = SafeDiagnostics.instance.events;
      final auth = pageContext(tester).read<AuthProvider>();
      final reads = store.reads;
      await remove(tester, allowFrameworkDiagnostic: true);
      expect(hadCallback, isTrue);
      expect(events.any((event) => event['operation'] == 'framework'), isTrue);
      expect(events.any((event) => event['operation'] == 'platform'), isTrue);
      expect(jsonEncode(events), isNot(contains('fixture-private-body')));
      expect(client.closes, 1);
      expect(client.callbackClears, 1);
      expect(client.callback, isNull);
      expect(identical(FlutterError.onError, priorFramework), isTrue);
      expect(
        identical(PlatformDispatcher.instance.onError, priorPlatform),
        isTrue,
      );
      await auth.bootstrap(force: true);
      expect(store.reads, reads);
    },
  );

  testWidgets(
    'injected client and auth remain caller-owned while root callback detaches',
    (tester) async {
      initialize();
      final auth = AuthProvider(
        repository: FakeAuthRepository(),
        sessionStore: store,
      );
      final testErrorHandler = FlutterError.onError;
      await tester.pumpWidget(
        MyApp(client: client, authProvider: auth, initialLocation: '/history'),
      );
      FlutterError.onError = testErrorHandler;
      await tester.pumpAndSettle();
      await remove(tester);
      expect(client.closes, 0);
      expect(client.callback, isNull);
      expect(
        await auth.signIn('fixture@example.test', 'fixture-password'),
        isTrue,
      );
      await client.setAuth(token: 'fixture-after-unmount');
      expect(client.sessionToken, 'fixture-after-unmount');
      auth.dispose();
    },
  );

  testWidgets(
    'late factory result after root disposal closes without bootstrap',
    (tester) async {
      initialize();
      final pending = Completer<HttpConvexClient>();
      await tester.pumpWidget(
        MyApp(clientFactory: () => pending.future, sessionStore: store),
      );
      await tester.pump();
      await remove(tester);
      pending.complete(client);
      await tester.pump();
      expect(client.closes, 1);
      expect(store.reads, 0);
      expect(backend.meCalls, 0);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'replacing a pending root never restores the removed roots diagnostic hook',
    (tester) async {
      initialize();
      final beforeFramework = FlutterError.onError;
      final beforePlatform = PlatformDispatcher.instance.onError;
      final first = Completer<HttpConvexClient>();
      final second = Completer<HttpConvexClient>();
      final secondClient = _TrackedClient(backend);
      await tester.pumpWidget(
        MyApp(
          key: const ValueKey('first'),
          clientFactory: () => first.future,
          sessionStore: store,
        ),
      );
      await tester.pump();
      await tester.pumpWidget(
        MyApp(
          key: const ValueKey('second'),
          clientFactory: () => second.future,
          sessionStore: store,
        ),
      );
      await tester.pump();
      await remove(tester);
      first.complete(client);
      second.complete(secondClient);
      await tester.pump();
      expect(client.closes, 1);
      expect(secondClient.closes, 1);
      expect(identical(FlutterError.onError, beforeFramework), isTrue);
      expect(
        identical(PlatformDispatcher.instance.onError, beforePlatform),
        isTrue,
      );
    },
  );

  testWidgets(
    'configuration error is localized and retries before any auth request',
    (tester) async {
      initialize();
      var attempts = 0;
      final testErrorHandler = FlutterError.onError;
      await tester.pumpWidget(
        MyApp(
          sessionStore: store,
          initialLocation: '/history',
          clientFactory: () async {
            attempts++;
            if (attempts == 1) {
              throw StateError('fixture-private-configuration');
            }
            return client;
          },
        ),
      );
      FlutterError.onError = testErrorHandler;
      await tester.pumpAndSettle();
      expect(find.byType(SplashScreen), findsOneWidget);
      expect(
        find.textContaining('fixture-private-configuration'),
        findsNothing,
      );
      expect(store.reads, 0);
      expect(backend.meCalls, 0);
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(attempts, 2);
      expect(find.byType(LoginScreen), findsOneWidget);
      final context = tester.element(find.byType(LoginScreen));
      expect(
        GoRouter.of(
          context,
        ).routeInformationProvider.value.uri.queryParameters['from'],
        '/history',
      );
      expect(
        jsonEncode(SafeDiagnostics.instance.events),
        isNot(contains('fixture-private-configuration')),
      );
      await remove(tester);
    },
  );
}
