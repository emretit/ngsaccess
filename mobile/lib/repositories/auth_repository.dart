import 'dart:convert';

import '../config/convex_config.dart';
import '../core/errors.dart';

const _invalidResponse = ProtocolError();

class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.cardNumber,
    this.photoUrl,
    this.departmentId,
    this.departmentName,
    this.projectId,
    this.projectName,
  });

  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String? photoUrl;
  final String? departmentId;
  final String? departmentName;
  final String? projectId;
  final String? projectName;
  final String cardNumber;

  factory AuthUser.fromJson(Map<String, dynamic> doc) {
    String requiredString(String key, {bool nonEmpty = false}) {
      final value = doc[key];
      if (value is! String || (nonEmpty && value.trim().isEmpty)) {
        throw _invalidResponse;
      }
      return value;
    }

    String? optionalString(String key) {
      final value = doc[key];
      if (value == null) return null;
      if (value is! String) throw _invalidResponse;
      return value;
    }

    return AuthUser(
      id: requiredString('id', nonEmpty: true),
      email: requiredString('email'),
      firstName: requiredString('firstName'),
      lastName: requiredString('lastName'),
      cardNumber: requiredString('cardNumber'),
      photoUrl: optionalString('photoUrl'),
      departmentId: optionalString('departmentId'),
      departmentName: optionalString('departmentName'),
      projectId: optionalString('projectId'),
      projectName: optionalString('projectName'),
    );
  }
}

class SignInResult {
  const SignInResult({
    required this.token,
    required this.expiresAt,
    required this.user,
  });

  final String token;
  final String? expiresAt;
  final AuthUser user;
}

/// Uses only the injected client, including its authentication state.
class AuthRepository {
  AuthRepository(this._client);

  final HttpConvexClient _client;

  Future<void> setAuth(String token) => _client.setAuth(token: token);
  Future<void> clearAuth() => _client.clearAuth();

  Future<SignInResult> signIn({
    required String email,
    required String password,
  }) async {
    final raw = await _client.mutation(
      name: 'employeeAuth:signIn',
      args: {'email': email.trim(), 'password': password},
    );
    final decoded = _decodeMap(raw);
    _throwStructuredError(decoded);
    final token = decoded['token'];
    final expiresAt = decoded['expiresAt'];
    final employee = decoded['employee'];
    if (token is! String ||
        token.trim().isEmpty ||
        employee is! Map<String, dynamic> ||
        (expiresAt != null &&
            (expiresAt is! String || DateTime.tryParse(expiresAt) == null))) {
      throw _invalidResponse;
    }
    return SignInResult(
      token: token,
      expiresAt: expiresAt as String?,
      user: AuthUser.fromJson(employee),
    );
  }

  Future<AuthUser> me() async {
    final raw = await _client.employeeQuery('employeeAuth:me', {});
    final decoded = _decodeMap(raw);
    _throwStructuredError(decoded);
    return AuthUser.fromJson(decoded);
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    // employeeMutation captures the current client token before its first await.
    final raw = await _client.employeeMutation(
      name: 'employeeAuth:changePassword',
      args: {'currentPassword': currentPassword, 'newPassword': newPassword},
    );
    final decoded = _decodeMap(raw);
    _throwStructuredError(decoded);
    if (decoded['requiresSignIn'] != true) throw _invalidResponse;
  }

  /// Remote revocation is independent of local logout and never retried here.
  Future<void> signOut(String token) async {
    await _client.mutation(
      name: 'employeeAuth:signOut',
      args: {'sessionToken': token},
    );
  }

  Map<String, dynamic> _decodeMap(String raw) {
    final Object? value;
    try {
      value = jsonDecode(raw);
    } on FormatException {
      throw _invalidResponse;
    }
    if (value is! Map<String, dynamic>) throw _invalidResponse;
    return value;
  }

  void _throwStructuredError(Map<String, dynamic> decoded) {
    if (!decoded.containsKey('error')) return;
    final error = decoded['error'];
    if (error is! Map<String, dynamic> ||
        error['code'] is! String ||
        error['message'] is! String) {
      throw _invalidResponse;
    }
    final code = error['code'] as String;
    final retryAfterMs = error['retryAfterMs'];
    if (retryAfterMs != null && (retryAfterMs is! int || retryAfterMs < 0)) {
      throw _invalidResponse;
    }
    switch (code) {
      case 'SESSION_INVALID':
      case 'SESSION_EXPIRED':
      case 'SESSION_REVOKED':
      case 'EMPLOYEE_INACTIVE':
        throw AuthExpiredError(code);
      case 'INVALID_CREDENTIALS':
        throw const BusinessError(
          message: 'E-posta veya şifre hatalı',
          code: 'INVALID_CREDENTIALS',
        );
      case 'PASSWORD_POLICY':
        throw const BusinessError(
          message:
              'Yeni şifre en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermeli, en fazla 72 UTF-8 bayt olmalı ve mevcut şifreden farklı olmalı.',
          code: 'PASSWORD_POLICY',
        );
      case 'RATE_LIMITED':
        throw BusinessError(
          message:
              'Çok fazla giriş denemesi. Lütfen biraz sonra tekrar deneyin.',
          code: 'RATE_LIMITED',
          retryAfterMs: retryAfterMs as int?,
        );
      default:
        throw _invalidResponse;
    }
  }
}
