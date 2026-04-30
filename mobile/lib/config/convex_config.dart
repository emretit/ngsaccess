import 'dart:async';
import 'dart:convert';

import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

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

class HttpConvexClient {
  HttpConvexClient({required String deploymentUrl})
    : _deploymentUrl = deploymentUrl.replaceFirst(RegExp(r'/$'), '');

  final String _deploymentUrl;
  String? _sessionToken;

  String? get sessionToken => _sessionToken;

  Future<void> setAuth({required String? token}) async {
    _sessionToken = token;
  }

  Future<void> clearAuth() async {
    _sessionToken = null;
  }

  /// Auth gerektirmeyen public query (örn. henüz giriş yokken).
  Future<String> query(String name, Map<String, dynamic> args) {
    return _call(endpoint: 'query', name: name, args: args);
  }

  /// Auth gerektirmeyen public mutation (örn. employeeAuth:signIn).
  Future<String> mutation({
    required String name,
    required Map<String, dynamic> args,
  }) {
    return _call(endpoint: 'mutation', name: name, args: args);
  }

  Future<String> action({
    required String name,
    required Map<String, dynamic> args,
  }) {
    return _call(endpoint: 'action', name: name, args: args);
  }

  /// Employee oturumu gerektiren query — `sessionToken` arg'ı otomatik eklenir.
  Future<String> employeeQuery(String name, Map<String, dynamic> args) {
    final token = _sessionToken;
    if (token == null) {
      throw StateError('Mobil oturum yok — employeeQuery çağrılamaz');
    }
    return _call(
      endpoint: 'query',
      name: name,
      args: {...args, 'sessionToken': token},
    );
  }

  /// Employee oturumu gerektiren mutation — `sessionToken` arg'ı otomatik eklenir.
  Future<String> employeeMutation({
    required String name,
    required Map<String, dynamic> args,
  }) {
    final token = _sessionToken;
    if (token == null) {
      throw StateError('Mobil oturum yok — employeeMutation çağrılamaz');
    }
    return _call(
      endpoint: 'mutation',
      name: name,
      args: {...args, 'sessionToken': token},
    );
  }

  Future<ConvexSubscriptionHandle> subscribeEmployeeQuery({
    required String name,
    required Map<String, dynamic> args,
    required void Function(String) onUpdate,
    required void Function(String, String?) onError,
  }) async {
    Future<void> refresh() async {
      try {
        onUpdate(await employeeQuery(name, args));
      } catch (error) {
        onError(error.toString(), null);
      }
    }

    await refresh();
    return ConvexSubscriptionHandle(
      Timer.periodic(const Duration(seconds: 10), (_) {
        unawaited(refresh());
      }),
    );
  }

  Future<String> _call({
    required String endpoint,
    required String name,
    required Map<String, dynamic> args,
  }) async {
    final response = await http.post(
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
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Convex HTTP ${response.statusCode}: ${response.body}');
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw Exception('Invalid Convex response: ${response.body}');
    }

    final status = decoded['status'];
    if (status == 'success') {
      return jsonEncode(_jsonToConvex(decoded['value']));
    }

    final message = decoded['errorMessage'] as String? ?? response.body;
    throw Exception(message);
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
