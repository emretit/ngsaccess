import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/models/attendance_summary.dart';
import 'package:ngsplusapp/models/device.dart';
import 'package:ngsplusapp/models/door_operation.dart';
import 'package:ngsplusapp/repositories/door_operation_repository.dart';
import 'package:ngsplusapp/providers/attendance_provider.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/door_operation_provider.dart';
import 'package:ngsplusapp/providers/preferred_device_provider.dart';
import 'package:ngsplusapp/repositories/device_repository.dart';
import 'package:ngsplusapp/screens/home/home_screen.dart';
import 'package:ngsplusapp/widgets/cards/quick_action_card.dart';
import 'package:provider/provider.dart';

import '../helpers/mocks.dart';

class _Commands extends DoorOperationProvider {
  _Commands()
    : super(repository: DoorOperationRepository(MockHttpConvexClient()));
  final opens = <({String deviceId, String? doorId})>[];
  bool unresolved = false;
  @override
  bool get isLoading => false;
  @override
  bool get hasUnresolvedOperation => unresolved;
  @override
  DoorOperation? get operation => null;
  @override
  AppError? get error => null;
  @override
  Future<void> open({required String deviceId, String? doorId}) async {
    opens.add((deviceId: deviceId, doorId: doorId));
  }
}

class _Preferred extends PreferredDeviceProvider {
  String? selectedDevice = 'controller';
  String selectedDoor = 'north-door';
  String selectedTarget = 'controller:north-door';
  int generation = 1;
  @override
  String? get deviceId => selectedDevice;
  @override
  String? get doorId => selectedDevice == null ? null : selectedDoor;
  @override
  String? get targetId => selectedDevice == null ? null : selectedTarget;
  @override
  String? get deviceName => selectedDevice == null ? null : 'North entrance';
  @override
  bool get hasDevice => selectedDevice != null;
  @override
  int get identityGeneration => generation;
  @override
  Future<bool> revalidate(List<Device> devices) async => true;
  void changeAccount() {
    selectedDevice = null;
    generation++;
    notifyListeners();
  }

  void changeSelection() {
    selectedDevice = 'other-controller';
    selectedDoor = 'south-door';
    selectedTarget = 'other-controller:south-door';
    notifyListeners();
  }
}

class _Auth extends AuthProvider {
  _Auth() : super(repository: MockAuthRepository());
  int epoch = 1;
  @override
  int get sessionEpoch => epoch;
  @override
  bool get isAuthenticated => true;
  @override
  String get sessionToken => 'synthetic-session';
  @override
  AuthUser get currentUser => const AuthUser(
    id: 'employee',
    email: '',
    firstName: 'A long synthetic first name',
    lastName: '',
    cardNumber: '',
  );
  void changeAccount() {
    epoch++;
    notifyListeners();
  }
}

class _Attendance extends AttendanceProvider {
  _Attendance() : super(repository: MockAttendanceRepository());
  int dailyLoads = 0;
  int historyLoads = 0;
  bool loaded = false;
  bool loading = true;
  AppError? problem;
  @override
  bool get isSummaryLoading => loading;
  @override
  bool get hasSummaryLoaded => loaded;
  @override
  bool get isTodayStatusKnown => true;
  @override
  AppError? get summaryError => problem;
  @override
  DateTime? get summaryUpdatedAt => null;
  @override
  Future<AttendanceSummary?> loadDailySummary() async {
    dailyLoads++;
    return null;
  }

  @override
  Future<void> loadAttendanceRecords() async {
    historyLoads++;
  }

  void fail() {
    loading = false;
    problem = const NetworkError();
    notifyListeners();
  }

  void empty() {
    loading = false;
    loaded = true;
    problem = null;
    notifyListeners();
  }
}

class _Devices extends DeviceRepository {
  _Devices() : super(MockHttpConvexClient());
  int calls = 0;
  Completer<List<Device>>? _result;
  Completer<List<Device>> get result =>
      _result ?? (throw StateError('No target list request'));
  @override
  Future<List<Device>> listForEmployee() {
    calls++;
    // Bind the controlled Future to the requesting widget test's async zone.
    final request = Completer<List<Device>>();
    _result = request;
    return request.future;
  }
}

const _target = Device(
  id: 'controller',
  name: 'Controller',
  doorId: 'north-door',
  targetId: 'controller:north-door',
  doorName: 'North entrance',
  canOpen: true,
);

void main() {
  late _Auth auth;
  late _Attendance attendance;
  late _Devices devices;
  late _Commands commands;
  late _Preferred preferred;

  void prepare() {
    auth = _Auth();
    attendance = _Attendance();
    devices = _Devices();
    commands = _Commands();
    preferred = _Preferred();
  }

  tearDown(() {
    attendance.dispose();
    auth.dispose();
    preferred.dispose();
    commands.dispose();
  });

  Widget wrap() => MultiProvider(
    providers: [
      ChangeNotifierProvider<AuthProvider>.value(value: auth),
      ChangeNotifierProvider<AttendanceProvider>.value(value: attendance),
      ChangeNotifierProvider<PreferredDeviceProvider>.value(value: preferred),
      ChangeNotifierProvider<DoorOperationProvider>.value(value: commands),
      Provider<DeviceRepository>.value(value: devices),
    ],
    child: MaterialApp(
      locale: const Locale('en'),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      home: const HomeScreen(),
    ),
  );

  Finder unlock() => find.byWidgetPredicate(
    (widget) => widget is QuickActionCard && widget.icon == Icons.lock_open,
  );

  Future<void> mount(WidgetTester tester, {bool unresolved = false}) async {
    prepare();
    commands.unresolved = unresolved;
    tester.view.physicalSize = const Size(430, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(wrap());
    await tester.pump();
  }

  Future<void> unmount(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  }

  testWidgets(
    'home requests independent summary and recovers from first-load error',
    (tester) async {
      await mount(tester);
      final l10n = AppLocalizations.of(tester.element(find.byType(HomeScreen)));
      expect(attendance.dailyLoads, 1);
      expect(attendance.historyLoads, 0);
      expect(find.text(l10n.homeStatusNone), findsNothing);
      attendance.fail();
      await tester.pump();
      expect(find.text(l10n.homeDataUnavailable), findsOneWidget);
      await tester.tap(find.text(l10n.homeRetry));
      await tester.pump();
      expect(attendance.dailyLoads, 2);
      attendance.empty();
      await tester.pump();
      expect(find.text(l10n.homeStatusNone), findsOneWidget);
      expect(find.text(l10n.homeDataUnavailable), findsNothing);
      await unmount(tester);
    },
  );

  testWidgets(
    'two taps during target validation submit exactly one command to the selected door',
    (tester) async {
      await mount(tester);
      await tester.ensureVisible(unlock());
      await tester.tap(unlock());
      await tester.tap(unlock());
      expect(devices.calls, 1);
      expect(commands.opens, isEmpty);
      devices.result.complete([_target]);
      await tester.pump();
      await tester.pump();
      expect(commands.opens, [(deviceId: 'controller', doorId: 'north-door')]);
      await unmount(tester);
    },
  );

  testWidgets('late target response after account change cannot open a door', (
    tester,
  ) async {
    await mount(tester);
    await tester.ensureVisible(unlock());
    await tester.tap(unlock());
    auth.changeAccount();
    preferred.changeAccount();
    devices.result.complete([_target]);
    await tester.pump();
    await tester.pump();
    expect(commands.opens, isEmpty);
    expect(tester.takeException(), isNull);
    await unmount(tester);
  });

  testWidgets(
    'changing the selected target during validation never redirects an earlier open intention',
    (tester) async {
      await mount(tester);
      await tester.ensureVisible(unlock());
      await tester.tap(unlock());
      preferred.changeSelection();
      devices.result.complete([
        _target,
        const Device(
          id: 'other-controller',
          name: 'Other controller',
          doorId: 'south-door',
          targetId: 'other-controller:south-door',
          canOpen: true,
        ),
      ]);
      await tester.pump();
      await tester.pump();
      expect(commands.opens, isEmpty);
      expect(preferred.deviceId, 'other-controller');
      await unmount(tester);
    },
  );

  testWidgets(
    'network validation error preserves preference and is not access denied',
    (tester) async {
      await mount(tester);
      await tester.ensureVisible(unlock());
      await tester.tap(unlock());
      devices.result.completeError(const NetworkError());
      await tester.pump();
      await tester.pump();
      final l10n = AppLocalizations.of(tester.element(find.byType(HomeScreen)));
      expect(preferred.deviceId, 'controller');
      expect(preferred.doorId, 'north-door');
      expect(commands.opens, isEmpty);
      expect(find.text(l10n.errorNetwork), findsOneWidget);
      expect(find.text(l10n.unlockDenied), findsNothing);
      await unmount(tester);
    },
  );

  testWidgets(
    'unresolved operation disables new open without revalidating or resubmitting',
    (tester) async {
      await mount(tester, unresolved: true);
      await tester.ensureVisible(unlock());
      await tester.tap(unlock());
      expect(devices.calls, 0);
      expect(commands.opens, isEmpty);
      final action = tester.widget<QuickActionCard>(unlock());
      expect(action.onTap, isNull);
      await unmount(tester);
    },
  );
}
