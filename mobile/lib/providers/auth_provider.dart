import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/convex_config.dart';
import '../core/errors.dart';
import '../repositories/auth_repository.dart';

// Mevcut tüketicilerin `import 'auth_provider.dart'` üzerinden AuthUser'a
// erişebilmesi için repository'deki tipi yeniden ihraç ediyoruz.
export '../repositories/auth_repository.dart' show AuthUser;

class AuthProvider extends ChangeNotifier {
  AuthProvider({required AuthRepository repository}) : _repo = repository;

  static const _kSessionTokenKey = 'mobile_employee_token';
  static const _kSessionExpiresKey = 'mobile_employee_expires';
  // Eski Convex Auth (web) anahtarları — bootstrap'ta temizlenir.
  static const _kLegacyAccessTokenKey = 'convex_access_token';
  static const _kLegacyRefreshTokenKey = 'convex_refresh_token';

  final AuthRepository _repo;

  AuthUser? _currentUser;
  bool _isLoading = false;
  String? _errorMessage;
  AppError? _lastError;
  String? _sessionToken;

  AuthUser? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  /// HTTP/repository katmanından gelen son [AppError]. UI tarafı `errorMessage`
  /// yerine bunu okuyup `localizeAppError(context, lastError)` ile yerelleştirir.
  AppError? get lastError => _lastError;

  bool get isAuthenticated => _currentUser != null && _sessionToken != null;
  String? get sessionToken => _sessionToken;

  Future<void> bootstrap() async {
    final prefs = await SharedPreferences.getInstance();

    // Eski Convex Auth tokenlarını temizle (web auth'undan kalan).
    await prefs.remove(_kLegacyAccessTokenKey);
    await prefs.remove(_kLegacyRefreshTokenKey);

    final token = prefs.getString(_kSessionTokenKey);
    if (token == null || token.isEmpty) return;

    // Token süresi dolmuş mu? Local kontrol; backend ayrıca doğrular.
    final expiresAtStr = prefs.getString(_kSessionExpiresKey);
    if (_isExpired(expiresAtStr)) {
      await _clearLocalAuth();
      return;
    }

    _sessionToken = token;
    await convex.setAuth(token: token);

    try {
      _currentUser = await _repo.me();
    } on AuthExpiredError {
      await _clearLocalAuth();
    } on AppError catch (e) {
      // Network gibi geçici hata: token'ı atma; bir sonraki çağrıda denenir.
      if (kDebugMode) debugPrint('Auth bootstrap me() failed: ${e.debugMessage}');
    }
    notifyListeners();
  }

  Future<bool> signIn(String email, String password) async {
    try {
      _isLoading = true;
      _errorMessage = null;
      _lastError = null;
      notifyListeners();

      final result = await _repo.signIn(email: email, password: password);

      _sessionToken = result.token;
      await convex.setAuth(token: result.token);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kSessionTokenKey, result.token);
      if (result.expiresAt != null) {
        await prefs.setString(_kSessionExpiresKey, result.expiresAt!);
      }

      _currentUser = result.user;
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (error, stack) {
      final mapped = AppError.fromException(error, stack);
      _isLoading = false;
      _lastError = mapped;
      _errorMessage = mapped.userMessage;
      _sessionToken = null;
      _currentUser = null;
      await convex.clearAuth();
      notifyListeners();
      return false;
    }
  }

  Future<bool> resetPassword(String email) async {
    _errorMessage =
        'Mobil şifre kurulumunu yöneticiniz yapar. Lütfen yöneticinizle iletişime geçin.';
    notifyListeners();
    return false;
  }

  Future<void> signOut() async {
    final token = _sessionToken;
    if (token != null) {
      try {
        await _repo.signOut(token);
      } on AppError catch (e) {
        // Network/server hatası logout'u engellememeli.
        if (kDebugMode) debugPrint('signOut server call failed: ${e.debugMessage}');
      } catch (_) {}
    }
    await convex.clearAuth();
    await _clearLocalAuth();
    notifyListeners();
  }

  /// HTTP/repository katmanı `AuthExpiredError` döndürdüğünde tetiklenir —
  /// local state temizlenir ve dinleyiciler bilgilendirilir. UI tarafı
  /// `isAuthenticated` değişimine bakarak login'e yönlendirir (örn. main.dart
  /// global navigator listener).
  Future<void> handleAuthExpiry() async {
    if (_currentUser == null && _sessionToken == null) return;
    await convex.clearAuth();
    await _clearLocalAuth();
    const expired = AuthExpiredError();
    _lastError = expired;
    _errorMessage = expired.userMessage;
    notifyListeners();
  }

  Future<void> _clearLocalAuth() async {
    _sessionToken = null;
    _currentUser = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kSessionTokenKey);
    await prefs.remove(_kSessionExpiresKey);
  }

  bool _isExpired(String? iso) {
    if (iso == null || iso.isEmpty) return false;
    final parsed = DateTime.tryParse(iso);
    if (parsed == null) return false;
    return DateTime.now().toUtc().isAfter(parsed.toUtc());
  }

  void clearError() {
    _errorMessage = null;
    _lastError = null;
    notifyListeners();
  }
}
