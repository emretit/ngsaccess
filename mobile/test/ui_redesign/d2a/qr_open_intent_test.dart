import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/models/attendance_summary.dart';
import 'package:ngsplusapp/providers/attendance_provider.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/door_operation_provider.dart';
import 'package:ngsplusapp/providers/preferred_device_provider.dart';
import 'package:ngsplusapp/repositories/door_operation_repository.dart';
import 'package:ngsplusapp/router/app_router.dart';
import 'package:ngsplusapp/router/qr_open_intent.dart';
import 'package:ngsplusapp/screens/qr_scan/qr_scan_screen.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import 'package:provider/provider.dart';

import '../../auth_fakes.dart';
import '../../helpers/mocks.dart';

class _Attendance extends AttendanceProvider {
  _Attendance() : super(repository: MockAttendanceRepository());
  @override
  Future<AttendanceSummary?> loadDailySummary() async => null;
}

void main() {
  test('scan is an internal intent, not an external URL return target', () {
    expect(normalizeAppLocation(Uri.parse('/qr?mode=scan')), AppRoute.qr);
    expect(safeReturnTarget('/qr?mode=scan'), isNull);
    final first = QrOpenIntent.requestScan(sessionEpoch: 1);
    final next = QrOpenIntent.requestScan(sessionEpoch: 1);
    expect(next.revision, greaterThan(first.revision));
  });

  testWidgets('home scan opens the cold and retained QR branch in scan mode', (
    tester,
  ) async {
    final auth = AuthProvider(
      repository: FakeAuthRepository(),
      sessionStore: FakeSessionStore(),
    );
    final attendance = _Attendance();
    final preferred = PreferredDeviceProvider();
    final commands = DoorOperationProvider(
      repository: DoorOperationRepository(MockHttpConvexClient()),
    );
    await auth.signIn('fixture@example.test', 'fixture-password');
    final router = buildRouter(auth, initialLocation: AppRoute.home);
    tester.view.physicalSize = const Size(430, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthProvider>.value(value: auth),
          ChangeNotifierProvider<AttendanceProvider>.value(value: attendance),
          ChangeNotifierProvider<PreferredDeviceProvider>.value(
            value: preferred,
          ),
          ChangeNotifierProvider<DoorOperationProvider>.value(value: commands),
        ],
        child: MaterialApp.router(
          routerConfig: router,
          theme: AppTheme.lightTheme,
          locale: const Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
        ),
      ),
    );
    await tester.pumpAndSettle();
    Future<void> scanFromHome() async {
      await tester.tap(find.text('Scan QR code'));
      await tester.pumpAndSettle();
      expect(router.routeInformationProvider.value.uri.path, AppRoute.qr);
      expect(
        tester
            .widget<AppSegmentControl<QrTab>>(
              find.byType(AppSegmentControl<QrTab>),
            )
            .selected,
        QrTab.scan,
      );
    }

    await scanFromHome();
    await tester.tap(find.text('My QR'));
    await tester.pumpAndSettle();
    router.go(AppRoute.home);
    await tester.pumpAndSettle();
    await scanFromHome();
    await tester.tap(find.text('My QR'));
    await tester.pumpAndSettle();
    router.go(AppRoute.home);
    await tester.pumpAndSettle();
    // Plain navigation preserves the previously selected code tab.
    router.go(AppRoute.qr);
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<AppSegmentControl<QrTab>>(
            find.byType(AppSegmentControl<QrTab>),
          )
          .selected,
      QrTab.code,
    );
    expect(find.byType(QRScanScreen), findsOneWidget);
    final previousEpochIntent = QrOpenIntent.requestScan(
      sessionEpoch: auth.sessionEpoch,
    );
    router.go(AppRoute.qr, extra: previousEpochIntent);
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<AppSegmentControl<QrTab>>(
            find.byType(AppSegmentControl<QrTab>),
          )
          .selected,
      QrTab.scan,
    );
    await auth.signIn('fixture@example.test', 'fixture-password');
    await tester.pumpAndSettle();
    // A new session drops the earlier account's pending scan intent.
    expect(
      tester
          .widget<AppSegmentControl<QrTab>>(
            find.byType(AppSegmentControl<QrTab>),
          )
          .selected,
      QrTab.code,
    );
    router.go(AppRoute.home);
    await tester.pumpAndSettle();
    router.go(AppRoute.qr, extra: previousEpochIntent);
    await tester.pumpAndSettle();
    final screen = tester.widget<QRScanScreen>(find.byType(QRScanScreen));
    expect(screen.initialTab, QrTab.code);
    expect(screen.scanRequestRevision, 0);
    expect(
      tester
          .widget<AppSegmentControl<QrTab>>(
            find.byType(AppSegmentControl<QrTab>),
          )
          .selected,
      QrTab.code,
    );
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    router.dispose();
    commands.dispose();
    preferred.dispose();
    attendance.dispose();
    auth.dispose();
  });
}
