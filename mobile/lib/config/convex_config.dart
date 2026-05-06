import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../core/errors.dart';

class ConvexConfig {
  static String get deploymentUrl =>
      dotenv.env['CONVEX_URL'] ?? 'https://notable-tern-4.convex.cloud';

  static HttpConvexClient? _client;

  static HttpConvexClient get client {
    final existing = _client;
    if (existing != null) return existing;
    throw StateError('ConvexConfig.initialize() must be called first.');
  }

  static Future<void> initialize() async {
    try {
      await dotenv.load(fileName: ".env");
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          'Warning: .env file not found. Falling back to default CONVEX_URL.',
        );
      }
    }

    _client = HttpConvexClient(deploymentUrl: deploymentUrl);
  }
}

HttpConvexClient get convex => ConvexConfig.client;

class ConvexSubscriptionHandle {
  ConvexSubscriptionHandle(this._timer);

  final Timer _timer;

  void cancel() {
    _timer.cancel();
  }
}

/// Auth oturumu sona erdiğinde tetiklenen callback. UI tarafı (ör. main.dart)
/// burada login ekranına yönlendirme yapar. `null` ise sessiz geçer.
typedef AuthExpiryCallback = void Function();

class HttpConvexClient {
  HttpConvexClient({
    required String deploymentUrl,
    Duration requestTimeout = const Duration(seconds: 15),
    int maxRetries = 3,
    http.Client? httpClient,
  })  : _deploymentUrl = deploymentUrl.replaceFirst(RegExp(r'/$'), ''),
        _timeout = requestTimeout,
        _maxRetries = maxRetries,
        _http = httpClient ?? http.Client();

  final String _deploymentUrl;
  final Duration _timeout;
  final int _maxRetries;
  final http.Client _http;

  String? _sessionToken;
  AuthExpiryCallback? _onAuthExpired;

  String? get sessionToken => _sessionToken;

  /// Auth oturumu sona erdiğinde çağrılacak callback'i ayarlar.
  /// Birden fazla kez çağrılırsa en son verilen kullanılır.
  void setOnAuthExpired(AuthExpiryCallback? callback) {
    _onAuthExpired = callback;
  }

  Future<void> setAuth({required String? token}) async {
    _sessionToken = token;
  }

  Future<void> clearAuth() async {
    _sessionToken = null;
  }

  /// Auth gerektirmeyen public query (örn. henüz giriş yokken).
  Future<String> query(String name, Map<String, dynamic> args) {
    return _call(endpoint: 'query', name: name, args: args, retry: true);
  }

  /// Auth gerektirmeyen public mutation (örn. employeeAuth:signIn).
  ///
  /// [retry] varsayılan olarak `false` — mutation'lar idempotent olmadıkça
  /// retry edilmez. Caller idempotent olduğunu biliyorsa `retry: true` geçer.
  Future<String> mutation({
    required String name,
    required Map<String, dynamic> args,
    bool retry = false,
  }) {
    return _call(endpoint: 'mutation', name: name, args: args, retry: retry);
  }

  Future<String> action({
    required String name,
    required Map<String, dynamic> args,
    bool retry = false,
  }) {
    return _call(endpoint: 'action', name: name, args: args, retry: retry);
  }

  /// Employee oturumu gerektiren query — `sessionToken` arg'ı otomatik eklenir.
  Future<String> employeeQuery(String name, Map<String, dynamic> args) {
    final token = _sessionToken;
    if (token == null) {
      throw const AuthExpiredError('Mobil oturum yok');
    }
    return _call(
      endpoint: 'query',
      name: name,
      args: {...args, 'sessionToken': token},
      retry: true,
    );
  }

  /// Employee oturumu gerektiren mutation — `sessionToken` arg'ı otomatik eklenir.
  Future<String> employeeMutation({
    required String name,
    required Map<String, dynamic> args,
    bool retry = false,
  }) {
    final token = _sessionToken;
    if (token == null) {
      throw const AuthExpiredError('Mobil oturum yok');
    }
    return _call(
      endpoint: 'mutation',
      name: name,
      args: {...args, 'sessionToken': token},
      retry: retry,
    );
  }

  Future<ConvexSubscriptionHandle> subscribeEmployeeQuery({
    required String name,
    required Map<String, dynamic> args,
    required void Function(String) onUpdate,
    required void Function(AppError) onError,
  }) async {
    Future<void> refresh() async {
      try {
        onUpdate(await employeeQuery(name, args));
      } catch (error, stack) {
        final mapped = AppError.fromException(error, stack);
        onError(mapped);
      }
    }

    await refresh();
    return ConvexSubscriptionHandle(
      Timer.periodic(const Duration(seconds: 3), (_) {
        unawaited(refresh());
      }),
    );
  }

  Future<String> _call({
    required String endpoint,
    required String name,
    required Map<String, dynamic> args,
    required bool retry,
  }) async {
    final maxAttempts = retry ? _maxRetries : 1;
    AppError? lastError;

    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await _attempt(endpoint: endpoint, name: name, args: args);
      } on AuthExpiredError {
        // Token yoksa veya backend expired dediyse retry etmenin anlamı yok.
        _onAuthExpired?.call();
        rethrow;
      } on BusinessError {
        // İş kuralı hatası (4xx semantik) — retry edilmez.
        rethrow;
      } on TimeoutError catch (e) {
        lastError = e;
      } on NetworkError catch (e) {
        lastError = e;
      } on ServerError catch (e) {
        // Sadece 5xx retry edilir.
        if (e.statusCode < 500) rethrow;
        lastError = e;
      } catch (error, stack) {
        // Beklenmedik istisna — wrap edip dışarı.
        throw AppError.fromException(error, stack);
      }

      if (attempt < maxAttempts - 1) {
        final delayMs = 250 * math.pow(2, attempt).toInt();
        await Future<void>.delayed(Duration(milliseconds: delayMs));
      }
    }

    throw lastError ?? const UnknownError('retry exhausted');
  }

  Future<String> _attempt({
    required String endpoint,
    required String name,
    required Map<String, dynamic> args,
  }) async {
    final http.Response response;
    try {
      response = await _http
          .post(
            Uri.parse('$_deploymentUrl/api/$endpoint'),
            headers: const {
              'Content-Type': 'application/json',
              'Convex-Client': 'flutter-http-ngsplus',
            },
            body: jsonEncode({
              'path': name,
              'format': 'convex_encoded_json',
              'args': [_convexToJson(args)],
            }),
          )
          .timeout(_timeout);
    } on TimeoutException {
      throw const TimeoutError();
    } on SocketException catch (e) {
      throw NetworkError(e.message);
    } on HttpException catch (e) {
      throw NetworkError(e.message);
    }

    if (response.statusCode == 401 || response.statusCode == 403) {
      throw AuthExpiredError('HTTP ${response.statusCode}');
    }

    if (response.statusCode >= 500) {
      throw ServerError(statusCode: response.statusCode, body: response.body);
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw BusinessError(
        message: 'Convex HTTP ${response.statusCode}: ${response.body}',
      );
    }

    final dynamic decoded;
    try {
      decoded = jsonDecode(response.body);
    } catch (e) {
      throw BusinessError(message: 'Invalid Convex response: ${response.body}');
    }

    if (decoded is! Map<String, dynamic>) {
      throw BusinessError(message: 'Invalid Convex response: ${response.body}');
    }

    final status = decoded['status'];
    if (status == 'success') {
      return jsonEncode(_jsonToConvex(decoded['value']));
    }

    final errorMessage =
        decoded['errorMessage'] as String? ?? response.body;

    if (_isAuthExpiryMessage(errorMessage)) {
      throw AuthExpiredError(errorMessage);
    }

    throw BusinessError(message: errorMessage);
  }

  bool _isAuthExpiryMessage(String message) {
    final lower = message.toLowerCase();
    return lower.contains('mobil oturum yok') ||
        lower.contains('session expired') ||
        lower.contains('oturum süresi doldu') ||
        lower.contains('oturum geçersiz') ||
        lower.contains('unauthorized');
  }
}

Object? _convexToJson(Object? value) {
  if (value == null || value is String || value is num || value is bool) {
    return value;
  }
  if (value is List) {
    return value.map(_convexToJson).toList();
  }
  if (value is Map) {
    final result = <String, Object?>{};
    for (final entry in value.entries) {
      final key = entry.key;
      if (key is String && entry.value != null) {
        result[key] = _convexToJson(entry.value);
      }
    }
    return result;
  }
  throw ArgumentError('Unsupported Convex value: $value');
}

Object? _jsonToConvex(Object? value) {
  if (value == null || value is String || value is num || value is bool) {
    return value;
  }
  if (value is List) {
    return value.map(_jsonToConvex).toList();
  }
  if (value is Map<String, dynamic>) {
    if (value.length == 1 && value.containsKey(r'$integer')) {
      return _decodeInt64(value[r'$integer']);
    }
    if (value.length == 1 && value.containsKey(r'$float')) {
      return _decodeFloat64(value[r'$float']);
    }
    final result = <String, Object?>{};
    for (final entry in value.entries) {
      result[entry.key] = _jsonToConvex(entry.value);
    }
    return result;
  }
  return value;
}

Object _decodeInt64(Object? encoded) {
  if (encoded is! String) return encoded.toString();
  final bytes = base64Decode(encoded);
  if (bytes.length != 8) return encoded;
  final data = ByteData.sublistView(Uint8List.fromList(bytes));
  final value = data.getInt64(0, Endian.little);
  return value;
}

Object _decodeFloat64(Object? encoded) {
  if (encoded is! String) return encoded.toString();
  final bytes = base64Decode(encoded);
  if (bytes.length != 8) return encoded;
  final data = ByteData.sublistView(Uint8List.fromList(bytes));
  return data.getFloat64(0, Endian.little);
}
