import 'dart:async';
import 'dart:io';
import 'dart:ui' show Tristate;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:mocktail/mocktail.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/models/employee_request.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import 'package:ngsplusapp/providers/attendance_provider.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/door_operation_provider.dart';
import 'package:ngsplusapp/providers/locale_provider.dart';
import 'package:ngsplusapp/providers/preferred_device_provider.dart';
import 'package:ngsplusapp/providers/request_provider.dart';
import 'package:ngsplusapp/providers/theme_provider.dart';
import 'package:ngsplusapp/providers/visitor_provider.dart';
import 'package:ngsplusapp/repositories/device_repository.dart';
import 'package:ngsplusapp/repositories/qr_repository.dart';
import 'package:ngsplusapp/screens/auth/forgot_password_screen.dart';
import 'package:ngsplusapp/screens/auth/login_screen.dart';
import 'package:ngsplusapp/screens/history/history_screen.dart';
import 'package:ngsplusapp/screens/home/home_screen.dart';
import 'package:ngsplusapp/screens/main_navigation_shell.dart';
import 'package:ngsplusapp/screens/profile/profile_screen.dart';
import 'package:ngsplusapp/screens/qr_scan/qr_scan_screen.dart';
import 'package:ngsplusapp/screens/requests/requests_screen.dart';
import 'package:ngsplusapp/screens/settings/select_device_screen.dart';
import 'package:ngsplusapp/screens/splash_screen.dart';
import 'package:ngsplusapp/screens/visitor/visitor_form_screen.dart';
import 'package:ngsplusapp/screens/visitor/visitor_screen.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/door_operation_recovery_dialog.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

import '../test/helpers/preference_store.dart';
import '../test/helpers/camera_fakes.dart';
import '../test/helpers/qr_fakes.dart';
import '_harness.dart';

class Shot {
  const Shot(
    this.screen,
    this.state, {
    this.dark = false,
    this.variant = '',
    this.locale = 'tr',
    this.width = 390,
    this.scale = 1,
  });
  final String screen, state, variant, locale;
  final bool dark;
  final double width, scale;
  String get filename =>
      '${screen}_${variant.isEmpty ? state : variant}_${dark ? 'dark' : 'light'}'
      '${variant == 'matrix' || width != 390 || scale != 1 || locale != 'tr' ? '_${locale}_w${width.toInt()}_s${(scale * 100).round()}' : ''}';
}

const sources = {
  'splash': 'lib/screens/splash_screen.dart',
  'login': 'lib/screens/auth/login_screen.dart',
  'forgot_password': 'lib/screens/auth/forgot_password_screen.dart',
  'home': 'lib/screens/home/home_screen.dart',
  'history': 'lib/screens/history/history_screen.dart',
  'requests': 'lib/screens/requests/requests_screen.dart',
  'request_leave_form': 'lib/screens/requests/requests_screen.dart',
  'request_correction_form': 'lib/screens/requests/requests_screen.dart',
  'visitor': 'lib/screens/visitor/visitor_screen.dart',
  'visitor_form': 'lib/screens/visitor/visitor_form_screen.dart',
  'profile': 'lib/screens/profile/profile_screen.dart',
  'select_device': 'lib/screens/settings/select_device_screen.dart',
  'qr': 'lib/screens/qr_scan/qr_scan_screen.dart',
  'door_recovery': 'lib/widgets/door_operation_recovery_dialog.dart',
  'history_filter': 'lib/widgets/history/history_filter_sheet.dart',
  'visitor_detail': 'lib/widgets/visitor/visitor_detail.dart',
};
const routes = {
  'splash': '/splash',
  'login': '/login',
  'forgot_password': '/forgot-password',
  'home': '/home',
  'history': '/history',
  'requests': '/requests',
  'request_leave_form': '/requests → Navigator.push',
  'request_correction_form': '/requests → Navigator.push',
  'visitor': '/visitor',
  'visitor_form': '/visitor → Navigator.push',
  'profile': '/profile',
  'select_device': '/select-device',
  'qr': '/qr',
  'door_recovery': '/home → dialog',
  'history_filter': '/history → sheet',
  'visitor_detail': '/visitor → sheet',
};

final shots = <Shot>[
  for (final screen in [
    'login',
    'forgot_password',
    'home',
    'history',
    'requests',
    'visitor',
    'visitor_form',
    'profile',
    'select_device',
    'qr',
    'request_leave_form',
    'request_correction_form',
  ]) ...[Shot(screen, 'filled'), Shot(screen, 'filled', dark: true)],
  for (final screen in [
    'home',
    'history',
    'requests',
    'visitor',
    'select_device',
  ]) ...[Shot(screen, 'empty'), Shot(screen, 'loading'), Shot(screen, 'error')],
  const Shot('login', 'empty'),
  const Shot('login', 'loading'),
  const Shot('login', 'loading', dark: true),
  const Shot('login', 'error'),
  const Shot('splash', 'loading'),
  const Shot('splash', 'loading', dark: true),
  const Shot('splash', 'error'),
  for (final screen in [
    'home',
    'history',
    'requests',
    'visitor',
    'profile',
    'visitor_form',
  ])
    Shot(screen, 'filled', variant: 'long'),
  const Shot('home', 'filled', variant: 'textscale130', scale: 1.3),
  const Shot('login', 'filled', variant: 'textscale130', scale: 1.3),
  const Shot('requests', 'filled', variant: 'corrections'),
  const Shot('history', 'filled', variant: 'overview'),
  const Shot('history', 'filled', variant: 'calendar'),
  const Shot('qr', 'loading'),
  const Shot('qr', 'error'),
  const Shot('qr', 'filled', variant: 'expired'),
  const Shot('qr', 'filled', variant: 'consumed'),
  const Shot('qr', 'filled', variant: 'camera_placeholder'),
  for (final screen in [
    'door_recovery',
    'history_filter',
    'visitor_detail',
  ]) ...[Shot(screen, 'open'), Shot(screen, 'open', dark: true)],
  const Shot('visitor_form', 'empty'),
  const Shot('visitor_form', 'loading'),
  const Shot('visitor_form', 'error'),
  const Shot('request_leave_form', 'empty'),
  const Shot('request_leave_form', 'error', dark: true),
  const Shot('request_correction_form', 'empty'),
  for (final screen in ['request_leave_form', 'request_correction_form']) ...[
    Shot(screen, 'loading'),
    Shot(screen, 'error'),
  ],
  const Shot('home', 'filled', variant: 'command_unknown'),
  const Shot('home', 'filled', variant: 'command_unknown', dark: true),
  const Shot('history', 'filled', variant: 'calendar', width: 360),
  const Shot('history', 'filled', variant: 'calendar', width: 320),
  const Shot('history', 'filled', variant: 'detail'),
  const Shot('visitor_form', 'empty', variant: 'validation_error'),
  const Shot('visitor_form', 'empty', variant: 'validation_notice'),
  for (final dark in [false, true]) ...[
    Shot('login', 'empty', dark: dark, variant: 'blank'),
    Shot('login', 'error', dark: dark, variant: 'auth_error'),
    Shot('requests', 'empty', dark: dark, variant: 'no_requests'),
    Shot('requests', 'filled', dark: dark, variant: 'withdraw'),
    if (dark) Shot('requests', 'filled', dark: dark, variant: 'corrections'),
    Shot('visitor', 'empty', dark: dark, variant: 'no_visitors'),
    Shot('visitor', 'error', dark: dark, variant: 'network_error'),
    Shot('visitor', 'filled', dark: dark, variant: 'cached_error'),
    Shot('visitor_detail', 'open', dark: dark, variant: 'cancel'),
    Shot('visitor_form', 'filled', dark: dark, variant: 'keyboard'),
    for (final page in [
      'theme',
      'language',
      'password',
      'details',
      'notifications',
      'help',
      'diagnostics',
      'about',
      'privacy',
      'logout',
    ])
      Shot('profile', 'filled', dark: dark, variant: page),
  ],
  for (final screen in [
    'login',
    'home',
    'history',
    'requests',
    'visitor',
    'profile',
    'qr',
  ])
    for (final locale in ['tr', 'en'])
      for (final dark in [false, true])
        for (final width in [320.0, 390.0])
          for (final scale in [1.0, 1.3, 2.0])
            Shot(
              screen,
              'filled',
              variant: 'matrix',
              locale: locale,
              dark: dark,
              width: width,
              scale: scale,
            ),
];

void main() {
  AuditTestBinding();
  setUpAll(() async {
    await loadAuditFonts();
    await initializeDateFormatting('tr');
    await initializeDateFormatting('en');
    assert(shots.map((shot) => shot.filename).toSet().length == shots.length);
    final rows = <String>[];
    for (final shot in shots) {
      final source = sources[shot.screen] ?? '';
      final lines = File(source).readAsLinesSync();
      final className = switch (shot.screen) {
        'request_leave_form' ||
        'request_correction_form' => 'class RequestFormScreen ',
        _ => 'class ',
      };
      final line = lines.indexWhere((line) => line.startsWith(className)) + 1;
      final notes = <String>[
        if (shot.screen == 'qr')
          'Sahte token; kamera yer tutucu, native kamera yok',
        if (['home', 'door_recovery'].contains(shot.screen))
          'Home başlığı sistem saatini kullanır; fixture kayıtları sabittir',
        if (shot.variant == 'long') 'İçerik ölçülür; üst sınır 2400 lp',
        if (shot.screen == 'visitor_form' && shot.state == 'filled')
          'Mevcut daveti düzenleme',
        if (shot.screen == 'login' && shot.state == 'error')
          'İş ilişkisi sona ermiş kullanıcı uyarısı',
        if ([
          'home',
          'history',
          'visitor',
          'profile',
          'qr',
        ].contains(shot.screen))
          'Gerçek MainNavigationShell ve seçili alt sekme',
      ];
      rows.add(
        '| [${shot.filename}.png](${shot.filename}.png) | ${shot.screen} | ${shot.variant.isEmpty ? shot.state : shot.variant} | ${shot.dark ? 'dark' : 'light'} · ${shot.locale} · ${shot.width.toInt()}dp · %${(shot.scale * 100).round()} | $source:$line | ${routes[shot.screen]} | ${notes.join('; ')} |',
      );
    }
    Directory(auditOutputDirectory).createSync(recursive: true);
    File('$auditOutputDirectory/INDEX.md').writeAsStringSync(
      '''# Yön B son mobil ekran görüntüleri

Üretim: `cd mobile && flutter test --no-pub --update-goldens --dart-define=AUDIT_OUTPUT_DIR=../docs/mobile-ui-audit/after-b screenshot_test/`

320/360/390×844 mantıksal, DPR 2; uzun görüntüler içerik kadar, en fazla 2400 lp.
Locale tr/en, ölçek 1.0/1.3/2.0, MediaQuery güvenli alan üst 47 / alt 34; AppTheme açık/koyu.
Roboto tüm ağırlıklar ve MaterialIcons SDK’dan, CupertinoIcons paket fontundan yüklenir.
Veriler sentetiktir; kayıt saatleri açık +03:00 ofsetlidir. Ev ekranının tarihi/selamı sistem saatine bağlıdır; talepler, geçmiş ve ziyaretçi picker saatleri auditNow fixture kullanır.

Durum kapsamı: empty/loading/error yalnız uygulamanın o ekranda sunduğu durumlar içindir.
Profil ve şifre yardımında veri yükleyen bir ekran durumu yoktur; splash yalnız loading/error sunar.
QR token için empty yoktur; kamera görüntüsü mevcut izin engeli yer tutucusuyla temsil edilir.
Formlar doldurulmuş/boş başlangıç olarak yakalanır; sunucu komutu gönderilmez.
Ana kabuktaki beş alt sekme home/history/qr/visitor/profile görüntülerine dahildir.

| Dosya | Ekran | Durum | Tema | Kaynak dosya | Route | Not |
| --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}
''',
    );
  });

  for (final shot in shots) {
    testWidgets(shot.filename, (tester) async {
      tester.view.devicePixelRatio = 2;
      tester.view.physicalSize = Size(shot.width * 2, 1688);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final state = shot.state == 'open' ? 'filled' : shot.state;
      final auth = AuditAuth(state);
      final attendance = AuditAttendance(state);
      final requests = AuditRequests(state);
      final isRequestForm =
          shot.screen == 'request_leave_form' ||
          shot.screen == 'request_correction_form';
      if (isRequestForm && state == 'loading') requests.busy = true;
      if (state == 'filled') {
        requests.leaves = [
          LeaveRequest(
            id: 'leave-1',
            leaveType: 'annual',
            startDate: '2026-11-09',
            endDate: '2026-11-11',
            status: 'pending',
            source: 'employee',
            createdAt: auditNow,
            notes:
                'Ailemle planladığım seyahat için yıllık izin talep ediyorum.',
          ),
          LeaveRequest(
            id: 'leave-2',
            leaveType: 'excuse',
            startDate: '2026-11-02',
            endDate: '2026-11-02',
            status: 'approved',
            source: 'employee',
            createdAt: auditNow,
            decisionNote: 'Uygundur. İyi günler.',
          ),
        ];
        requests.corrections = [
          AttendanceCorrectionRequest(
            id: 'correction-1',
            date: '2026-11-03',
            correctionType: 'checkIn',
            reason: 'Ana girişte kartımı okuttum; giriş kaydım görünmüyor.',
            requestedCheckIn: '09:00',
            status: 'pending',
            createdAt: auditNow,
          ),
        ];
      }
      final visitors = AuditVisitors(state);
      if (shot.screen == 'visitor' && shot.variant == 'cached_error') {
        visitors.error = const NetworkError();
      }
      final commands = AuditCommands(
        unknown:
            shot.variant == 'command_unknown' || shot.screen == 'door_recovery',
      );
      final prefs = TestPreferences();
      final preferred = PreferredDeviceProvider(
        preferencesLoader: () async => prefs,
      );
      await preferred.setIdentity(
        'ayse',
        projectId: 'ngs',
        deployment: 'offline',
      );
      await preferred.setDevice(
        id: 'panel',
        name: 'Ana Giriş',
        doorId: 'main',
        targetId: 'panel:main',
      );
      final locale = LocaleProvider(preferencesLoader: () async => prefs);
      final theme = ThemeProvider(preferencesLoader: () async => prefs);
      // Keep preference rows/radio selection consistent with the rendered app.
      expect(
        await theme.setThemeMode(shot.dark ? ThemeMode.dark : ThemeMode.light),
        isTrue,
      );
      expect(await locale.setLocale(Locale(shot.locale)), isTrue);
      final qr = MockQrRepository();
      when(() => qr.sessionKey).thenReturn('offline-audit');
      when(() => qr.createToken()).thenAnswer((_) {
        if (state == 'loading') return Completer<QrToken>().future;
        if (state == 'error') return Future.error(const NetworkError());
        return Future.value(
          QrToken(
            value: 'ngs-audit-offline-token',
            status: shot.variant == 'expired'
                ? QrTokenStatus.expired
                : shot.variant == 'consumed'
                ? QrTokenStatus.consumed
                : QrTokenStatus.active,
            expiresAt: DateTime.now().add(const Duration(seconds: 45)),
            serverTime: DateTime.now(),
          ),
        );
      });
      final camera = MockCameraController();
      when(() => camera.autoStart).thenReturn(false);
      when(
        () => camera.value,
      ).thenReturn(const MobileScannerState.uninitialized());
      when(
        () => camera.barcodes,
      ).thenAnswer((_) => const Stream<BarcodeCapture>.empty());
      when(() => camera.addListener(any())).thenAnswer((_) {});
      when(() => camera.removeListener(any())).thenAnswer((_) {});
      when(() => camera.stop()).thenAnswer((_) async {});
      when(() => camera.dispose()).thenAnswer((_) async {});

      Widget profile() => ProfileScreen(
        packageInfoLoader: () async => PackageInfo(
          appName: 'NGS Plus',
          packageName: 'com.ngs.plus',
          version: '1.0.0',
          buildNumber: '1',
        ),
      );
      Widget qrScreen() => QRScanScreen(
        repository: qr,
        cameraController: camera,
        requestCameraPermission: () async => PermissionStatus.permanentlyDenied,
        cameraPermissionStatus: () async => PermissionStatus.permanentlyDenied,
      );
      final base = switch (shot.screen) {
        'door_recovery' => 'home',
        'history_filter' => 'history',
        'visitor_detail' => 'visitor',
        _ => shot.screen,
      };
      final shells = ['home', 'history', 'qr', 'visitor', 'profile'];
      final page = switch (base) {
        'splash' => SplashScreen(
          isFailure: state == 'error',
          onRetry: () {},
          onUseLogin: () {},
        ),
        'login' => const LoginScreen(),
        'forgot_password' => const ForgotPasswordScreen(),
        'home' => const HomeScreen(),
        'history' => HistoryScreen(now: () => auditNow),
        'requests' => const RequestsScreen(),
        'request_leave_form' => RequestFormScreen(
          isLeave: true,
          now: () => auditNow,
        ),
        'request_correction_form' => RequestFormScreen(
          isLeave: false,
          now: () => auditNow,
        ),
        'visitor' => const VisitorScreen(),
        'visitor_form' => VisitorFormScreen(
          visitor: state == 'filled' ? auditVisitor : null,
          now: () => auditNow,
        ),
        'profile' => profile(),
        'select_device' => const SelectDeviceScreen(),
        'qr' => qrScreen(),
        _ => throw StateError('Unknown screenshot ${shot.screen}'),
      };
      final pushed =
          !shells.contains(base) && base != 'login' && base != 'splash';
      final navKey = GlobalKey<NavigatorState>();
      final router = GoRouter(
        navigatorKey: navKey,
        initialLocation: pushed ? '/audit-root' : '/$base',
        routes: [
          if (pushed)
            GoRoute(path: '/audit-root', builder: (_, _) => const Scaffold()),
          if (shells.contains(base))
            StatefulShellRoute.indexedStack(
              builder: (context, state, shell) =>
                  MainNavigationShell(navigationShell: shell),
              branches: [
                for (final name in shells)
                  StatefulShellBranch(
                    routes: [
                      GoRoute(
                        path: '/$name',
                        builder: (_, _) =>
                            name == base ? page : const SizedBox.shrink(),
                      ),
                    ],
                  ),
              ],
            )
          else
            GoRoute(path: '/$base', builder: (_, _) => page),
        ],
      );
      addTearDown(() {
        router.dispose();
        for (final provider in [
          auth,
          attendance,
          requests,
          visitors,
          commands,
          preferred,
          locale,
          theme,
        ]) {
          provider.dispose();
        }
      });
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: auth),
            ChangeNotifierProvider<AttendanceProvider>.value(value: attendance),
            ChangeNotifierProvider<RequestProvider>.value(value: requests),
            ChangeNotifierProvider<VisitorProvider>.value(value: visitors),
            ChangeNotifierProvider<DoorOperationProvider>.value(
              value: commands,
            ),
            ChangeNotifierProvider<PreferredDeviceProvider>.value(
              value: preferred,
            ),
            ChangeNotifierProvider<LocaleProvider>.value(value: locale),
            ChangeNotifierProvider<ThemeProvider>.value(value: theme),
            Provider<DeviceRepository>.value(value: AuditDevices(state)),
          ],
          child: RepaintBoundary(
            key: captureKey,
            child: MaterialApp.router(
              routerConfig: router,
              debugShowCheckedModeBanner: false,
              locale: Locale(shot.locale),
              supportedLocales: AppLocalizations.supportedLocales,
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              theme: AppTheme.lightTheme,
              darkTheme: AppTheme.darkTheme,
              themeMode: shot.dark ? ThemeMode.dark : ThemeMode.light,
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(context).copyWith(
                  padding: const EdgeInsets.only(top: 47, bottom: 34),
                  viewPadding: const EdgeInsets.only(top: 47, bottom: 34),
                  textScaler: TextScaler.linear(shot.scale),
                ),
                child: child ?? const SizedBox.shrink(),
              ),
            ),
          ),
        ),
      );
      if (pushed) {
        await tester.pump();
        unawaited(router.push<void>('/$base'));
      }
      // Fixed pumps also support indefinite progress indicators.
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      if (shot.screen == 'login' && state != 'empty') {
        await tester.enterText(
          find.byType(TextFormField).at(0),
          'ayse.yilmaz@example.test',
        );
        await tester.enterText(
          find.byType(TextFormField).at(1),
          'AuditPassword123',
        );
        tester.testTextInput.hide();
      }
      if (isRequestForm && (state == 'filled' || state == 'error')) {
        await tester.enterText(
          find.descendant(
            of: find.byKey(
              Key(
                shot.screen == 'request_leave_form'
                    ? 'request-notes'
                    : 'request-reason',
              ),
            ),
            matching: find.byType(TextField),
          ),
          shot.screen == 'request_leave_form'
              ? 'Aile ziyareti için yıllık izin talebi.'
              : 'Kartımı okutmama rağmen giriş saatim görünmüyor.',
        );
        tester.testTextInput.hide();
      }
      if (shot.screen == 'request_correction_form' &&
          (state == 'filled' || state == 'error')) {
        await tester.ensureVisible(
          find.byKey(const Key('request-check-in-time')),
        );
        await tester.tap(find.byKey(const Key('request-check-in-time')));
        await tester.pumpAndSettle();
        final pickerContext = tester.element(find.byType(TimePickerDialog));
        await tester.tap(
          find.text(MaterialLocalizations.of(pickerContext).okButtonLabel),
        );
        await tester.pumpAndSettle();
      }
      if (isRequestForm && state == 'error') {
        await tester.ensureVisible(find.byKey(const Key('request-submit')));
        await tester.tap(find.byKey(const Key('request-submit')));
        await tester.pump();
      }
      final pageContext = tester.element(find.byType(page.runtimeType));
      final l10n = AppLocalizations.of(pageContext);
      Future<void> selectSegment(String label) async {
        final target = find.widgetWithText(TextButton, label);
        await tester.ensureVisible(target);
        await tester.tap(target);
        await tester.pumpAndSettle();
        final semantics = tester.ensureSemantics();
        try {
          await tester.pump();
          final selected = find.ancestor(
            of: target,
            matching: find.byWidgetPredicate(
              (widget) =>
                  widget is Semantics && widget.properties.selected == true,
            ),
          );
          expect(
            tester.getSemantics(selected.first).flagsCollection.isSelected,
            Tristate.isTrue,
          );
        } finally {
          semantics.dispose();
        }
      }

      if (shot.screen == 'visitor' && state == 'error') {
        expect(find.text(l10n.visitorLoadFailed), findsOneWidget);
        expect(find.text(l10n.visitorStale), findsNothing);
      }
      if (shot.screen == 'visitor' && shot.variant == 'cached_error') {
        expect(find.text(l10n.visitorStale), findsOneWidget);
        // The restored floating bar reserves more height; locate the same
        // cached row within the shorter viewport before taking its capture.
        await tester.scrollUntilVisible(
          find.text('İpek Şahin'),
          100,
          scrollable: find
              .descendant(
                of: find.byType(VisitorScreen),
                matching: find.byType(Scrollable),
              )
              .first,
        );
        await tester.pump();
        expect(find.text('İpek Şahin'), findsOneWidget);
      }
      if (shot.variant == 'corrections') {
        await selectSegment(l10n.requestsCorrection);
      }
      if (shot.variant == 'overview') {
        await selectSegment(l10n.historyTabStats);
      }
      if (shot.variant == 'calendar') {
        await selectSegment(l10n.historyTabThisMonth);
        final day = find.byKey(const Key('history-day-2026-11-04'));
        final rect = tester.getRect(day);
        if (shot.width == 360) {
          expect(rect.width, greaterThanOrEqualTo(44));
          expect(rect.height, greaterThanOrEqualTo(48));
          expect(rect.width, lessThan(60));
        } else if (shot.width == 320) {
          expect(rect.width, greaterThan(200));
        }
      }
      if (shot.variant == 'camera_placeholder') {
        await selectSegment(l10n.qrTabScan);
      }
      if (shot.screen == 'door_recovery') {
        unawaited(
          showDialog<void>(
            context: tester.element(find.byType(HomeScreen)),
            builder: (_) =>
                DoorOperationRecoveryDialog(commands: commands, auth: auth),
          ),
        );
      }
      if (shot.screen == 'history_filter') {
        await tester.tap(
          find.byTooltip(
            AppLocalizations.of(
              tester.element(find.byType(HistoryScreen)),
            ).historyFilterTitle,
          ),
        );
      }
      if (shot.screen == 'visitor_detail') {
        await tester.tap(
          find
              .descendant(
                of: find.byType(AppListRow),
                matching: find.text('İpek Şahin'),
              )
              .first,
        );
        await tester.pumpAndSettle();
        expect(find.byType(AppSheet), findsOneWidget);
        if (shot.variant == 'cancel') {
          await tester.ensureVisible(find.text(l10n.visitorCancelInvitation));
          await tester.tap(find.text(l10n.visitorCancelInvitation));
          await tester.pumpAndSettle();
          expect(find.byType(AppDialog), findsOneWidget);
        }
      }
      if (shot.screen == 'visitor_form' &&
          shot.variant.startsWith('validation_')) {
        if (shot.variant == 'validation_notice') {
          for (final (label, text) in [
            (l10n.visitorFirstName, 'İpek'),
            (l10n.visitorLastName, 'Şahin'),
            (l10n.visitorFieldPurpose, 'Toplantı'),
          ]) {
            final field = find.widgetWithText(TextFormField, '$label *');
            await tester.ensureVisible(field);
            await tester.enterText(field, text);
          }
          tester.testTextInput.hide();
        }
        final submit = find.widgetWithText(FilledButton, l10n.visitorSave);
        await tester.ensureVisible(submit);
        await tester.tap(submit);
        await tester.pumpAndSettle();
        expect(
          find.text(
            shot.variant == 'validation_notice'
                ? l10n.visitorErrorNoticeRequired
                : l10n.fieldRequired,
          ),
          findsWidgets,
        );
      }
      if (shot.screen == 'visitor_form' && shot.variant == 'keyboard') {
        final field = find.widgetWithText(
          TextFormField,
          '${l10n.visitorFieldPurpose} *',
        );
        await tester.ensureVisible(field);
        await tester.tap(field);
        tester.view.viewInsets = const FakeViewPadding(bottom: 560);
        addTearDown(tester.view.resetViewInsets);
        await tester.pump();
        final footer = find.byType(AppFormActionBar);
        expect(tester.getBottomRight(footer).dy, lessThanOrEqualTo(844 - 280));
      }
      if (shot.screen == 'requests' && shot.variant == 'withdraw') {
        await tester.tap(find.text(l10n.requestsWithdraw).first);
        await tester.pumpAndSettle();
        expect(find.byType(AppDialog), findsOneWidget);
      }
      if (shot.screen == 'history' && shot.variant == 'detail') {
        await tester.tap(find.byType(AppListRow).first);
        await tester.pumpAndSettle();
        expect(find.byType(AppSheet), findsOneWidget);
      }
      if (shot.screen == 'profile' &&
          !['', 'long', 'matrix'].contains(shot.variant)) {
        final label = switch (shot.variant) {
          'theme' => l10n.profileTheme,
          'language' => l10n.profileLanguage,
          'password' => l10n.profileChangePassword,
          'details' => l10n.profileEditButton,
          'notifications' => l10n.profileNotifications,
          'help' => l10n.profileHelp,
          'diagnostics' => l10n.profileDiagnosticsTitle,
          'about' => l10n.profileAboutApp,
          'privacy' => l10n.profilePrivacy,
          'logout' => l10n.profileLogout,
          _ => throw StateError(shot.variant),
        };
        final row = find
            .descendant(of: find.byType(AppListRow), matching: find.text(label))
            .first;
        await tester.ensureVisible(row);
        await tester.tap(row);
        await tester.pumpAndSettle();
      }
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      await resolveAuditFontFallbacks(tester);
      if (shot.variant == 'long') {
        // Expand by the main viewport's remaining scroll extent, preserving its width.
        final scrollables = tester.stateList<ScrollableState>(
          find.descendant(
            of: find.byType(page.runtimeType),
            matching: find.byType(Scrollable),
          ),
        );
        double extra = 0;
        for (final scroll in scrollables) {
          if (scroll.position.axis == Axis.vertical &&
              scroll.position.maxScrollExtent > extra) {
            extra = scroll.position.maxScrollExtent;
          }
        }
        final height = (844 + extra).clamp(844, 2400).toDouble();
        tester.view.physicalSize = Size(shot.width * 2, height * 2);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(tester.takeException(), isNull);
      Rect? clockProgressBounds;
      if (shot.screen == 'qr') {
        final progress = find.descendant(
          of: find.byType(QRScanScreen),
          matching: find.byWidgetPredicate(
            (widget) =>
                widget is LinearProgressIndicator && widget.value != null,
          ),
        );
        if (progress.evaluate().isNotEmpty) {
          expect(progress, findsOneWidget);
          expect(
            tester.widget<LinearProgressIndicator>(progress).value,
            inInclusiveRange(0, 1),
          );
          clockProgressBounds = tester.getRect(progress);
        }
      }
      await saveCapture(
        tester,
        shot.filename,
        clockProgressBounds: clockProgressBounds,
      );
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });
  }
}
