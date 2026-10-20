import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../core/errors.dart';
import '../repositories/auth_repository.dart';
import '../services/session_store.dart';

export '../repositories/auth_repository.dart' show AuthUser;

enum AuthPhase {
  initializing,
  unauthenticated,
  authenticated,
  retryableFailure,
}

class AuthProvider extends ChangeNotifier {
  AuthProvider({
    required AuthRepository repository,
    SessionStore? sessionStore,
    DateTime Function()? now,
    Duration remoteLogoutTimeout = const Duration(seconds: 5),
    Duration passwordChangeTimeout = const Duration(seconds: 20),
  }) : _repo = repository,
       _store = sessionStore ?? SecureSessionStore(),
       _now = now ?? DateTime.now,
       _remoteLogoutTimeout = remoteLogoutTimeout,
       _passwordChangeTimeout = passwordChangeTimeout;

  final AuthRepository _repo;
  final SessionStore _store;
  final DateTime Function() _now;
  final Duration _remoteLogoutTimeout;
  final Duration _passwordChangeTimeout;
  static const _storageError = BusinessError(
    message: 'Oturum güvenli olarak saklanamadı. Lütfen tekrar deneyin.',
    code: 'SESSION_STORAGE_FAILED',
  );

  AuthPhase _phase = AuthPhase.initializing;
  AuthUser? _currentUser;
  String? _sessionToken;
  AppError? _lastError;
  AppError? _bootstrapError;
  String? _errorMessage;
  bool _isLoading = false;
  bool _isChangingPassword = false;
  bool _isInitialized = false;
  bool _disposed = false;
  int _sessionEpoch = 0;
  Future<void>? _bootstrapFuture;
  // Serialize persistent/client writes. A late secure write must finish before
  // logout clears it; a new login must wait for the old logout's local cleanup.
  Future<void> _effects = Future<void>.value();

  AuthPhase get phase => _phase;
  int get sessionEpoch => _sessionEpoch;
  bool get isInitialized => _isInitialized;
  bool get isBootstrapping => _phase == AuthPhase.initializing;
  AppError? get bootstrapError => _bootstrapError;
  AuthUser? get currentUser => _currentUser;
  String? get sessionToken => _sessionToken;
  bool get isLoading => _isLoading;
  bool get isChangingPassword => _isChangingPassword;
  String? get errorMessage => _errorMessage;
  AppError? get lastError => _lastError;
  bool get isAuthenticated =>
      _phase == AuthPhase.authenticated &&
      _currentUser != null &&
      _sessionToken != null;

  bool _owns(int epoch) => !_disposed && epoch == _sessionEpoch;
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  Future<T> _serialize<T>(Future<T> Function() action) {
    final result = _effects.then((_) => action());
    _effects = result.then<void>(
      (_) {},
      onError: (Object error, StackTrace stack) {},
    );
    return result;
  }

  void _setError(AppError error) {
    _lastError = error;
    _errorMessage = error.userMessage;
  }

  Future<void> bootstrap({bool force = false}) {
    if (_disposed) return Future<void>.value();
    final running = _bootstrapFuture;
    if (running != null && !force) return running;
    if (_isInitialized && !force && _phase != AuthPhase.retryableFailure) {
      return Future<void>.value();
    }
    final epoch = ++_sessionEpoch;
    _phase = AuthPhase.initializing;
    _isChangingPassword = false;
    _isLoading = true;
    _bootstrapError = null;
    _currentUser = null;
    clearError(notify: false);
    final future = _bootstrap(epoch);
    _bootstrapFuture = future;
    _notify();
    return future;
  }

  Future<void> _bootstrap(int epoch) async {
    try {
      StoredSession? stored;
      try {
        stored = await _serialize(() async {
          if (!_owns(epoch)) return null;
          return _store.readSession();
        });
      } catch (_) {
        throw _storageError;
      }
      if (!_owns(epoch)) return;
      if (stored == null || _isExpired(stored.expiresAt)) {
        await _clearPersisted();
        if (!_owns(epoch)) return;
        _sessionToken = null;
        _phase = AuthPhase.unauthenticated;
        return;
      }
      final session = stored;
      await _serialize(() async {
        if (!_owns(epoch)) return;
        await _repo.setAuth(session.token);
      });
      if (!_owns(epoch)) return;
      _sessionToken = session.token;
      final user = await _repo.me();
      if (!_owns(epoch)) return;
      _currentUser = user;
      _phase = AuthPhase.authenticated;
    } catch (error, stack) {
      if (!_owns(epoch)) return;
      final mapped = AppError.fromException(error, stack);
      _currentUser = null;
      if (mapped is AuthExpiredError) {
        _sessionToken = null;
        _phase = AuthPhase.unauthenticated;
        try {
          await _clearPersisted();
        } catch (_) {
          if (!_owns(epoch)) return;
          _setError(_storageError);
          return;
        }
        if (!_owns(epoch)) return;
        _setError(mapped);
      } else {
        // Keep the secure session; protected routes remain closed until retry.
        try {
          await _serialize(() async {
            if (_owns(epoch)) await _repo.clearAuth();
          });
        } catch (_) {
          // A client cleanup error must still leave startup retryable.
        }
        if (!_owns(epoch)) return;
        _phase = AuthPhase.retryableFailure;
        _bootstrapError = mapped;
        _setError(mapped);
      }
    } finally {
      if (_owns(epoch)) {
        _isLoading = false;
        _isInitialized = true;
        _bootstrapFuture = null;
        _notify();
      }
    }
  }

  Future<bool> signIn(
    String email,
    String password, {
    bool rememberEmail = false,
  }) async {
    if (_disposed || _isLoading || _isChangingPassword) return false;
    final epoch = ++_sessionEpoch;
    _bootstrapFuture = null;
    _isLoading = true;
    _phase = AuthPhase.unauthenticated;
    _currentUser = null;
    _sessionToken = null;
    _bootstrapError = null;
    clearError(notify: false);
    _notify();
    SignInResult? issued;
    try {
      // Remove legacy credentials even if the network login fails.
      await _serialize(() async {
        if (!_owns(epoch)) return;
        await _repo.clearAuth();
        if (!_owns(epoch)) return;
        try {
          await _store.clearSession();
        } catch (_) {
          throw _storageError;
        }
      });
      if (!_owns(epoch)) return false;
      final result = await _repo.signIn(
        email: email.trim(),
        password: password,
      );
      issued = result;
      if (!_owns(epoch)) {
        unawaited(_revoke(result.token));
        return false;
      }
      if (_isExpired(result.expiresAt)) throw const AuthExpiredError();
      await _serialize(() async {
        if (!_owns(epoch)) return;
        try {
          await _store.writeSession(
            StoredSession(token: result.token, expiresAt: result.expiresAt),
          );
          if (!_owns(epoch)) return;
          await _store.writeRememberedEmail(
            rememberEmail ? email.trim() : null,
          );
        } catch (_) {
          throw _storageError;
        }
        if (_owns(epoch)) await _repo.setAuth(result.token);
      });
      if (!_owns(epoch)) {
        unawaited(_revoke(result.token));
        return false;
      }
      _sessionToken = result.token;
      _currentUser = result.user;
      _phase = AuthPhase.authenticated;
      return true;
    } catch (error, stack) {
      final token = issued?.token;
      if (token != null) unawaited(_revoke(token));
      if (!_owns(epoch)) return false;
      _setError(AppError.fromException(error, stack));
      _currentUser = null;
      _sessionToken = null;
      _phase = AuthPhase.unauthenticated;
      try {
        await _clearPersisted();
      } catch (_) {
        if (_owns(epoch)) _setError(_storageError);
      }
      return false;
    } finally {
      if (_owns(epoch)) {
        _isLoading = false;
        _isInitialized = true;
        _notify();
      }
    }
  }

  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    if (_disposed || !isAuthenticated || _isChangingPassword) return false;
    final epoch = _sessionEpoch;
    _isChangingPassword = true;
    clearError(notify: false);
    _notify();
    try {
      if (!_owns(epoch)) return false;
      if (newPassword.runes.length < 12 ||
          utf8.encode(newPassword).length > 72 ||
          currentPassword == newPassword) {
        throw const BusinessError(message: '', code: 'PASSWORD_POLICY');
      }
      await _repo
          .changePassword(
            currentPassword: currentPassword,
            newPassword: newPassword,
          )
          .timeout(_passwordChangeTimeout);
      if (!_owns(epoch)) return false;
      // The backend revokes every old session. Require a fresh explicit login.
      await signOut();
      return true;
    } catch (error, stack) {
      if (!_owns(epoch)) return false;
      final mapped = AppError.fromException(error, stack);
      if (mapped is AuthExpiredError) {
        await handleAuthExpiry(sessionEpoch: epoch);
      } else {
        _setError(mapped);
      }
      return false;
    } finally {
      if (_owns(epoch)) {
        _isChangingPassword = false;
        _notify();
      }
    }
  }

  Future<String?> rememberedEmail() => _serialize(() async {
    if (_disposed) return null;
    return _store.readRememberedEmail();
  });

  /// Kept for old callers. Recovery is the administrator setup-link flow.
  Future<bool> resetPassword(String email) async {
    if (_disposed) return false;
    _lastError = null;
    _errorMessage =
        'Mobil şifre kurulumunu yöneticiniz yapar. Lütfen yöneticinizle iletişime geçin.';
    _notify();
    return false;
  }

  Future<void> signOut() {
    if (_disposed) return Future<void>.value();
    final token = _sessionToken;
    final epoch = ++_sessionEpoch;
    _sessionToken = null;
    _currentUser = null;
    _phase = AuthPhase.unauthenticated;
    _isLoading = false;
    _isChangingPassword = false;
    _isInitialized = true;
    _bootstrapFuture = null;
    _bootstrapError = null;
    clearError(notify: false);
    _notify(); // Close protected UI immediately, before any I/O.
    if (token != null) unawaited(_revoke(token));
    return _finishLocalLogout(epoch);
  }

  Future<void> _finishLocalLogout(int epoch) async {
    try {
      await _clearPersisted();
    } catch (_) {
      if (_owns(epoch)) {
        _setError(_storageError);
        _notify();
      }
    }
  }

  /// The transport passes captured identity (or suppresses stale callbacks).
  Future<void> handleAuthExpiry({
    String? sessionToken,
    int? sessionEpoch,
  }) async {
    if (_disposed ||
        (sessionToken != null && sessionToken != _sessionToken) ||
        (sessionEpoch != null && sessionEpoch != _sessionEpoch) ||
        (_currentUser == null && _sessionToken == null)) {
      return;
    }
    final epoch = ++_sessionEpoch;
    _currentUser = null;
    _sessionToken = null;
    _phase = AuthPhase.unauthenticated;
    _isLoading = false;
    _isChangingPassword = false;
    _isInitialized = true;
    _bootstrapFuture = null;
    _bootstrapError = null;
    _setError(const AuthExpiredError());
    _notify();
    await _finishLocalLogout(epoch);
  }

  Future<void> _clearPersisted() => _serialize(() async {
    // Cleanup was queued by the owning epoch. It must finish even if a
    // notifier is disposed, before later serialized login effects can run.
    // Always detach the client even when persistent deletion fails.
    try {
      await _repo.clearAuth();
    } finally {
      await _store.clearSession();
    }
  });

  Future<void> _revoke(String token) async {
    try {
      await _repo.signOut(token).timeout(_remoteLogoutTimeout);
    } catch (_) {
      // Local logout remains final; remote revocation is not guaranteed offline.
    }
  }

  bool _isExpired(String? iso) {
    if (iso == null) return false;
    final parsed = DateTime.tryParse(iso);
    return parsed == null || !_now().toUtc().isBefore(parsed.toUtc());
  }

  void clearError({bool notify = true}) {
    if (_disposed) return;
    _errorMessage = null;
    _lastError = null;
    if (notify) _notify();
  }

  @override
  void dispose() {
    _disposed = true;
    _sessionEpoch++;
    super.dispose();
  }
}
