import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/branch_visibility.dart';
import '../core/error_localizer.dart';
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
import '../screens/requests/requests_screen.dart';
import 'route_paths.dart';

export 'route_paths.dart';

// Retained exports for callers that used these keys. Each router owns fresh
// navigator keys so replacing a root cannot retain another root's navigation.
final rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');
final shellNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'shell');

/// [screenBuilders] replaces screen bodies in integration tests while keeping
/// the real guards, branch navigators, shell and return-target handling.
GoRouter buildRouter(
  AuthProvider authProvider, {
  String? initialLocation,
  Map<String, WidgetBuilder> screenBuilders = const {},
}) {
  Widget screen(String path, BuildContext context, WidgetBuilder fallback) =>
      (screenBuilders[path] ?? fallback)(context);

  return GoRouter(
    navigatorKey: GlobalKey<NavigatorState>(debugLabel: 'app-root'),
    initialLocation: initialLocation == null
        ? AppRoute.splash
        : normalizeAppLocation(Uri.parse(initialLocation)),
    overridePlatformDefaultLocation: initialLocation != null,
    debugLogDiagnostics: false,
    refreshListenable: authProvider,
    redirect: (context, state) {
      final canonical = normalizeAppLocation(state.uri);
      if (canonical != state.uri.toString()) {
        return canonical;
      }
      final path = state.uri.path;
      final target = safeReturnTarget(state.uri.queryParameters['from']);
      final isPublic =
          path == AppRoute.login || path == AppRoute.forgotPassword;
      final isSplash = path == AppRoute.splash;
      if (authProvider.phase == AuthPhase.initializing ||
          authProvider.phase == AuthPhase.retryableFailure) {
        return isSplash
            ? null
            : withReturnTarget(
                AppRoute.splash,
                AppRoute.protectedPaths.contains(path) ? path : target,
              );
      }
      if (authProvider.isAuthenticated) {
        return isSplash || isPublic ? target ?? AppRoute.home : null;
      }
      if (isSplash) {
        return withReturnTarget(AppRoute.login, target);
      }
      if (!isPublic) {
        return withReturnTarget(AppRoute.login, path);
      }
      return null;
    },
    routes: [
      GoRoute(
        path: AppRoute.splash,
        builder: (context, _) => screen(
          AppRoute.splash,
          context,
          (_) => ListenableBuilder(
            listenable: authProvider,
            builder: (context, _) => SplashScreen(
              isFailure: authProvider.phase == AuthPhase.retryableFailure,
              message: switch (authProvider.bootstrapError) {
                final error? => localizeAppError(context, error),
                null => null,
              },
              onRetry: () {
                if (!authProvider.isBootstrapping) {
                  unawaited(authProvider.bootstrap(force: true));
                }
              },
              // Explicitly abandon restore; the router retains the target.
              onUseLogin: () => unawaited(authProvider.signOut()),
            ),
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.login,
        builder: (context, _) =>
            screen(AppRoute.login, context, (_) => const LoginScreen()),
      ),
      GoRoute(
        path: AppRoute.forgotPassword,
        builder: (context, _) => screen(
          AppRoute.forgotPassword,
          context,
          (_) => const ForgotPasswordScreen(),
        ),
      ),
      GoRoute(
        path: AppRoute.selectDevice,
        builder: (context, _) => screen(
          AppRoute.selectDevice,
          context,
          (_) => const SelectDeviceScreen(),
        ),
      ),
      GoRoute(
        path: AppRoute.requests,
        builder: (context, _) =>
            screen(AppRoute.requests, context, (_) => const RequestsScreen()),
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, _, navigationShell) =>
            MainNavigationShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.home,
                builder: (context, _) =>
                    screen(AppRoute.home, context, (_) => const HomeScreen()),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.history,
                builder: (context, _) => screen(
                  AppRoute.history,
                  context,
                  (_) => const HistoryScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.qr,
                builder: (context, _) => Builder(
                  builder: (context) => screen(
                    AppRoute.qr,
                    context,
                    (_) => QRScanScreen(
                      isActive: BranchVisibility.isActive(context, 2),
                    ),
                  ),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.visitor,
                builder: (context, _) => screen(
                  AppRoute.visitor,
                  context,
                  (_) => const VisitorScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.profile,
                builder: (context, _) => screen(
                  AppRoute.profile,
                  context,
                  (_) => const ProfileScreen(),
                ),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}
