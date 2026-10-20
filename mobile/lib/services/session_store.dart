import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// No password is accepted by the persistence boundary.
class StoredSession {
  const StoredSession({required this.token, this.expiresAt});
  final String token;
  final String? expiresAt;
}

abstract interface class SessionStore {
  Future<void> purgeLegacySecrets();
  Future<StoredSession?> readSession();
  Future<void> writeSession(StoredSession session);
  Future<void> clearSession();
  Future<String?> readRememberedEmail();
  Future<void> writeRememberedEmail(String? email);
}

/// Secure credentials plus a non-secret restore marker. A surviving Keychain
/// item cannot automatically authenticate after logout or an app reinstall.
class SecureSessionStore implements SessionStore {
  SecureSessionStore({
    FlutterSecureStorage storage = const FlutterSecureStorage(),
    Future<SharedPreferences> Function()? preferences,
  }) : _storage = storage,
       _preferences = preferences ?? SharedPreferences.getInstance;

  static const sessionKey = 'employee_session_v1';
  static const restoreAllowedKey = 'employee_session_restore_allowed_v1';
  static const rememberedEmailKey = 'remembered_email_v1';
  static const _legacySecretKeys = [
    'remembered_password',
    'mobile_employee_token',
    'mobile_employee_expires',
    'convex_access_token',
    'convex_refresh_token',
  ];
  final FlutterSecureStorage _storage;
  final Future<SharedPreferences> Function() _preferences;

  void _requireWrite(bool succeeded) {
    if (!succeeded) throw StateError('Session preferences unavailable');
  }

  @override
  Future<void> purgeLegacySecrets() async {
    final prefs = await _preferences();
    for (final key in _legacySecretKeys) {
      _requireWrite(await prefs.remove(key));
    }
    // Migrate email only; legacy credential values are never read.
    if (prefs.getBool('remember_me') == true &&
        !prefs.containsKey(rememberedEmailKey)) {
      final email = prefs.getString('remembered_email');
      if (email != null && email.trim().isNotEmpty) {
        _requireWrite(await prefs.setString(rememberedEmailKey, email.trim()));
      }
    }
    _requireWrite(await prefs.remove('remember_me'));
    _requireWrite(await prefs.remove('remembered_email'));
  }

  @override
  Future<StoredSession?> readSession() async {
    await purgeLegacySecrets();
    final prefs = await _preferences();
    if (prefs.getBool(restoreAllowedKey) != true) return null;
    final raw = await _storage.read(key: sessionKey);
    if (raw == null) return null;
    try {
      final Object? decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) throw const FormatException();
      final token = decoded['token'];
      final expiresAt = decoded['expiresAt'];
      if (token is! String ||
          token.trim().isEmpty ||
          (expiresAt != null &&
              (expiresAt is! String || DateTime.tryParse(expiresAt) == null))) {
        throw const FormatException();
      }
      return StoredSession(token: token, expiresAt: expiresAt as String?);
    } on FormatException {
      await clearSession();
      return null;
    }
  }

  @override
  Future<void> writeSession(StoredSession session) async {
    await purgeLegacySecrets();
    final prefs = await _preferences();
    _requireWrite(await prefs.setBool(restoreAllowedKey, false));
    await _storage.write(
      key: sessionKey,
      value: jsonEncode({
        'token': session.token,
        'expiresAt': session.expiresAt,
      }),
    );
    _requireWrite(await prefs.setBool(restoreAllowedKey, true));
  }

  @override
  Future<void> clearSession() async {
    final prefs = await _preferences();
    _requireWrite(await prefs.setBool(restoreAllowedKey, false));
    await purgeLegacySecrets();
    await _storage.delete(key: sessionKey);
  }

  @override
  Future<String?> readRememberedEmail() async {
    await purgeLegacySecrets();
    return (await _preferences()).getString(rememberedEmailKey);
  }

  @override
  Future<void> writeRememberedEmail(String? email) async {
    await purgeLegacySecrets();
    final prefs = await _preferences();
    final normalized = email?.trim();
    if (normalized == null || normalized.isEmpty) {
      _requireWrite(await prefs.remove(rememberedEmailKey));
    } else {
      _requireWrite(await prefs.setString(rememberedEmailKey, normalized));
    }
  }
}
