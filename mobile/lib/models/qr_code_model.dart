import 'dart:convert';

class QRCodeModel {
  final String id;
  final String deviceId;
  final String deviceName;
  final String location;
  final DateTime createdAt;
  final bool isActive;
  final String qrData;

  QRCodeModel({
    required this.id,
    required this.deviceId,
    required this.deviceName,
    required this.location,
    required this.createdAt,
    required this.isActive,
    required this.qrData,
  });

  factory QRCodeModel.fromConvex(Map<String, dynamic> json) {
    return QRCodeModel(
      id: (json['_id'] as String?) ?? '',
      deviceId: (json['deviceId'] as String?) ?? '',
      deviceName: (json['name'] as String?) ?? '',
      location: (json['location'] ?? json['description'] ?? '') as String,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
      isActive: (json['isActive'] ?? true) as bool,
      qrData: (json['qrData'] ?? '') as String,
    );
  }
}

class QRCodeGenerator {
  /// Üretilen QR yükü:
  /// {
  ///   "deviceId": "&lt;Convex Id&lt;devices&gt;&gt;",
  ///   "deviceName": "...",
  ///   "location": "...",
  ///   "timestamp": "ISO string"
  /// }
  static String generateQRData({
    required String deviceId,
    required String location,
    required String deviceName,
  }) {
    final data = {
      'deviceId': deviceId,
      'location': location,
      'deviceName': deviceName,
      'timestamp': DateTime.now().toIso8601String(),
    };
    return base64Encode(utf8.encode(jsonEncode(data)));
  }

  /// QR'dan parse edilen veri. Convex camelCase alan adlarını bekler.
  static Map<String, dynamic> parseQRData(String qrData) {
    Map<String, dynamic>? tryDecodeBase64() {
      try {
        final decoded = utf8.decode(base64Decode(qrData));
        final parsed = jsonDecode(decoded);
        if (parsed is Map<String, dynamic>) return parsed;
      } catch (_) {}
      return null;
    }

    Map<String, dynamic>? tryDecodeJson() {
      try {
        final parsed = jsonDecode(qrData);
        if (parsed is Map<String, dynamic>) return parsed;
      } catch (_) {}
      return null;
    }

    final data = tryDecodeBase64() ?? tryDecodeJson();
    if (data != null) {
      final deviceId = data['deviceId'] as String?;
      if (deviceId != null && deviceId.isNotEmpty) {
        if (data['timestamp'] is String) {
          try {
            final ts = DateTime.parse(data['timestamp'] as String);
            if (DateTime.now().difference(ts).inHours > 24) {
              return {'is_valid': false, 'error': 'QR kod süresi dolmuş'};
            }
          } catch (_) {}
        }
        return {
          'is_valid': true,
          'deviceId': deviceId,
          'deviceName': data['deviceName'] ?? 'Cihaz',
          'location': data['location'] ?? '',
          'timestamp': data['timestamp'],
          'token': data['token'],
        };
      }
    }

    return {
      'is_valid': false,
      'error': 'QR kod formatı tanınamadı',
    };
  }

  static bool isValidQRData(String qrData) {
    final parsed = parseQRData(qrData);
    return parsed['is_valid'] == true;
  }
}
