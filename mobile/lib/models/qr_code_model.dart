import 'dart:convert';

/// Only the server can turn a challenge into an operation. Device labels and
/// employee identity cards are descriptive data, never presence evidence.
sealed class QrPayload {
  const QrPayload();
}

class QrDeviceIdentity extends QrPayload {
  const QrDeviceIdentity({this.deviceId, this.deviceSerial, this.createdAt});
  final String? deviceId;
  final String? deviceSerial;
  final DateTime? createdAt;
}

class QrEmployeeIdentity extends QrPayload {
  const QrEmployeeIdentity();
}

class QrDeviceChallenge extends QrPayload {
  const QrDeviceChallenge({required this.challenge, required this.expiresAt});
  final String challenge;
  final DateTime expiresAt;
}

enum QrParseError { invalidFormat, unsupportedVersion, invalidDate, expired }

class QrInvalid extends QrPayload {
  const QrInvalid(this.reason);
  final QrParseError reason;
}

class QrPayloadParser {
  static QrPayload parse(String raw, {DateTime? now}) {
    final value = raw.trim();
    if (value.isEmpty || value.length > 16384) {
      return const QrInvalid(QrParseError.invalidFormat);
    }
    Object? decoded;
    try {
      decoded = jsonDecode(value);
    } on FormatException {
      try {
        decoded = jsonDecode(
          utf8.decode(base64Decode(base64.normalize(value))),
        );
      } on FormatException {
        // The web generator prints a plain serial. Recognize it as a label,
        // without guessing a Convex ID from the serial's prefix.
        if (RegExp(r'^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$').hasMatch(value)) {
          return QrDeviceIdentity(deviceSerial: value);
        }
        return const QrInvalid(QrParseError.invalidFormat);
      }
    }
    if (decoded is! Map<String, dynamic>) {
      return const QrInvalid(QrParseError.invalidFormat);
    }
    final version = decoded['version'];
    if (version != null && (version is! int || version != 1)) {
      return const QrInvalid(QrParseError.unsupportedVersion);
    }
    final type = decoded['type'];
    if (type == 'employee_identity' || type == 'user_qr') {
      // Never render untrusted name/email metadata as verified identity.
      return const QrEmployeeIdentity();
    }
    if (type == 'device_challenge') {
      final challenge = _string(decoded['challenge']);
      final expiresAt = parseQrDate(decoded['expiresAt']);
      if (version != 1 || challenge == null || expiresAt == null) {
        return const QrInvalid(QrParseError.invalidFormat);
      }
      if (!expiresAt.isAfter(now ?? DateTime.now())) {
        return const QrInvalid(QrParseError.expired);
      }
      return QrDeviceChallenge(challenge: challenge, expiresAt: expiresAt);
    }
    if (type != null && type != 'device_identity') {
      return const QrInvalid(QrParseError.invalidFormat);
    }
    // Unversioned deviceId/deviceSerial is the existing generator's alias.
    final id = _string(decoded['deviceId']);
    final serial = _string(decoded['deviceSerial']);
    if ((decoded['deviceId'] != null && id == null) ||
        (decoded['deviceSerial'] != null && serial == null) ||
        (id == null && serial == null)) {
      return const QrInvalid(QrParseError.invalidFormat);
    }
    final rawDate = decoded['timestamp'] ?? decoded['createdAt'];
    final date = parseQrDate(rawDate);
    if (rawDate != null &&
        (date == null ||
            date.isAfter(
              (now ?? DateTime.now()).add(const Duration(minutes: 5)),
            ))) {
      return const QrInvalid(QrParseError.invalidDate);
    }
    return QrDeviceIdentity(
      deviceId: id,
      deviceSerial: serial,
      createdAt: date,
    );
  }

  static String? _string(Object? value) =>
      value is String && value.trim().isNotEmpty && value.length <= 1024
      ? value.trim()
      : null;
}

DateTime? parseQrDate(Object? value) {
  if (value is! String) return null;
  final parts = RegExp(
    r'^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})?$',
  ).firstMatch(value);
  if (parts == null) return null;
  int number(int index) => int.tryParse(parts.group(index) ?? '') ?? -1;
  final year = number(1);
  final month = number(2);
  final day = number(3);
  if (month < 1 ||
      month > 12 ||
      day < 1 ||
      day > DateTime.utc(year, month + 1, 0).day ||
      number(4) > 23 ||
      number(5) > 59 ||
      number(6) > 59) {
    return null;
  }
  final offset = RegExp(r'[+-](\d{2}):(\d{2})$').firstMatch(value);
  if (offset != null &&
      ((int.tryParse(offset.group(1) ?? '') ?? 99) > 23 ||
          (int.tryParse(offset.group(2) ?? '') ?? 99) > 59)) {
    return null;
  }
  return DateTime.tryParse(value)?.toUtc();
}

class QRCodeModel {
  const QRCodeModel({
    required this.id,
    required this.deviceId,
    required this.deviceName,
    required this.location,
    required this.createdAt,
    required this.isActive,
    required this.qrData,
  });
  final String id;
  final String deviceId;
  final String deviceName;
  final String location;
  final DateTime createdAt;
  final bool isActive;
  final String qrData;

  factory QRCodeModel.fromConvex(Map<String, dynamic> json) {
    String text(Object? value) => value is String ? value : '';
    final createdAt = parseQrDate(json['createdAt']);
    if (createdAt == null) {
      throw const FormatException('Invalid QR creation date');
    }
    return QRCodeModel(
      id: text(json['_id']),
      deviceId: text(json['deviceId']),
      deviceName: text(json['name']),
      location: text(json['location'] ?? json['description']),
      createdAt: createdAt,
      isActive: json['isActive'] == true,
      qrData: text(json['qrData']),
    );
  }
}

class QRCodeGenerator {
  static String generateQRData({
    required String deviceId,
    required String location,
    required String deviceName,
  }) => base64Encode(
    utf8.encode(
      jsonEncode({
        'version': 1,
        'type': 'device_identity',
        'deviceId': deviceId,
        'location': location,
        'deviceName': deviceName,
        'timestamp': DateTime.now().toUtc().toIso8601String(),
      }),
    ),
  );

  /// Compatibility adapter. A descriptive label must never enter the legacy
  /// AttendanceProvider self-check-in path. New callers use [QrPayloadParser].
  static Map<String, dynamic> parseQRData(String raw) {
    final payload = QrPayloadParser.parse(raw);
    return {
      'is_valid': false,
      'error': payload is QrDeviceIdentity
          ? 'Cihaz kimlik etiketi geçiş yetkisi sağlamaz. QR\'ım sekmesini kullanın.'
          : 'Bu QR kod geçiş işlemi için kullanılamaz.',
      if (payload is QrDeviceIdentity) ...{
        'deviceId': payload.deviceId,
        'deviceSerial': payload.deviceSerial,
      },
    };
  }

  static bool isValidQRData(String raw) =>
      QrPayloadParser.parse(raw) is QrDeviceChallenge;
}
