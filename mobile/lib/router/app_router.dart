import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';
import '../screens/auth/forgot_password_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/history/history_screen.dart';
import '../screens/home/home_screen.dart';
import '../screens/main_navigation_shell.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/qr_scan/qr_scan_screen.dart';
import '../screens/settings/select_device_screen.dart';
import '../screens/splash_screen.dart';
import '../screens/visitor/visitor_screen.dart';

/// Tüm ekranlara erişebilen root navigator key. Auth expiry, deep link gibi
/// global akışlarda router context'i için tutuluyor.
final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>(
  debugLabel: 'root',
);

/// Tab içi navigasyonların kullandığı shell navigator key.
final GlobalKey<NavigatorState> shellNavigatorKey = GlobalKey<NavigatorState>(
  debugLabel: 'shell',
);

/// Path sabitleri — type-safe çağrı için.
class AppRoute {
  AppRoute._();

  static const splash = '/splash';
  static const login = '/login';
  static const forgotPassword = '/forgot-password';
  static const home = '/home';
  static const history = '/history';
  static const qr = '/qr';
  static const visitor = '/visitor';
  static const profile = '/profile';
  static const selectDevice = '/select-device';
}

/// AuthProvider'ı dinleyip redirect'i tetikleyen [GoRouter] üretir.
GoRouter buildRouter(AuthProvider authProvider) {
  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: AppRoute.splash,
    debugLogDiagnostics: false,
    refreshListenable: authProvider,
    redirect: (context, state) {
      final loc = state.matchedLocation;

      // Splash kendi navigation'ını yapar (bootstrap + remember-me akışı).
      if (loc == AppRoute.splash) return null;

      final isAuth = authProvider.isAuthenticated;
      final isAuthFlow =
          loc == AppRoute.login || loc == AppRoute.forgotPassword;

      if (!isAuth && !isAuthFlow) return AppRoute.login;
      if (isAuth && isAuthFlow) return AppRoute.home;
      return null;
    },
    routes: [
      GoRoute(
        path: AppRoute.splash,
        builder: (_, _) => const SplashScreen(),
      ),
      GoRoute(
        path: AppRoute.login,
        builder: (_, _) => const LoginScreen(),
      ),
      GoRoute(
        path: AppRoute.forgotPassword,
        builder: (_, _) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: AppRoute.selectDevice,
        builder: (_, _) => const SelectDeviceScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, _, navigationShell) =>
            MainNavigationShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.home,
                builder: (_, _) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.history,
                builder: (_, _) => const HistoryScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.qr,
                builder: (_, _) => const QRScanScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.visitor,
                builder: (_, _) => const VisitorScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.profile,
                builder: (_, _) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}
