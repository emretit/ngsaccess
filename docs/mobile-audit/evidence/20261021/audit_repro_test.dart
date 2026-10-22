import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/models/attendance_summary.dart';
import 'package:ngsplusapp/models/visitor.dart';
import 'package:ngsplusapp/providers/attendance_provider.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/door_operation_provider.dart';
import 'package:ngsplusapp/providers/preferred_device_provider.dart';
import 'package:ngsplusapp/providers/visitor_provider.dart';
import 'package:ngsplusapp/repositories/device_repository.dart';
import 'package:ngsplusapp/router/app_router.dart';
import 'package:ngsplusapp/screens/history/history_screen.dart';
import 'package:ngsplusapp/screens/home/home_screen.dart';
import 'package:ngsplusapp/screens/visitor/visitor_screen.dart';
import 'package:ngsplusapp/widgets/cards/quick_action_card.dart';
import '../../../../mobile/test/auth_fakes.dart';
import '../../../../mobile/test/helpers/mocks.dart';
import '../../../../mobile/test/providers/door_operation_provider_test.dart' as door;
import '../../../../mobile/test/visitor_provider_test.dart' as visitor;
import '../../../../mobile/test/widgets/history_screen_test.dart' as history;

// Audit-only characterization: these assertions document current faulty behavior.
// All data is synthetic; there is no HTTP client connected to a real deployment.
class AuditAttendance extends AttendanceProvider {
  AuditAttendance() : super(repository: MockAttendanceRepository());
  @override
  Future<AttendanceSummary?> loadDailySummary() async => null;
}

class AuditPreferred extends PreferredDeviceProvider {
  @override
  bool get hasDevice => true;
  @override
  String get deviceName => 'Synthetic door';
}

class CountingVisitors extends visitor.FakeVisitorRepository {
  int detailCalls = 0;
  bool active = false;
  @override
  Future<Visitor> detail(String id) async {
    detailCalls++;
    return visitor.visitorFixture(id, active: active);
  }
}

void main() {
  setUpAll(() => initializeDateFormatting('en'));

  testWidgets('AUD-01 absent receipt survives refresh/relaunch and home has no retry path', (tester) async {
    final auth = AuthProvider(repository: FakeAuthRepository(), sessionStore: FakeSessionStore());
    await auth.signIn('a@example.test', 'synthetic-password');
    final store = door.MemoryOperationStore();
    final repo = door.FakeOperationRepository();
    repo.onRequest = () async => throw const TimeoutError();
    final commands = DoorOperationProvider(repository: repo, store: store);
    await commands.synchronizeSession(auth, deployment: door.scopeA.deployment);
    await commands.open(deviceId: 'device-a', doorId: 'door-a');
    expect(commands.canRetrySameRequest, isTrue);
    final id = commands.requestId;
    final attendance = AuditAttendance();
    final preferred = AuditPreferred();
    addTearDown(auth.dispose);
    addTearDown(attendance.dispose);
    addTearDown(preferred.dispose);

    Widget app(DoorOperationProvider state) => MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(value: auth),
        ChangeNotifierProvider<AttendanceProvider>.value(value: attendance),
        ChangeNotifierProvider<DoorOperationProvider>.value(value: state),
        ChangeNotifierProvider<PreferredDeviceProvider>.value(value: preferred),
        Provider<DeviceRepository>(create: (_) => DeviceRepository(MockHttpConvexClient())),
      ],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('en'),
        home: const HomeScreen(),
      ),
    );
    await tester.pumpWidget(app(commands));
    await tester.pump();
    final unlock = find.byWidgetPredicate((w) => w is QuickActionCard && w.icon == Icons.lock_open);
    expect(tester.widget<QuickActionCard>(unlock).onTap, isNull);
    expect(find.text('Retry same request'), findsNothing);
    await tester.widget<RefreshIndicator>(find.byType(RefreshIndicator)).onRefresh();
    await tester.pump();
    expect(commands.requestId, id);
    expect(commands.hasUnresolvedOperation, isTrue);
    await tester.pumpWidget(const SizedBox.shrink());
    commands.dispose();

    final restored = DoorOperationProvider(repository: repo, store: store);
    await restored.synchronizeSession(auth, deployment: door.scopeA.deployment);
    await tester.pumpWidget(app(restored));
    await tester.pump();
    expect(restored.requestId, id);
    expect(tester.widget<QuickActionCard>(unlock).onTap, isNull);
    expect(repo.requests.length, 1);
    expect(restored.canRetrySameRequest, isTrue);
    await tester.pumpWidget(const SizedBox.shrink());
    restored.dispose();
  });

  testWidgets('AUD-02 root visitor detail stops polling while visible', (tester) async {
    final auth = AuthProvider(repository: FakeAuthRepository(), sessionStore: FakeSessionStore());
    await auth.signIn('a@example.test', 'synthetic-password');
    final repo = CountingVisitors();
    repo.listResult = () async => visitor.visitorPage([visitor.visitorFixture('own', active: repo.active)]);
    final state = VisitorProvider(repository: repo);
    final router = buildRouter(auth, initialLocation: AppRoute.visitor, screenBuilders: {
      AppRoute.home: (_) => const SizedBox.shrink(),
      AppRoute.history: (_) => const SizedBox.shrink(),
      AppRoute.qr: (_) => const SizedBox.shrink(),
      AppRoute.profile: (_) => const SizedBox.shrink(),
      AppRoute.visitor: (_) => const VisitorScreen(),
    });
    await tester.pumpWidget(ChangeNotifierProvider<VisitorProvider>.value(
      value: state,
      child: MaterialApp.router(routerConfig: router, locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Synthetic own'));
    await tester.pumpAndSettle();
    expect(repo.detailCalls, 1);
    repo.active = true;
    await tester.pump(const Duration(seconds: 31));
    await tester.pumpAndSettle();
    expect(repo.detailCalls, 1);
    expect(state.selected?.status, VisitorAccessStatus.preRegistered);
    await tester.tap(find.byTooltip('Close'));
    await tester.pumpAndSettle();
    expect(state.visitors.single.status, VisitorAccessStatus.active);
    await tester.pumpWidget(const SizedBox.shrink());
    router.dispose(); state.dispose(); auth.dispose();
  });

  testWidgets('AUD-03 retained calendar keeps previous month after resume until manual refresh', (tester) async {
    var now = DateTime.utc(2026, 10, 31, 20);
    final state = history.HistoryTestProvider();
    await tester.pumpWidget(ChangeNotifierProvider<AttendanceProvider>.value(
      value: state,
      child: MaterialApp(locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: HistoryScreen(now: () => now)),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Calendar'));
    await tester.pumpAndSettle();
    expect(find.text('October 2026'), findsOneWidget);
    now = DateTime.utc(2026, 11, 1, 6);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    state.publish();
    await tester.pumpAndSettle();
    expect(find.text('October 2026'), findsOneWidget);
    expect(state.ranges.any((r) => r.startsWith('2026-11-01/')), isFalse);
    await tester.tap(find.byTooltip('Refresh'));
    await tester.pumpAndSettle();
    expect(find.text('November 2026'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    state.dispose();
  });
}
