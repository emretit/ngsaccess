import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'config/convex_config.dart';
import 'l10n/app_localizations.dart';
import 'providers/attendance_provider.dart';
import 'providers/auth_provider.dart';
import 'providers/preferred_device_provider.dart';
import 'providers/theme_provider.dart';
import 'repositories/attendance_repository.dart';
import 'repositories/auth_repository.dart';
import 'repositories/device_repository.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await ConvexConfig.initialize();

  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  late final AuthRepository _authRepo;
  late final AttendanceRepository _attendanceRepo;
  late final DeviceRepository _deviceRepo;
  late final AuthProvider _authProvider;
  late final ThemeProvider _themeProvider;
  late final PreferredDeviceProvider _preferredDeviceProvider;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _authRepo = AuthRepository(ConvexConfig.client);
    _attendanceRepo = AttendanceRepository(ConvexConfig.client);
    _deviceRepo = DeviceRepository(ConvexConfig.client);
    _authProvider = AuthProvider(repository: _authRepo);
    _themeProvider = ThemeProvider()..bootstrap();
    _preferredDeviceProvider = PreferredDeviceProvider()..bootstrap();

    // HTTP katmanından auth expiry sinyali geldiğinde provider state'i temizle.
    // Provider notifyListeners → router.refreshListenable → redirect → /login.
    ConvexConfig.client.setOnAuthExpired(() {
      _authProvider.handleAuthExpiry();
    });

    _router = buildRouter(_authProvider);
  }

  @override
  void dispose() {
    _authProvider.dispose();
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<AuthRepository>.value(value: _authRepo),
        Provider<AttendanceRepository>.value(value: _attendanceRepo),
        Provider<DeviceRepository>.value(value: _deviceRepo),
        ChangeNotifierProvider<AuthProvider>.value(value: _authProvider),
        ChangeNotifierProvider<ThemeProvider>.value(value: _themeProvider),
        ChangeNotifierProvider<PreferredDeviceProvider>.value(
          value: _preferredDeviceProvider,
        ),
        ChangeNotifierProxyProvider<AuthProvider, AttendanceProvider>(
          create: (_) => AttendanceProvider(repository: _attendanceRepo),
          update: (_, authProvider, attendanceProvider) {
            attendanceProvider?.setAuthProvider(authProvider);
            return attendanceProvider!;
          },
        ),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, themeProvider, _) => MaterialApp.router(
          title: 'NGS Plus App',
          debugShowCheckedModeBanner: false,
          routerConfig: _router,
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: themeProvider.themeMode,
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
        ),
      ),
    );
  }
}
