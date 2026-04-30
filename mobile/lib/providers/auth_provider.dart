import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/convex_config.dart';

class AuthUser {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String? photoUrl;
  final String? departmentId;
  final String? departmentName;
  final String cardNumber;

  AuthUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.cardNumber,
    this.photoUrl,
    this.departmentId,
    this.departmentName,
  });

  factory AuthUser.fromSignInResponse(Map<String, dynamic> doc) {
    return AuthUser(
      id: doc['id'] as String,
      email: (doc['email'] as String?) ?? '',
      firstName: (doc['firstName'] as String?) ?? '',
      lastName: (doc['lastName'] as String?) ?? '',
      cardNumber: (doc['cardNumber'] as String?) ?? '',
      photoUrl: doc['photoUrl'] as String?,
      departmentId: doc['departmentId'] as String?,
      departmentName: doc['departmentName'] as String?,
    );
  }
}

class AuthProvider extends ChangeNotifier {
  static const _kSessionTokenKey = 'mobile_employee_token';
  static const _kSessionExpiresKey = 'mobile_employee_expires';
  // Eski Convex Auth (web) anahtarları — bootstrap'ta temizlenir.
  static const _kLegacyAccessTokenKey = 'convex_access_token';
  static const _kLegacyRefreshTokenKey = 'convex_refresh_token';

  AuthUser? _currentUser;
  bool _isLoading = false;
  String? _errorMessage;
  String? _sessionToken;

  AuthUser? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _currentUser != null && _sessionToken != null;
  String? get sessionToken => _sessionToken;

  Future<void> bootstrap() async {
    final prefs = await SharedPreferences.getInstance();

    // Eski Convex Auth tokenlarını temizle (web auth'undan kalan).
    await prefs.remove(_kLegacyAccessTokenKey);
    await prefs.remove(_kLegacyRefreshTokenKey);

    final token = prefs.getString(_kSessionTokenKey);
    if (token == null || token.isEmpty) return;

    _sessionToken = token;
    await convex.setAuth(token: token);

    try {
      await _loadCurrentUser();
    } catch (e) {
      await _clearLocalAuth();
    }
    notifyListeners();
  }

  Future<bool> signIn(String email, String password) async {
    try {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();

      final raw = await convex.mutation(
        name: 'employeeAuth:signIn',
        args: {'email': email.trim(), 'password': password},
      );

      final body = jsonDecode(raw) as Map<String, dynamic>;
      final token = body['token'] as String?;
      final expiresAt = body['expiresAt'] as String?;
      final employee = body['employee'] as Map<String, dynamic>?;

      if (token == null || employee == null) {
        throw Exception('Sunucu yanıtı eksik');
      }

      _sessionToken = token;
      await convex.setAuth(token: token);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kSessionTokenKey, token);
      if (expiresAt != null) {
        await prefs.setString(_kSessionExpiresKey, expiresAt);
      }

      _currentUser = AuthUser.fromSignInResponse(employee);

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (error) {
      _isLoading = false;
      _errorMessage = _humanizeError(error);
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
        await convex.mutation(
          name: 'employeeAuth:signOut',
          args: {'sessionToken': token},
        );
      } catch (_) {}
    }
    await convex.clearAuth();
    await _clearLocalAuth();
    notifyListeners();
  }

  Future<void> _loadCurrentUser() async {
    final raw = await convex.employeeQuery('employeeAuth:me', {});
    final decoded = jsonDecode(raw);
    if (decoded is Map<String, dynamic>) {
      _currentUser = AuthUser.fromSignInResponse(decoded);
    } else {
      _currentUser = null;
    }
  }

  Future<void> _clearLocalAuth() async {
    _sessionToken = null;
    _currentUser = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kSessionTokenKey);
    await prefs.remove(_kSessionExpiresKey);
  }

  String _humanizeError(Object error) {
    final msg = error.toString();
    if (msg.contains('E-posta veya şifre hatalı')) {
      return 'E-posta veya şifre hatalı';
    }
    if (msg.contains('Mobil şifreniz henüz kurulmamış')) {
      return 'Mobil şifreniz henüz kurulmamış. Yöneticinizden kurulum bağlantısı isteyin.';
    }
    if (msg.contains('Çalışan aktif değil')) {
      return 'Çalışan kaydınız aktif değil';
    }
    return 'Giriş başarısız: $msg';
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
