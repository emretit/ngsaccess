import 'dart:convert';

import '../config/convex_config.dart';
import '../models/qr_code_model.dart';

enum QrTokenStatus { active, consumed, expired }

class QrToken {
  const QrToken({
    required this.value,
    required this.expiresAt,
    this.serverTime,
    this.status = QrTokenStatus.active,
  });
  final String value;
  final DateTime expiresAt;
  final DateTime? serverTime;
  final QrTokenStatus status;
}

class QrRepository {
  QrRepository(this._client);
  final HttpConvexClient _client;

  // Used only as an opaque request ownership marker, never logged or persisted.
  String? get sessionKey => _client.sessionToken;

  Future<QrToken> createToken() async {
    final raw = await _client.employeeMutation(
      name: 'employeeCheckIn:createMyCheckInToken',
      args: const {},
      retry: false,
    );
    return _decode(raw);
  }

  Future<QrToken> tokenStatus(QrToken token) async {
    final raw = await _client.employeeQuery(
      'employeeCheckIn:getMyCheckInTokenStatus',
      {'token': token.value},
    );
    return _decode(raw, existingToken: token.value);
  }

  QrToken _decode(String raw, {String? existingToken}) {
    final Object? value = jsonDecode(raw);
    if (value is! Map<String, dynamic>) {
      throw const FormatException('Invalid QR token response');
    }
    final token = value['token'] ?? existingToken;
    final expiresAt = parseQrDate(value['expiresAt']);
    final serverTime = parseQrDate(value['serverTime']);
    if (token is! String ||
        token.isEmpty ||
        expiresAt == null ||
        (value['serverTime'] != null && serverTime == null)) {
      throw const FormatException('Invalid QR token response');
    }
    final status = switch (value['status']) {
      null when existingToken == null => QrTokenStatus.active,
      'active' => QrTokenStatus.active,
      'consumed' => QrTokenStatus.consumed,
      'expired' => QrTokenStatus.expired,
      _ => throw const FormatException('Invalid QR token status'),
    };
    return QrToken(
      value: token,
      expiresAt: expiresAt,
      serverTime: serverTime,
      status: status,
    );
  }
}
