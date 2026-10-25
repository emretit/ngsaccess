/// Route names shared by screens without importing the composition/router tree.
class AppRoute {
  AppRoute._();

  static const splash = '/splash';
  static const login = '/login';
  static const forgotPassword = '/forgot-password';
  static const home = '/home';
  static const requests = '/requests';
  static const history = '/history';
  static const qr = '/qr';
  static const visitor = '/visitor';
  static const profile = '/profile';
  static const selectDevice = '/select-device';
  static const protectedPaths = {
    home,
    requests,
    history,
    qr,
    visitor,
    profile,
    selectDevice,
  };
}

/// A return target is a single allowlisted local screen. No queries, fragments,
/// schemes or authorities cross this boundary.
String? safeReturnTarget(String? value) =>
    AppRoute.protectedPaths.contains(value) ? value : null;

String withReturnTarget(String path, String? target) {
  final safe = safeReturnTarget(target);
  return Uri(
    path: path,
    queryParameters: safe == null ? null : {'from': safe},
  ).toString();
}

/// Supports both ngsplus://history and ngsplus:///history. Nothing outside the
/// local route allowlist can become a navigation or post-login destination.
String normalizeAppLocation(Uri uri) {
  String path;
  if (uri.scheme == 'ngsplus' && uri.userInfo.isEmpty && !uri.hasPort) {
    if (uri.host.isNotEmpty) {
      if (uri.path.isNotEmpty && uri.path != '/') {
        return AppRoute.home;
      }
      path = '/${uri.host}';
    } else {
      path = uri.path;
    }
  } else if (uri.scheme.isEmpty && !uri.hasAuthority) {
    path = uri.path;
  } else {
    return AppRoute.home;
  }
  if (AppRoute.protectedPaths.contains(path)) {
    return path;
  }
  if (const {
    AppRoute.splash,
    AppRoute.login,
    AppRoute.forgotPassword,
  }.contains(path)) {
    return withReturnTarget(path, uri.queryParameters['from']);
  }
  return AppRoute.home;
}
