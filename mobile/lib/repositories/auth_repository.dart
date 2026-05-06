import 'dart:convert';

import '../config/convex_config.dart';
import '../core/errors.dart';

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
  });

  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String? photoUrl;
  final String? departmentId;
  final String? departmentName;
  final String cardNumber;

  factory AuthUser.fromJson(Map<String, dynamic> doc) {
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

/// Convex `employeeAuth.*` çağrılarını domain modeline ve [AppError]'a çevirir.
class AuthRepository {
  AuthRepository(this._client);

  final HttpConvexClient _client;

  Future<SignInResult> signIn({
    required String email,
    required String password,
  }) async {
    final raw = await _client.mutation(
      name: 'employeeAuth:signIn',
      args: {'email': email.trim(), 'password': password},
    );

    final decoded = _decodeMap(raw);
    final token = decoded['token'] as String?;
    final expiresAt = decoded['expiresAt'] as String?;
    final employee = decoded['employee'] as Map<String, dynamic>?;

    if (token == null || employee == null) {
      throw const BusinessError(message: 'Sunucu yanıtı eksik');
    }

    return SignInResult(
      token: token,
      expiresAt: expiresAt,
      user: AuthUser.fromJson(employee),
    );
  }

  Future<AuthUser> me() async {
    final raw = await _client.employeeQuery('employeeAuth:me', {});
    final decoded = _decodeMap(raw);
    return AuthUser.fromJson(decoded);
  }

  /// Sunucu tarafı silme. Network hatası kullanıcı oturumunu engellememeli;
  /// caller bu hatayı yutar.
  Future<void> signOut(String token) async {
    await _client.mutation(
      name: 'employeeAuth:signOut',
      args: {'sessionToken': token},
    );
  }

  Map<String, dynamic> _decodeMap(String raw) {
    final dynamic value;
    try {
      value = jsonDecode(raw);
    } catch (e) {
      throw BusinessError(message: 'Geçersiz sunucu yanıtı: $raw');
    }
    if (value is! Map<String, dynamic>) {
      throw BusinessError(message: 'Beklenmeyen sunucu yanıtı: $raw');
    }
    return value;
  }
}
