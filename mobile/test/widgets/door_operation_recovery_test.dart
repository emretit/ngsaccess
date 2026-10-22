import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/models/attendance_summary.dart';
import 'package:ngsplusapp/models/device.dart';
import 'package:ngsplusapp/models/door_operation.dart';
import 'package:ngsplusapp/providers/attendance_provider.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/door_operation_provider.dart';
import 'package:ngsplusapp/providers/preferred_device_provider.dart';
import 'package:ngsplusapp/repositories/device_repository.dart';
import 'package:ngsplusapp/screens/home/home_screen.dart';
import 'package:ngsplusapp/widgets/cards/door_command_status_card.dart';
import 'package:ngsplusapp/widgets/cards/quick_action_card.dart';
import 'package:ngsplusapp/widgets/door_operation_recovery_dialog.dart';
import 'package:provider/provider.dart';

import '../auth_fakes.dart';
import '../helpers/mocks.dart';
import '../providers/door_operation_provider_test.dart' as door;

class _Attendance extends AttendanceProvider {
  _Attendance() : super(repository: MockAttendanceRepository());
  @override
  bool get hasSummaryLoaded => true;
  @override
  bool get isTodayStatusKnown => true;
  @override
  Future<AttendanceSummary?> loadDailySummary() async => null;
}

// Deliberately different from the persisted command's target. Recovery must
// never consult or redirect to the current preference.
class _Preferred extends PreferredDeviceProvider {
  @override
  bool get hasDevice => true;
  @override
  String get deviceName => 'Other selected door';
  @override
  String get deviceId => 'device-b';
  @override
  String get doorId => 'door-b';
}

class _Devices extends DeviceRepository {
  _Devices() : super(MockHttpConvexClient());
  int calls = 0;
  @override
  Future<List<Device>> listForEmployee() async {
    calls++;
    return [];
  }
}

void main() {
  setUpAll(() => initializeDateFormatting('tr'));
  late AuthProvider auth;
  late door.MemoryOperationStore store;
  late door.FakeOperationRepository repository;
  late DoorOperationProvider commands;
  late _Attendance attendance;
  late _Preferred preferred;
  late _Devices devices;

  Future<void> prepare() async {
    auth = AuthProvider(
      repository: FakeAuthRepository(),
      sessionStore: FakeSessionStore(),
    );
    await auth.signIn('a@example.test', 'synthetic-password');
    store = door.MemoryOperationStore();
    repository = door.FakeOperationRepository();
    commands = DoorOperationProvider(repository: repository, store: store);
    await commands.synchronizeSession(auth, deployment: door.scopeA.deployment);
    attendance = _Attendance();
    preferred = _Preferred();
    devices = _Devices();
  }

  tearDown(() {
    commands.dispose();
    attendance.dispose();
    preferred.dispose();
    auth.dispose();
  });

  Widget app({Locale locale = const Locale('en'), double scale = 1}) =>
      MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthProvider>.value(value: auth),
          ChangeNotifierProvider<AttendanceProvider>.value(value: attendance),
          ChangeNotifierProvider<DoorOperationProvider>.value(value: commands),
          ChangeNotifierProvider<PreferredDeviceProvider>.value(
            value: preferred,
          ),
          Provider<DeviceRepository>.value(value: devices),
        ],
        child: MaterialApp(
          locale: locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(scale)),
            child: child ?? const SizedBox.shrink(),
          ),
          home: const HomeScreen(),
        ),
      );

  Finder unlock() => find.byWidgetPredicate(
    (widget) => widget is QuickActionCard && widget.icon == Icons.lock_open,
  );

  AppLocalizations l10n(WidgetTester tester) =>
      AppLocalizations.of(tester.element(find.byType(HomeScreen)));

  Future<void> mount(WidgetTester tester) async {
    tester.view.physicalSize = const Size(430, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(app());
    await tester.pumpAndSettle();
  }

  Future<void> recover(WidgetTester tester) async {
    await tester.ensureVisible(unlock());
    expect(tester.widget<QuickActionCard>(unlock()).onTap, isNotNull);
    await tester.tap(unlock());
    await tester.pumpAndSettle();
    expect(find.byType(DoorOperationRecoveryDialog), findsOneWidget);
  }

  Future<void> loseResponse() async {
    repository.onRequest = () async => throw const TimeoutError();
    await commands.open(deviceId: 'device-a', doorId: 'door-a');
  }

  testWidgets(
    'AUD-01 loss, null lookup, refresh and relaunch recover only the original request',
    (tester) async {
      await prepare();
      await loseResponse();
      final id = commands.requestId;
      await mount(tester);
      expect(find.byType(DoorCommandStatusCard), findsNothing);
      expect(find.byType(DoorOperationRecoveryDialog), findsNothing);
      await tester
          .widget<RefreshIndicator>(find.byType(RefreshIndicator))
          .onRefresh();
      await tester.pumpAndSettle();
      expect(commands.requestId, id);
      expect(repository.requests, hasLength(1));
      await tester.pumpWidget(const SizedBox.shrink());
      commands.dispose();
      commands = DoorOperationProvider(repository: repository, store: store);
      await commands.synchronizeSession(
        auth,
        deployment: door.scopeA.deployment,
      );
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      final before = repository.requestLookups.length;
      await recover(tester);
      expect(repository.requestLookups.length, before + 1);
      expect(repository.requests, hasLength(1));
      expect(devices.calls, 0);
      final gate = Completer<DoorOperation>();
      repository.onRequest = () => gate.future;
      final retry = find.text(l10n(tester).homeCommandRetrySameRequest);
      await tester.tap(retry);
      await tester.tap(retry);
      await tester.pump();
      expect(repository.requests, hasLength(2));
      expect(repository.requests.last.requestId, id);
      expect(repository.requests.last.deviceId, 'device-a');
      expect(repository.requests.last.doorId, 'door-a');
      expect(commands.isLoading, isTrue);
      await commands.open(deviceId: 'device-b', doorId: 'door-b');
      expect(repository.requests, hasLength(2));
      gate.complete(door.receipt(status: DoorOperationStatus.confirmed));
      await tester.pumpAndSettle();
      expect(find.text(l10n(tester).homeCommandConfirmed), findsOneWidget);
      expect(find.text(l10n(tester).unlockGranted), findsNothing);
      expect(commands.hasUnresolvedOperation, isFalse);
      expect(store.records, isEmpty);
      await tester.tap(find.text(l10n(tester).commonClose));
      await tester.pumpAndSettle();
      expect(find.byType(DoorCommandStatusCard), findsNothing);
      expect(find.text(l10n(tester).homeCommandConfirmed), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets('failed lookup remains usable and never blindly resends', (
    tester,
  ) async {
    await prepare();
    await loseResponse();
    repository.onLookup = () async => throw const NetworkError();
    await mount(tester);
    await recover(tester);
    expect(find.text(l10n(tester).errorNetwork), findsOneWidget);
    await tester.tap(find.text(l10n(tester).homeCommandRetrySameRequest));
    await tester.pumpAndSettle();
    expect(repository.requests, hasLength(1));
    expect(commands.hasUnresolvedOperation, isTrue);
    repository.onLookup = () async => null;
    repository.onRequest = () async => door.receipt();
    await tester.tap(find.text(l10n(tester).homeCommandRetrySameRequest));
    await tester.pumpAndSettle();
    expect(repository.requests, hasLength(2));
    expect(find.text(l10n(tester).homeCommandPending), findsOneWidget);
    expect(find.text(l10n(tester).homeCommandRetrySameRequest), findsNothing);
    repository.onOperation = () async =>
        door.receipt(status: DoorOperationStatus.failed);
    await tester.tap(find.text(l10n(tester).homeCommandCheckStatus));
    await tester.pumpAndSettle();
    expect(find.text(l10n(tester).homeCommandFailed), findsOneWidget);
    expect(commands.hasUnresolvedOperation, isFalse);
    expect(repository.requests, hasLength(2));
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('logout during retry lookup cannot submit or expose old state', (
    tester,
  ) async {
    await prepare();
    await loseResponse();
    final id = commands.requestId;
    await mount(tester);
    await recover(tester);
    final gate = Completer<DoorOperation?>();
    repository.onLookup = () => gate.future;
    await tester.tap(find.text(l10n(tester).homeCommandRetrySameRequest));
    await tester.pump();
    await auth.signOut();
    await commands.synchronizeSession(auth, deployment: door.scopeA.deployment);
    gate.complete(null);
    await tester.pumpAndSettle();
    expect(repository.requests, hasLength(1));
    expect(store.records[door.scopeA]?.requestId, id);
    expect(find.text(l10n(tester).errorAuthExpired), findsOneWidget);
    expect(find.text(l10n(tester).homeCommandRetrySameRequest), findsNothing);
    expect(find.text(l10n(tester).homeCommandCheckStatus), findsNothing);
    // Even a new session for the same employee cannot reactivate the old
    // dialog. Closing and reopening establishes the new session's ownership.
    repository.onLookup = () async => null;
    await auth.signIn('a@example.test', 'synthetic-password');
    await commands.synchronizeSession(auth, deployment: door.scopeA.deployment);
    await tester.pumpAndSettle();
    expect(find.text(l10n(tester).errorAuthExpired), findsOneWidget);
    expect(find.text(l10n(tester).homeCommandRetrySameRequest), findsNothing);
    await tester.tap(find.text(l10n(tester).commonClose));
    await tester.pumpAndSettle();
    await recover(tester);
    expect(find.text(l10n(tester).homeCommandRetrySameRequest), findsOneWidget);
    expect(commands.requestId, id);
    expect(repository.requests, hasLength(1));
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets(
    'revoked permission is shown and uncertain intention stays protected',
    (tester) async {
      await prepare();
      await loseResponse();
      final id = commands.requestId;
      await mount(tester);
      await recover(tester);
      repository.onRequest = () async =>
          throw const BusinessError(message: '', code: 'ACCESS_DENIED');
      await tester.tap(find.text(l10n(tester).homeCommandRetrySameRequest));
      await tester.pumpAndSettle();
      expect(find.text(l10n(tester).accessDenied), findsOneWidget);
      expect(commands.requestId, id);
      expect(commands.hasUnresolvedOperation, isTrue);
      await commands.open(deviceId: 'device-b');
      expect(repository.requests, hasLength(2));
      expect(repository.requests.last.requestId, id);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets('failed store restore has a read-only recovery path', (
    tester,
  ) async {
    await prepare();
    commands.dispose();
    store.records[door.scopeA] = door.storedIntent;
    store.readError = StateError('synthetic read failure');
    commands = DoorOperationProvider(repository: repository, store: store);
    await commands.synchronizeSession(auth, deployment: door.scopeA.deployment);
    await mount(tester);
    await recover(tester);
    expect(find.text(l10n(tester).homeCommandCheckStatus), findsOneWidget);
    expect(find.text(l10n(tester).homeCommandRetrySameRequest), findsNothing);
    expect(repository.requests, isEmpty);
    store.readError = null;
    await tester.tap(find.text(l10n(tester).homeCommandCheckStatus));
    await tester.pumpAndSettle();
    expect(find.text(l10n(tester).homeCommandRetrySameRequest), findsOneWidget);
    expect(commands.requestId, door.storedIntent.requestId);
    expect(repository.requests, isEmpty);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('a known pending receipt is reconciled instead of resubmitted', (
    tester,
  ) async {
    await prepare();
    await loseResponse();
    await mount(tester);
    await recover(tester);
    repository.onLookup = () async => door.receipt();
    await tester.tap(find.text(l10n(tester).homeCommandRetrySameRequest));
    await tester.pumpAndSettle();
    expect(repository.requests, hasLength(1));
    expect(find.text(l10n(tester).homeCommandPending), findsOneWidget);
    expect(find.text(l10n(tester).homeCommandRetrySameRequest), findsNothing);
    expect(commands.hasUnresolvedOperation, isTrue);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  for (final locale in [const Locale('en'), const Locale('tr')]) {
    testWidgets(
      'recovery is accessible at narrow width and large text in $locale',
      (tester) async {
        await prepare();
        final semantics = tester.ensureSemantics();
        tester.view.physicalSize = const Size(320, 800);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await loseResponse();
        await tester.pumpWidget(app(locale: locale, scale: 2));
        await tester.pumpAndSettle();
        await recover(tester);
        expect(tester.takeException(), isNull);
        final retry = l10n(tester).homeCommandRetrySameRequest;
        expect(
          find.bySemanticsLabel(RegExp(RegExp.escape(retry))),
          findsOneWidget,
        );
        final close = find.text(l10n(tester).commonClose);
        await tester.ensureVisible(close);
        await tester.tap(close);
        await tester.pumpAndSettle();
        expect(find.byType(DoorOperationRecoveryDialog), findsNothing);
        expect(repository.requests, hasLength(1));
        await tester.pumpWidget(const SizedBox.shrink());
        semantics.dispose();
      },
    );
  }
}
