import 'dart:async';
import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'config/convex_config.dart';
import 'core/safe_diagnostics.dart';
import 'l10n/app_localizations.dart';
import 'providers/attendance_provider.dart';
import 'providers/auth_provider.dart';
import 'providers/door_operation_provider.dart';
import 'providers/locale_provider.dart';
import 'providers/preferred_device_provider.dart';
import 'providers/theme_provider.dart';
import 'providers/visitor_provider.dart';
import 'repositories/attendance_repository.dart';
import 'repositories/auth_repository.dart';
import 'repositories/device_repository.dart';
import 'repositories/door_operation_repository.dart';
import 'repositories/qr_repository.dart';
import 'repositories/visitor_repository.dart';
import 'router/app_router.dart';
import 'screens/splash_screen.dart';
import 'services/session_store.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

/// A replacement root may mount before the previous root is disposed. Keep one
/// shared handler until the last root leaves, never restore a disposed root's
/// callback, and respect a handler installed later by another owner.
class _RootDiagnosticsHooks {
  static int _owners = 0;
  static void Function(FlutterErrorDetails)? _previousFramework;
  static bool Function(Object, StackTrace)? _previousPlatform;
  static void _framework(FlutterErrorDetails details) =>
      SafeDiagnostics.instance.record(
        details.exception,
        stack: details.stack,
        operation: DiagnosticOperation.framework,
      );
  static bool _platform(Object error, StackTrace stack) {
    SafeDiagnostics.instance.record(
      error,
      stack: stack,
      operation: DiagnosticOperation.platform,
    );
    return true;
  }

  static void attach() {
    if (_owners++ != 0) {
      return;
    }
    _previousFramework = FlutterError.onError;
    _previousPlatform = PlatformDispatcher.instance.onError;
    FlutterError.onError = _framework;
    PlatformDispatcher.instance.onError = _platform;
  }

  static void detach() {
    if (--_owners != 0) {
      return;
    }
    if (identical(FlutterError.onError, _framework)) {
      FlutterError.onError = _previousFramework;
    }
    if (identical(PlatformDispatcher.instance.onError, _platform)) {
      PlatformDispatcher.instance.onError = _previousPlatform;
    }
    _previousFramework = null;
    _previousPlatform = null;
  }
}

/// The root owns everything it creates, including a client returned by
/// [clientFactory]. Injected [client] and [authProvider] remain caller-owned;
/// the root detaches its own listeners/callbacks but never disposes them.
/// Dependencies are fixed for the lifetime of this widget (replace its key to
/// change them). [sessionStore] is used only for a root-created AuthProvider.
class MyApp extends StatefulWidget {
  const MyApp({
    super.key,
    this.client,
    this.authProvider,
    this.sessionStore,
    this.initialLocation,
    this.clientFactory,
  }) : assert(client == null || clientFactory == null),
       assert(authProvider == null || sessionStore == null);

  final HttpConvexClient? client;
  final AuthProvider? authProvider;
  final SessionStore? sessionStore;
  final String? initialLocation;
  final Future<HttpConvexClient> Function()? clientFactory;

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  late final ThemeProvider _themeProvider;
  late final LocaleProvider _localeProvider;
  late final PreferredDeviceProvider _preferredDeviceProvider;
  late final HttpConvexClient _client;
  late final AuthRepository _authRepo;
  late final AttendanceRepository _attendanceRepo;
  late final DeviceRepository _deviceRepo;
  late final QrRepository _qrRepo;
  late final VisitorRepository _visitorRepo;
  late final DoorOperationRepository _doorRepo;
  late final AuthProvider _authProvider;
  late final AttendanceProvider _attendanceProvider;
  late final VisitorProvider _visitorProvider;
  late final DoorOperationProvider _doorProvider;
  late final GoRouter _router;
  late final AuthExpiryCallback _authExpired;
  bool _composed = false;
  bool _configurationFailed = false;
  bool _starting = false;
  int _startupGeneration = 0;
  ({String? employee, String? project, int epoch})? _identity;

  @override
  void initState() {
    super.initState();
    _RootDiagnosticsHooks.attach();
    _themeProvider = ThemeProvider()..bootstrap();
    _localeProvider = LocaleProvider()..bootstrap();
    _preferredDeviceProvider = PreferredDeviceProvider()..bootstrap();
    final injected = widget.client;
    if (injected != null) {
      _compose(injected);
    } else {
      unawaited(_start());
    }
  }

  static Future<HttpConvexClient> _configuredClient() async {
    await ConvexConfig.initialize();
    return ConvexConfig.client;
  }

  Future<void> _start() async {
    if (_starting || _composed) {
      return;
    }
    _starting = true;
    final generation = ++_startupGeneration;
    if (_configurationFailed) {
      setState(() => _configurationFailed = false);
    }
    try {
      final client = await (widget.clientFactory ?? _configuredClient)();
      if (!mounted || generation != _startupGeneration) {
        client.close();
        return;
      }
      _compose(client);
      setState(() {});
    } catch (error, stack) {
      SafeDiagnostics.instance.record(
        error,
        stack: stack,
        operation: DiagnosticOperation.bootstrap,
      );
      if (mounted && generation == _startupGeneration) {
        setState(() => _configurationFailed = true);
      }
    } finally {
      if (generation == _startupGeneration) {
        _starting = false;
      }
    }
  }

  void _compose(HttpConvexClient client) {
    _client = client;
    _authRepo = AuthRepository(client);
    _attendanceRepo = AttendanceRepository(client);
    _deviceRepo = DeviceRepository(client);
    _qrRepo = QrRepository(client);
    _visitorRepo = VisitorRepository(client);
    _doorRepo = DoorOperationRepository(client);
    _authProvider =
        widget.authProvider ??
        AuthProvider(repository: _authRepo, sessionStore: widget.sessionStore);
    _attendanceProvider = AttendanceProvider(repository: _attendanceRepo);
    _visitorProvider = VisitorProvider(repository: _visitorRepo);
    _doorProvider = DoorOperationProvider(repository: _doorRepo);
    _authExpired = () {
      if (!mounted || !_composed) {
        return;
      }
      unawaited(
        _authProvider.handleAuthExpiry(
          sessionToken: client.sessionToken,
          sessionEpoch: _authProvider.sessionEpoch,
        ),
      );
    };
    client.setOnAuthExpired(_authExpired);
    _router = buildRouter(
      _authProvider,
      initialLocation: widget.initialLocation,
    );
    _composed = true;
    // Attach outside a provider build/update; their notifications cannot cause
    // recursive build-time auth/attendance synchronization.
    _attendanceProvider.setAuthProvider(_authProvider);
    _authProvider.addListener(_synchronizeSession);
    _synchronizeSession();
    unawaited(_authProvider.bootstrap());
  }

  void _synchronizeSession() {
    if (!_composed || !mounted) {
      return;
    }
    final user = _authProvider.isAuthenticated
        ? _authProvider.currentUser
        : null;
    final identity = (
      employee: user?.id,
      project: user?.projectId,
      epoch: _authProvider.sessionEpoch,
    );
    if (identity != _identity) {
      _identity = identity;
      // Reset even if a new epoch belongs to the same employee/project.
      unawaited(_preferredDeviceProvider.setIdentity(null));
      unawaited(
        _preferredDeviceProvider.setIdentity(
          user?.id,
          projectId: user?.projectId,
          deployment: _client.deploymentUrl,
        ),
      );
    }
    _visitorProvider.synchronizeSession(_authProvider);
    if (user == null) {
      _visitorProvider.setVisible(false);
    }
    unawaited(
      _doorProvider.synchronizeSession(
        _authProvider,
        deployment: _client.deploymentUrl,
      ),
    );
  }

  @override
  void dispose() {
    _startupGeneration++;
    if (_composed) {
      _authProvider.removeListener(_synchronizeSession);
      _client.clearOnAuthExpired(_authExpired);
      _router.dispose();
      _attendanceProvider.dispose();
      _visitorProvider.dispose();
      _doorProvider.dispose();
      if (widget.authProvider == null) {
        _authProvider.dispose();
      }
      if (widget.client == null) {
        _client.close();
      }
      _composed = false;
    }
    _preferredDeviceProvider.dispose();
    _themeProvider.dispose();
    _localeProvider.dispose();
    _RootDiagnosticsHooks.detach();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MultiProvider(
    providers: [
      ChangeNotifierProvider<ThemeProvider>.value(value: _themeProvider),
      ChangeNotifierProvider<LocaleProvider>.value(value: _localeProvider),
      ChangeNotifierProvider<PreferredDeviceProvider>.value(
        value: _preferredDeviceProvider,
      ),
      if (_composed) ...[
        Provider<AuthRepository>.value(value: _authRepo),
        Provider<AttendanceRepository>.value(value: _attendanceRepo),
        Provider<DeviceRepository>.value(value: _deviceRepo),
        Provider<QrRepository>.value(value: _qrRepo),
        Provider<VisitorRepository>.value(value: _visitorRepo),
        Provider<DoorOperationRepository>.value(value: _doorRepo),
        ChangeNotifierProvider<AuthProvider>.value(value: _authProvider),
        ChangeNotifierProvider<AttendanceProvider>.value(
          value: _attendanceProvider,
        ),
        ChangeNotifierProvider<VisitorProvider>.value(value: _visitorProvider),
        ChangeNotifierProvider<DoorOperationProvider>.value(
          value: _doorProvider,
        ),
      ],
    ],
    child: Consumer2<ThemeProvider, LocaleProvider>(
      builder: (context, theme, locale, _) {
        if (!_composed) {
          return MaterialApp(
            title: 'NGS Plus',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: theme.themeMode,
            locale: locale.locale,
            supportedLocales: AppLocalizations.supportedLocales,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            home: Builder(
              builder: (context) => SplashScreen(
                isFailure: _configurationFailed,
                message: AppLocalizations.of(
                  context,
                ).startupConfigurationUnavailable,
                onRetry: () => unawaited(_start()),
              ),
            ),
          );
        }
        return MaterialApp.router(
          title: 'NGS Plus',
          debugShowCheckedModeBanner: false,
          routerConfig: _router,
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: theme.themeMode,
          locale: locale.locale,
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
        );
      },
    ),
  );
}
