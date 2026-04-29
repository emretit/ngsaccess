import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import '../config/convex_config.dart';

class AuthUser {
  final String id;
  final String email;
  final String? firstName;
  final String? lastName;
  final String? role;

  AuthUser({
    required this.id,
    required this.email,
    this.firstName,
    this.lastName,
    this.role,
  });

  factory AuthUser.fromConvexDoc(Map<String, dynamic> doc) {
    final fullName = doc['fullName'] as String?;
    String? first;
    String? last;
    if (fullName != null && fullName.trim().isNotEmpty) {
      final parts = fullName.trim().split(' ');
      first = parts.first;
      last = parts.length > 1 ? parts.sublist(1).join(' ') : null;
    }
    return AuthUser(
      id: doc['_id'] as String,
      email: (doc['email'] as String?) ?? '',
      firstName: first,
      lastName: last,
      role: doc['role'] as String?,
    );
  }
}

class AuthProvider extends ChangeNotifier {
  static const _kAccessTokenKey = 'convex_access_token';
  static const _kRefreshTokenKey = 'convex_refresh_token';

  AuthUser? _currentUser;
  bool _isLoading = false;
  String? _errorMessage;
  String? _accessToken;
  String? _refreshToken;

  AuthUser? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _currentUser != null && _accessToken != null;
  String? get accessToken => _accessToken;

  String get _convexSiteUrl {
    final cloud = (dotenv.env['CONVEX_URL'] ?? 'https://notable-tern-4.convex.cloud').trim();
    return cloud.replaceFirst(RegExp(r'\.convex\.cloud/?$'), '.convex.site');
  }

  Future<void> bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_kAccessTokenKey);
    final refresh = prefs.getString(_kRefreshTokenKey);
    if (token == null || token.isEmpty) return;

    _accessToken = token;
    _refreshToken = refresh;
    try {
      await convex.setAuth(token: token);
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

      final uri = Uri.parse('$_convexSiteUrl/api/auth/signin');
      final response = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'provider': 'password',
          'params': {
            'email': email,
            'password': password,
            'flow': 'signIn',
          },
        }),
      );

      if (response.statusCode != 200) {
        throw Exception('HTTP ${response.statusCode}: ${response.body}');
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final tokens = (body['tokens'] as Map<String, dynamic>?) ?? body;
      final accessToken = tokens['token'] as String? ?? tokens['accessToken'] as String?;
      final refreshToken = tokens['refreshToken'] as String?;

      if (accessToken == null) {
        throw Exception('Sign-in response did not include a token: ${response.body}');
      }

      _accessToken = accessToken;
      _refreshToken = refreshToken;

      await convex.setAuth(token: accessToken);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kAccessTokenKey, accessToken);
      if (refreshToken != null) {
        await prefs.setString(_kRefreshTokenKey, refreshToken);
      }

      await _loadCurrentUser();

      _isLoading = false;
      notifyListeners();
      return _currentUser != null;
    } catch (error) {
      _isLoading = false;
      _errorMessage = 'Giriş başarısız: ${error.toString()}';
      _accessToken = null;
      _refreshToken = null;
      _currentUser = null;
      notifyListeners();
      return false;
    }
  }

  Future<bool> resetPassword(String email) async {
    _errorMessage =
        'Şifre sıfırlama şu an desteklenmiyor. Lütfen yöneticinizle iletişime geçin.';
    notifyListeners();
    return false;
  }

  Future<void> signOut() async {
    try {
      await convex.clearAuth();
    } catch (_) {}
    await _clearLocalAuth();
    notifyListeners();
  }

  Future<void> _loadCurrentUser() async {
    final raw = await convex.query('users:currentUser', {});
    final decoded = jsonDecode(raw);
    if (decoded is Map<String, dynamic>) {
      _currentUser = AuthUser.fromConvexDoc(decoded);
    } else {
      _currentUser = null;
    }
  }

  Future<void> _clearLocalAuth() async {
    _accessToken = null;
    _refreshToken = null;
    _currentUser = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kAccessTokenKey);
    await prefs.remove(_kRefreshTokenKey);
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
