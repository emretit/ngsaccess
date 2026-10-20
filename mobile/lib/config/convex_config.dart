import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../core/errors.dart';
import '../core/response_decoder.dart';
import '../core/safe_diagnostics.dart';

class ConvexConfig {
  static const _definedUrl = String.fromEnvironment('CONVEX_URL');
  static const _definedEnvironment = String.fromEnvironment('APP_ENV');
  static const _allowedHost = String.fromEnvironment('CONVEX_ALLOWED_HOST');
  static HttpConvexClient? _client;

  static String get deploymentUrl => resolveDeploymentUrl(
    definedUrl: _definedUrl,
    environment: dotenv.isInitialized ? dotenv.env : const {},
    releaseMode: kReleaseMode,
    appEnvironment: _definedEnvironment,
    allowedHost: _allowedHost,
  );

  static HttpConvexClient get client {
    final existing = _client;
    if (existing != null) return existing;
    throw StateError('ConvexConfig.initialize() must be called first.');
  }

  /// Release always requires --dart-define=CONVEX_URL; debug supports .env.
  static Future<void> initialize() async {
    close();
    if (!kReleaseMode && _definedUrl.isEmpty) {
      try {
        await dotenv.load(fileName: '.env');
      } catch (_) {
        // A missing development asset is handled by validation below.
      }
    }
    _client = HttpConvexClient(deploymentUrl: deploymentUrl);
  }

  static void close() {
    _client?.close();
    _client = null;
  }

  @visibleForTesting
  static String resolveDeploymentUrl({
    required String definedUrl,
    required Map<String, String> environment,
    required bool releaseMode,
    String appEnvironment = '',
    String allowedHost = '',
  }) {
    final value = definedUrl.isNotEmpty
        ? definedUrl
        : releaseMode
        ? ''
        : environment['CONVEX_URL'] ?? '';
    final validated = validateDeploymentUrl(value);
    if (releaseMode &&
        (!const {'staging', 'production'}.contains(appEnvironment) ||
            allowedHost.trim().isEmpty)) {
      throw const ConfigurationError();
    }
    if (allowedHost.isNotEmpty &&
        Uri.parse(validated).host.toLowerCase() != allowedHost.toLowerCase()) {
      throw const ConfigurationError();
    }
    return validated;
  }
}

/// Reject credentials, path/query injection and non-TLS targets before any I/O.
String validateDeploymentUrl(String raw) {
  final value = raw.trim();
  final uri = Uri.tryParse(value);
  if (value.isEmpty ||
      uri == null ||
      uri.scheme != 'https' ||
      uri.host.isEmpty ||
      uri.userInfo.isNotEmpty ||
      uri.hasQuery ||
      uri.hasFragment ||
      (uri.path.isNotEmpty && uri.path != '/') ||
      RegExp(r'\s').hasMatch(value) ||
      !uri.hasAuthority) {
    throw const ConfigurationError();
  }
  final labels = uri.host.toLowerCase().split('.');
  final labelPattern = RegExp(r'^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$');
  if (uri.host.length > 253 ||
      (labels.length < 2 && uri.host != 'localhost') ||
      labels.any((label) => !labelPattern.hasMatch(label))) {
    throw const ConfigurationError();
  }
  try {
    if (uri.port < 1 || uri.port > 65535) throw const ConfigurationError();
  } on FormatException {
    throw const ConfigurationError();
  }
  return uri.replace(path: '').toString();
}

HttpConvexClient get convex => ConvexConfig.client;

class ConvexSubscriptionHandle {
  ConvexSubscriptionHandle(this._onCancel);
  final void Function() _onCancel;
  bool _isCancelled = false;
  void cancel() {
    if (_isCancelled) return;
    _isCancelled = true;
    _onCancel();
  }
}

typedef AuthExpiryCallback = void Function();

class HttpConvexClient {
  HttpConvexClient({
    required String deploymentUrl,
    Duration requestTimeout = const Duration(seconds: 15),
    int maxRetries = 3,
    http.Client? httpClient,
    SafeDiagnostics? diagnostics,
  }) : _deploymentUrl = validateDeploymentUrl(deploymentUrl),
       _timeout = requestTimeout,
       _maxRetries = math.min(10, math.max(1, maxRetries)),
       _http = httpClient ?? http.Client(),
       _diagnostics = diagnostics ?? SafeDiagnostics.instance;

  final String _deploymentUrl;
  final Duration _timeout;
  final int _maxRetries;
  final http.Client _http;
  final SafeDiagnostics _diagnostics;
  final Set<ConvexSubscriptionHandle> _subscriptions = {};
  String? _sessionToken;
  AuthExpiryCallback? _onAuthExpired;
  int _authGeneration = 0;
  int? _expiredGeneration;
  bool _closed = false;

  String? get sessionToken => _sessionToken;

  /// Validated origin for account-scoped local preferences; never display it.
  String get deploymentUrl => _deploymentUrl;

  void setOnAuthExpired(AuthExpiryCallback? callback) {
    _onAuthExpired = callback;
  }

  /// An old owner can remove its own handler without clearing a replacement.
  void clearOnAuthExpired([AuthExpiryCallback? callback]) {
    if (callback == null || identical(callback, _onAuthExpired)) {
      _onAuthExpired = null;
    }
  }

  Future<void> setAuth({required String? token}) async {
    _ensureOpen();
    _authGeneration++;
    _sessionToken = token == null || token.trim().isEmpty ? null : token;
    _cancelSubscriptions();
  }

  Future<void> clearAuth() async {
    _authGeneration++;
    _sessionToken = null;
    _cancelSubscriptions();
  }

  void close() {
    if (_closed) return;
    _closed = true;
    _authGeneration++;
    _sessionToken = null;
    _onAuthExpired = null;
    _cancelSubscriptions();
    _http.close();
  }

  void _cancelSubscriptions() {
    for (final handle in _subscriptions.toList()) {
      handle.cancel();
    }
    _subscriptions.clear();
  }

  void _ensureOpen() {
    if (_closed) {
      throw const BusinessError(message: '', code: 'CLIENT_CLOSED');
    }
  }

  Future<String> query(String name, Map<String, dynamic> args) =>
      _call(endpoint: 'query', name: name, args: args, retry: true);

  Future<String> mutation({
    required String name,
    required Map<String, dynamic> args,
    bool retry = false,
  }) => _call(endpoint: 'mutation', name: name, args: args, retry: retry);

  Future<String> action({
    required String name,
    required Map<String, dynamic> args,
    bool retry = false,
  }) => _call(endpoint: 'action', name: name, args: args, retry: retry);

  Future<String> employeeQuery(String name, Map<String, dynamic> args) =>
      _employeeCall('query', name, args, true);

  Future<String> employeeMutation({
    required String name,
    required Map<String, dynamic> args,
    bool retry = false,
  }) => _employeeCall('mutation', name, args, retry);

  Future<String> employeeAction({
    required String name,
    required Map<String, dynamic> args,
    bool retry = false,
  }) => _employeeCall('action', name, args, retry);

  Future<String> _employeeCall(
    String endpoint,
    String name,
    Map<String, dynamic> args,
    bool retry,
  ) {
    _ensureOpen();
    final token = _sessionToken;
    if (token == null) throw const AuthExpiredError();
    return _call(
      endpoint: endpoint,
      name: name,
      args: {...args, 'sessionToken': token},
      retry: retry,
      employee: true,
    );
  }

  Future<ConvexSubscriptionHandle> subscribeEmployeeQuery({
    required String name,
    required Map<String, dynamic> args,
    required void Function(String) onUpdate,
    required void Function(AppError) onError,
    Duration pollingInterval = const Duration(minutes: 1),
    Duration maxPollingInterval = const Duration(minutes: 5),
  }) async {
    _ensureOpen();
    if (pollingInterval <= Duration.zero ||
        maxPollingInterval < pollingInterval) {
      throw ArgumentError('Invalid polling interval');
    }
    Timer? timer;
    var cancelled = false;
    var failures = 0;
    final generation = _authGeneration;
    late final ConvexSubscriptionHandle handle;
    handle = ConvexSubscriptionHandle(() {
      cancelled = true;
      timer?.cancel();
      _subscriptions.remove(handle);
    });
    _subscriptions.add(handle);
    bool isCurrent() => !cancelled && !_closed && generation == _authGeneration;
    late final Future<void> Function() refresh;
    refresh = () async {
      if (!isCurrent()) return;
      try {
        final result = await employeeQuery(name, args);
        if (!isCurrent()) return;
        failures = 0;
        onUpdate(result);
      } catch (error, stack) {
        if (!isCurrent()) return;
        final mapped = AppError.fromException(error, stack);
        failures++;
        if (mapped is AuthExpiredError) handle.cancel();
        onError(mapped);
      } finally {
        if (isCurrent()) {
          final milliseconds = math.min(
            pollingInterval.inMilliseconds * (1 << math.min(failures, 10)),
            maxPollingInterval.inMilliseconds,
          );
          timer = Timer(Duration(milliseconds: milliseconds), () {
            unawaited(refresh());
          });
        }
      }
    };
    await refresh();
    return handle;
  }

  Future<String> _call({
    required String endpoint,
    required String name,
    required Map<String, dynamic> args,
    required bool retry,
    bool employee = false,
  }) async {
    _ensureOpen();
    final token = _sessionToken;
    final generation = _authGeneration;
    // Freeze all arguments once: retries carry the original request/session.
    final body = jsonEncode({
      'path': name,
      'format': 'convex_encoded_json',
      'args': [encodeConvexValue(args)],
    });
    bool current() =>
        !_closed && generation == _authGeneration && token == _sessionToken;
    void guard() {
      _ensureOpen();
      if (employee && !current()) {
        throw const BusinessError(message: '', code: 'SESSION_CHANGED');
      }
    }

    final operation = switch (endpoint) {
      'query' => DiagnosticOperation.query,
      'mutation' => DiagnosticOperation.mutation,
      _ => DiagnosticOperation.action,
    };
    final maxAttempts = retry ? _maxRetries : 1;
    final watch = Stopwatch()..start();
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      guard();
      try {
        final result = await _attempt(endpoint: endpoint, body: body);
        guard();
        return result;
      } catch (error, stack) {
        // A late A-expiry must not become a provider-visible B-expiry either.
        guard();
        final mapped = AppError.fromException(error, stack);
        _diagnostics.record(
          mapped,
          stack: stack,
          operation: operation,
          elapsed: watch.elapsed,
          attempt: attempt,
        );
        if (mapped is AuthExpiredError) {
          if (employee && current() && _expiredGeneration != generation) {
            _expiredGeneration = generation;
            _onAuthExpired?.call();
          }
          throw mapped;
        }
        final transient =
            mapped is NetworkError ||
            mapped is TimeoutError ||
            (mapped is ServerError &&
                mapped.statusCode >= 500 &&
                mapped.statusCode != 560);
        if (!transient || attempt == maxAttempts) throw mapped;
        await Future<void>.delayed(
          Duration(milliseconds: 250 * (1 << (attempt - 1))),
        );
      }
    }
    throw const ProtocolError();
  }

  Future<String> _attempt({
    required String endpoint,
    required String body,
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
            body: body,
          )
          .timeout(_timeout);
    } on TimeoutException {
      throw const TimeoutError();
    } on SocketException {
      throw const NetworkError();
    } on HttpException {
      throw const NetworkError();
    } on http.ClientException {
      throw const NetworkError();
    }
    return decodeConvexResponse(
      statusCode: response.statusCode,
      body: response.body,
    );
  }
}
