import 'dart:convert';
import 'dart:typed_data';

import 'errors.dart';

/// HTTP 560 is a completed UDF error, not an infrastructure failure to retry.
String decodeConvexResponse({required int statusCode, required String body}) {
  if (statusCode == 401) throw const AuthExpiredError();
  if (statusCode == 403) {
    throw const BusinessError(message: '', code: 'ACCESS_DENIED');
  }
  if (statusCode == 429) {
    throw const BusinessError(message: '', code: 'RATE_LIMITED');
  }
  if (statusCode >= 500 && statusCode != 560) {
    throw ServerError(statusCode: statusCode);
  }
  if ((statusCode < 200 || statusCode >= 300) && statusCode != 560) {
    throw const BusinessError(message: '', code: 'BUSINESS_ERROR');
  }

  final envelope = decodeResponseObject(body);
  if (envelope['status'] == 'success') {
    if (statusCode == 560 || !envelope.containsKey('value')) {
      throw const ProtocolError();
    }
    try {
      return jsonEncode(_decodeValue(envelope['value']));
    } on AppError {
      rethrow;
    } catch (_) {
      throw const ProtocolError();
    }
  }
  if (envelope['status'] != 'error' || envelope['errorMessage'] is! String) {
    throw const ProtocolError();
  }

  // Structured codes take precedence over text, including unknown future codes.
  if (envelope.containsKey('errorData')) {
    final data = _decodeValue(envelope['errorData']);
    if (data is Map<String, Object?>) {
      final code = data['code'];
      if (code is String) {
        if (_authCodes.contains(code)) throw const AuthExpiredError();
        throw BusinessError(
          message: '',
          code: normalizeBusinessCode(code) ?? 'BUSINESS_ERROR',
          retryAfterMs: _retryAfter(data['retryAfterMs']),
        );
      }
      if (code != null) throw const ProtocolError();
      final message = data['message'];
      if (message is String) _throwLegacyOrGeneric(message);
    }
    if (data is String) _throwLegacyOrGeneric(data);
    throw const BusinessError(message: '', code: 'BUSINESS_ERROR');
  }
  _throwLegacyOrGeneric(envelope['errorMessage'] as String);
}

const _authCodes = {
  'AUTH_EXPIRED',
  'AUTH_REQUIRED',
  'SESSION_EXPIRED',
  'SESSION_INVALID',
  'AUTH_SESSION_EXPIRED',
  'AUTH_SESSION_INVALID',
  'UNAUTHENTICATED',
  'SESSION_REVOKED',
  'EMPLOYEE_INACTIVE',
  'AUTH_EMPLOYEE_INACTIVE',
};

Never _throwLegacyOrGeneric(String raw) {
  // No unbounded contains()/regex over raw errors: redacted errors stay generic.
  final firstLine = raw.split('\n').first.trim();
  final message = firstLine.startsWith('Uncaught Error: ')
      ? firstLine.substring('Uncaught Error: '.length).trim()
      : firstLine;
  if (const {
    'Mobil oturum yok',
    'session expired',
    'Session expired',
    'Oturum süresi doldu',
    'Oturum geçersiz',
    'Unauthorized',
  }.contains(message)) {
    throw const AuthExpiredError();
  }
  throw BusinessError(
    message: '',
    code: legacyBusinessCode(message) ?? 'BUSINESS_ERROR',
  );
}

Map<String, Object?> decodeResponseObject(String raw) {
  final Object? decoded;
  try {
    decoded = jsonDecode(raw);
  } catch (_) {
    throw const ProtocolError();
  }
  if (decoded is! Map<String, Object?>) throw const ProtocolError();
  return decoded;
}

List<Object?> decodeResponseList(String raw) {
  final Object? decoded;
  try {
    decoded = jsonDecode(raw);
  } catch (_) {
    throw const ProtocolError();
  }
  if (decoded is! List<Object?>) throw const ProtocolError();
  return decoded;
}

/// Explicit nulls are meaningful updates in Convex and must not be dropped.
Object? encodeConvexValue(Object? value) {
  if (value == null || value is String || value is bool) return value;
  if (value is num && value.isFinite) return value;
  if (value is List) return value.map(encodeConvexValue).toList();
  if (value is Map) {
    final result = <String, Object?>{};
    for (final entry in value.entries) {
      if (entry.key is! String) throw const ProtocolError();
      result[entry.key as String] = encodeConvexValue(entry.value);
    }
    return result;
  }
  throw const ProtocolError();
}

Object? _decodeValue(Object? value) {
  if (value == null || value is String || value is bool) return value;
  if (value is num && value.isFinite) {
    // Convex numbers are float64, so whole-number fields can arrive as 0.0.
    // Normalize only exact JSON-safe integers; never truncate fractions or
    // round large values, and preserve the special negative-zero value.
    if (value is double &&
        !(value == 0 && value.isNegative) &&
        value.abs() <= 9007199254740991 &&
        value.truncateToDouble() == value) {
      return value.toInt();
    }
    return value;
  }
  if (value is List) return value.map(_decodeValue).toList();
  if (value is Map<String, Object?>) {
    for (final marker in [r'$integer', r'$float', r'$bytes']) {
      if (!value.containsKey(marker)) continue;
      if (value.length != 1 || value[marker] is! String) {
        throw const ProtocolError();
      }
      try {
        final bytes = base64Decode(value[marker] as String);
        if (marker == r'$bytes') return bytes.toList();
        if (bytes.length != 8) throw const ProtocolError();
        final data = ByteData.sublistView(bytes);
        if (marker == r'$integer') return data.getInt64(0, Endian.little);
        final number = data.getFloat64(0, Endian.little);
        // The compatibility String API cannot represent non-finite JSON numbers.
        if (!number.isFinite) throw const ProtocolError();
        return number;
      } on AppError {
        rethrow;
      } catch (_) {
        throw const ProtocolError();
      }
    }
    return value.map((key, item) => MapEntry(key, _decodeValue(item)));
  }
  throw const ProtocolError();
}

int? _retryAfter(Object? value) =>
    value is int && value >= 0 && value <= 86400000 ? value : null;
