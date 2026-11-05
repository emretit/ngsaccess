import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:mocktail/mocktail.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/models/door_operation.dart';
import 'package:ngsplusapp/models/attendance_summary.dart';
import 'package:ngsplusapp/providers/attendance_provider.dart';
import 'package:ngsplusapp/providers/preferred_device_provider.dart';
import 'package:ngsplusapp/screens/home/home_screen.dart';
import 'package:provider/provider.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/door_operation_provider.dart';
import 'package:ngsplusapp/repositories/door_operation_repository.dart';
import 'package:ngsplusapp/screens/qr_scan/qr_scan_screen.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/door_operation_recovery_dialog.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../screenshot_test/_harness.dart'
    show loadAuditFonts, resolveAuditFontFallbacks;

import '../../auth_fakes.dart';
import '../../helpers/mocks.dart';
import '../../helpers/camera_fakes.dart' show MockCameraController;

const _captureKey = Key('d2a-layout-capture');
const _output = String.fromEnvironment('AUDIT_OUTPUT_DIR');

class _RecoverableCommands extends DoorOperationProvider {
  _RecoverableCommands()
    : super(repository: DoorOperationRepository(MockHttpConvexClient()));
  int checks = 0;
  @override
  DoorOperation get operation => DoorOperation(
    operationId: 'original-operation',
    status: DoorOperationStatus.unknown,
    deviceId: 'original-device',
    doorId: 'original-door',
    deviceName: 'Ana Giriş',
    requestedAt: DateTime.utc(2026, 11, 4, 10, 19),
  );
  @override
  bool get hasUnresolvedOperation => true;
  @override
  Future<void> checkStatus() async {
    checks++;
  }
}

class _HomeAttendance extends AttendanceProvider {
  _HomeAttendance() : super(repository: MockAttendanceRepository());
  @override
  bool get hasSummaryLoaded => true;
  @override
  bool get isTodayStatusKnown => true;
  @override
  Future<AttendanceSummary?> loadDailySummary() async => null;
}

Widget _app(Widget body, {required bool dark, required double scale}) =>
    MaterialApp(
      theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
      locale: const Locale('tr'),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      builder: (context, child) => RepaintBoundary(
        key: _captureKey,
        child: MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: child ?? const SizedBox.shrink(),
        ),
      ),
      home: body,
    );

Future<void> _capture(WidgetTester tester, String name) async {
  if (_output.isNotEmpty) {
    await resolveAuditFontFallbacks(tester);
    await expectLater(
      find.byKey(_captureKey),
      matchesGoldenFile(Uri.file('$_output/$name.png')),
    );
  }
}

void main() {
  setUpAll(() async {
    if (_output.isNotEmpty) {
      await loadAuditFonts();
    }
  });
  for (final dark in [false, true]) {
    testWidgets(
      'whole Home stays reachable at 320dp and 200% with a long name dark=$dark',
      (tester) async {
        final repository = FakeAuthRepository();
        repository.onSignIn = (_, _) async => authResult(
          user: const AuthUser(
            id: 'long-name-user',
            email: 'fixture@example.test',
            firstName: 'Çok uzun birinci ikinci üçüncü ad',
            lastName: 'Birden fazla uzun soyadı',
            cardNumber: 'fixture-card',
            projectId: 'fixture-project',
            projectName: 'Uzun kurum ve proje adı',
          ),
        );
        final auth = AuthProvider(
          repository: repository,
          sessionStore: FakeSessionStore(),
        );
        await auth.signIn('fixture@example.test', 'fixture-password');
        final attendance = _HomeAttendance();
        final preferred = PreferredDeviceProvider();
        final commands = _RecoverableCommands();
        tester.view.physicalSize = const Size(320, 844);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          _app(
            MultiProvider(
              providers: [
                ChangeNotifierProvider<AuthProvider>.value(value: auth),
                ChangeNotifierProvider<AttendanceProvider>.value(
                  value: attendance,
                ),
                ChangeNotifierProvider<PreferredDeviceProvider>.value(
                  value: preferred,
                ),
                ChangeNotifierProvider<DoorOperationProvider>.value(
                  value: commands,
                ),
              ],
              child: const HomeScreen(),
            ),
            dark: dark,
            scale: 2,
          ),
        );
        await tester.pumpAndSettle();
        expect(commands.checks, 1);
        expect(find.textContaining('Çok uzun birinci'), findsOneWidget);
        final lastAction = find.text('Ziyaretçi davet et');
        await tester.ensureVisible(lastAction);
        await tester.pumpAndSettle();
        expect(lastAction.hitTestable(), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump();
        commands.dispose();
        preferred.dispose();
        attendance.dispose();
        auth.dispose();
      },
    );

    for (final scale in [dark ? 2.0 : 1.0]) {
      final label = '${dark ? 'dark' : 'light'}_$scale';
      testWidgets(
        'recoverable door snapshot and status action stay reachable $label',
        (tester) async {
          final auth = AuthProvider(
            repository: FakeAuthRepository(),
            sessionStore: FakeSessionStore(),
          );
          await auth.signIn('fixture@example.test', 'fixture-password');
          final commands = _RecoverableCommands();
          tester.view.physicalSize = Size(scale == 1 ? 390 : 320, 844);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          await tester.pumpWidget(
            _app(
              Builder(
                builder: (context) => Scaffold(
                  body: TextButton(
                    onPressed: () => unawaited(
                      showDialog<void>(
                        context: context,
                        builder: (_) => DoorOperationRecoveryDialog(
                          commands: commands,
                          auth: auth,
                        ),
                      ),
                    ),
                    child: const Text('Open recovery'),
                  ),
                ),
              ),
              dark: dark,
              scale: scale,
            ),
          );
          await tester.tap(find.text('Open recovery'));
          await tester.pumpAndSettle();
          expect(find.text('Ana Giriş'), findsOneWidget);
          expect(commands.checks, 1);
          final check = find.text('Durumu kontrol et');
          await tester.ensureVisible(check);
          await tester.tap(check);
          await tester.pumpAndSettle();
          expect(commands.checks, 2);
          expect(find.text('Aynı isteği yeniden gönder'), findsNothing);
          expect(tester.takeException(), isNull);
          await _capture(tester, 'd2a_door_snapshot_$label');
          await tester.ensureVisible(find.text('Kapat'));
          await tester.tap(find.text('Kapat'));
          await tester.pumpAndSettle();
          await tester.pumpWidget(const SizedBox.shrink());
          commands.dispose();
          auth.dispose();
        },
      );

      testWidgets('permitted camera frame and controls can scroll at $label', (
        tester,
      ) async {
        final camera = MockCameraController();
        final state = ValueNotifier(
          const MobileScannerState.uninitialized().copyWith(
            availableCameras: 2,
            isRunning: true,
            torchState: TorchState.off,
          ),
        );
        when(() => camera.autoStart).thenReturn(false);
        when(() => camera.value).thenAnswer((_) => state.value);
        when(
          () => camera.barcodes,
        ).thenAnswer((_) => const Stream<BarcodeCapture>.empty());
        when(() => camera.addListener(any())).thenAnswer(
          (call) =>
              state.addListener(call.positionalArguments.first as VoidCallback),
        );
        when(() => camera.removeListener(any())).thenAnswer(
          (call) => state.removeListener(
            call.positionalArguments.first as VoidCallback,
          ),
        );
        when(() => camera.stop()).thenAnswer((_) async {});
        when(() => camera.start()).thenAnswer((_) async {});
        when(() => camera.switchCamera()).thenAnswer((_) async {});
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(
              const MethodChannel(
                'dev.steenbakker.mobile_scanner/scanner/method',
              ),
              (_) async => null,
            );
        tester.view.physicalSize = Size(scale == 1 ? 390 : 320, 844);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          _app(
            QRScanScreen(
              initialTab: QrTab.scan,
              cameraController: camera,
              requestCameraPermission: () async => PermissionStatus.granted,
            ),
            dark: dark,
            scale: scale,
          ),
        );
        for (var i = 0; i < 5; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(find.byType(MobileScanner), findsOneWidget);
        expect(find.text('QR kodu çerçeveye alın'), findsOneWidget);
        final switchCamera = find.byTooltip('Kamerayı değiştir');
        await tester.ensureVisible(switchCamera);
        await tester.tap(switchCamera);
        await tester.pump();
        verify(() => camera.switchCamera()).called(1);
        expect(tester.takeException(), isNull);
        await _capture(tester, 'd2a_camera_$label');
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump();
        state.dispose();
      });
    }
  }
}
