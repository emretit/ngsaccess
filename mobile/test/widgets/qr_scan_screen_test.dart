import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:mocktail/mocktail.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/repositories/qr_repository.dart';
import 'package:ngsplusapp/screens/qr_scan/qr_scan_screen.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:qr_flutter/qr_flutter.dart';

class MockQrRepository extends Mock implements QrRepository {}

class MockCameraController extends Mock implements MobileScannerController {}

void main() {
  late MockQrRepository repository;
  late MockCameraController camera;
  late ValueNotifier<MobileScannerState> cameraState;
  final now = DateTime.utc(2026, 10, 19, 12);
  QrToken token() => QrToken(
    value: 'fixture-token',
    expiresAt: now.add(const Duration(seconds: 45)),
    serverTime: now,
  );

  setUp(() {
    repository = MockQrRepository();
    camera = MockCameraController();
    cameraState = ValueNotifier(const MobileScannerState.uninitialized());
    when(() => repository.sessionKey).thenReturn('fixture-session');
    when(() => repository.createToken()).thenAnswer((_) async => token());
    when(() => camera.autoStart).thenReturn(false);
    when(() => camera.value).thenAnswer((_) => cameraState.value);
    when(
      () => camera.barcodes,
    ).thenAnswer((_) => const Stream<BarcodeCapture>.empty());
    when(() => camera.addListener(any())).thenAnswer((call) {
      cameraState.addListener(call.positionalArguments.first as VoidCallback);
    });
    when(() => camera.removeListener(any())).thenAnswer((call) {
      cameraState.removeListener(
        call.positionalArguments.first as VoidCallback,
      );
    });
    when(() => camera.start()).thenAnswer((_) async {
      cameraState.value = cameraState.value.copyWith(isRunning: true);
    });
    when(() => camera.stop()).thenAnswer((_) async {
      cameraState.value = cameraState.value.copyWith(isRunning: false);
    });
    when(() => camera.dispose()).thenAnswer((_) async {});
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('dev.steenbakker.mobile_scanner/scanner/method'),
          (_) async => null,
        );
  });

  Widget app({
    bool active = true,
    PermissionStatus permission = PermissionStatus.granted,
    double textScale = 1,
    Future<PermissionStatus> Function()? permissionStatus,
    Future<bool> Function()? openSettings,
  }) => MaterialApp(
    locale: const Locale('en'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(
        context,
      ).copyWith(textScaler: TextScaler.linear(textScale)),
      child: child ?? const SizedBox.shrink(),
    ),
    home: QRScanScreen(
      isActive: active,
      repository: repository,
      cameraController: camera,
      requestCameraPermission: () async => permission,
      cameraPermissionStatus: permissionStatus ?? () async => permission,
      openSettings: openSettings,
    ),
  );

  Future<void> scanTab(WidgetTester tester) async {
    await tester.tap(find.text('Scan'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump();
    await tester.pump();
  }

  testWidgets(
    'camera runs only in visible scan tab and pauses in background; caller retains ownership',
    (tester) async {
      await tester.pumpWidget(app());
      await tester.pump();
      verifyNever(() => camera.start());
      await scanTab(tester);
      expect(camera.value.isRunning, isTrue);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      expect(camera.value.isRunning, isFalse);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      await tester.pump();
      expect(camera.value.isRunning, isTrue);
      await tester.pumpWidget(app(active: false));
      await tester.pump();
      expect(camera.value.isRunning, isFalse);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
      verifyNever(() => camera.dispose());
    },
  );

  testWidgets('a pending camera switch cannot restart a hidden branch', (
    tester,
  ) async {
    final switching = Completer<void>();
    cameraState.value = cameraState.value.copyWith(availableCameras: 2);
    when(() => camera.switchCamera()).thenAnswer((_) async {
      cameraState.value = cameraState.value.copyWith(isRunning: false);
      await switching.future;
      cameraState.value = cameraState.value.copyWith(isRunning: true);
    });
    await tester.pumpWidget(app());
    await tester.pump();
    await scanTab(tester);
    await tester.tap(find.byTooltip('Switch camera'));
    await tester.pump();
    await tester.pumpWidget(app(active: false));
    switching.complete();
    await tester.pump();
    await tester.pump();
    expect(camera.value.isRunning, isFalse);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets(
    'late token error after widget removal has no lifecycle exception',
    (tester) async {
      final pending = Completer<QrToken>();
      when(() => repository.createToken()).thenAnswer((_) => pending.future);
      await tester.pumpWidget(app());
      await tester.pump();
      await tester.pumpWidget(const SizedBox.shrink());
      pending.completeError(StateError('fixture failure'));
      await tester.pump();
      expect(tester.takeException(), isNull);
      verifyNever(() => camera.dispose());
    },
  );

  testWidgets(
    'same label cannot stack modals or retrigger until observed absent',
    (tester) async {
      await tester.pumpWidget(app());
      await tester.pump();
      await scanTab(tester);
      void detect(BarcodeCapture capture) {
        tester
            .widget<MobileScanner>(find.byType(MobileScanner))
            .onDetect
            ?.call(capture);
      }

      const code = BarcodeCapture(barcodes: [Barcode(rawValue: 'j-SERIAL')]);
      detect(code);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byType(AlertDialog), findsOneWidget);
      expect(camera.value.isRunning, isFalse);
      detect(code);
      await tester.pump();
      expect(find.byType(AlertDialog), findsOneWidget);
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      detect(code);
      await tester.pump();
      expect(find.byType(AlertDialog), findsNothing);
      detect(const BarcodeCapture());
      detect(code);
      await tester.pump();
      expect(find.byType(AlertDialog), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('permanently denied camera offers settings and never starts', (
    tester,
  ) async {
    await tester.pumpWidget(
      app(permission: PermissionStatus.permanentlyDenied),
    );
    await tester.pump();
    await scanTab(tester);
    expect(find.text('Open settings'), findsOneWidget);
    verifyNever(() => camera.start());
    await tester.pumpWidget(const SizedBox.shrink());
  });

  for (final code in [
    MobileScannerErrorCode.unsupported,
    MobileScannerErrorCode.genericError,
  ]) {
    testWidgets('granted camera with $code does not ask for permission', (
      tester,
    ) async {
      await tester.pumpWidget(app());
      await tester.pump();
      await scanTab(tester);
      cameraState.value = cameraState.value.copyWith(
        isInitialized: true,
        error: MobileScannerException(
          errorCode: code,
          errorDetails: const MobileScannerErrorDetails(
            message: 'private-native-error',
          ),
        ),
      );
      await tester.pump();
      expect(find.text('Camera unavailable. Try again.'), findsOneWidget);
      expect(
        find.text('Camera permission is required to scan QR codes.'),
        findsNothing,
      );
      expect(find.textContaining('private-native-error'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    });
  }

  testWidgets(
    'settings return rechecks permission and restarts exactly one camera',
    (tester) async {
      var permission = PermissionStatus.permanentlyDenied;
      var settingsCalls = 0;
      await tester.pumpWidget(
        app(
          permission: permission,
          permissionStatus: () async => permission,
          openSettings: () async {
            settingsCalls++;
            return true;
          },
        ),
      );
      await tester.pump();
      await scanTab(tester);
      await tester.tap(find.text('Open settings'));
      await tester.pump();
      expect(settingsCalls, 1);
      permission = PermissionStatus.granted;
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      await tester.pump();
      expect(camera.value.isRunning, isTrue);
      verify(() => camera.start()).called(1);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    },
  );

  testWidgets(
    'short landscape at 200% text keeps QR and refresh reachable by scrolling',
    (tester) async {
      tester.view.physicalSize = const Size(568, 320);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(app(textScale: 2));
      await tester.pump();
      expect(find.byType(QrImageView), findsOneWidget);
      await tester.ensureVisible(find.byKey(const Key('qr-refresh')));
      await tester.pump();
      expect(find.byKey(const Key('qr-refresh')).hitTestable(), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
