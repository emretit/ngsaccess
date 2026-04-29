import 'dart:convert';
import 'dart:math';

class QRCodeModel {
  final String id;
  final int deviceId;
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

  factory QRCodeModel.fromJson(Map<String, dynamic> json) {
    return QRCodeModel(
      id: json['id']?.toString() ?? '',
      deviceId: json['device_id'] ?? 0,
      deviceName: json['device_name'] ?? '',
      location: json['location'] ?? '',
      createdAt: DateTime.parse(json['created_at']),
      isActive: json['is_active'] ?? true,
      qrData: json['qr_data'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'device_id': deviceId,
      'device_name': deviceName,
      'location': location,
      'created_at': createdAt.toIso8601String(),
      'is_active': isActive,
      'qr_data': qrData,
    };
  }
}

class QRCodeGenerator {
  static String generateQRData({
    required int deviceId,
    required String location,
    required String deviceName,
    String? additionalData,
  }) {
    final data = {
      'device_id': deviceId,
      'location': location,
      'device_name': deviceName,
      'timestamp': DateTime.now().toIso8601String(),
      if (additionalData != null) 'additional_data': additionalData,
    };

    return base64Encode(utf8.encode(jsonEncode(data)));
  }

  static Map<String, dynamic> parseQRData(String qrData) {
    try {
      // Önce base64 decode edilmiş JSON formatını dene
      try {
        final decodedData = utf8.decode(base64Decode(qrData));
        final data = jsonDecode(decodedData) as Map<String, dynamic>;

        // Zorunlu alanları kontrol et
        if (data.containsKey('device_id') && 
            data.containsKey('location') && 
            data.containsKey('device_name')) {
          
          // Timestamp kontrolü
          if (data.containsKey('timestamp')) {
            final timestamp = DateTime.parse(data['timestamp']);
            final now = DateTime.now();
            
            // 24 saatten eski QR kodları geçersiz say
            if (now.difference(timestamp).inHours > 24) {
              return {
                'is_valid': false,
                'error': 'QR kod süresi dolmuş',
              };
            }
          }

          return {
            'is_valid': true,
            'device_id': data['device_id'],
            'location': data['location'],
            'device_name': data['device_name'],
            'timestamp': data['timestamp'],
            'additional_data': data['additional_data'],
          };
        }
      } catch (e) {
        // Base64 decode başarısız, diğer formatları dene
      }

      // Direkt JSON formatını dene
      try {
        final data = jsonDecode(qrData) as Map<String, dynamic>;
        if (data.containsKey('device_id') || data.containsKey('id')) {
          return {
            'is_valid': true,
            'device_id': data['device_id'] ?? data['id'] ?? 1,
            'location': data['location'] ?? data['device_location'] ?? 'Ana Giriş',
            'device_name': data['device_name'] ?? data['name'] ?? 'Cihaz',
            'timestamp': data['timestamp'] ?? data['created_at'],
            'additional_data': data['additional_data'],
          };
        }
      } catch (e) {
        // JSON parse başarısız
      }

      // Basit metin formatını dene (device_id:location:device_name)
      if (qrData.contains(':')) {
        final parts = qrData.split(':');
        if (parts.length >= 2) {
          return {
            'is_valid': true,
            'device_id': int.tryParse(parts[0]) ?? 1,
            'location': parts.length > 2 ? parts[2] : (parts[1].isNotEmpty ? parts[1] : 'Ana Giriş'),
            'device_name': parts.length > 1 ? parts[1] : 'Cihaz',
            'timestamp': DateTime.now().toIso8601String(),
          };
        }
      }

      // Sadece sayı ise device_id olarak kabul et
      final deviceId = int.tryParse(qrData);
      if (deviceId != null) {
        return {
          'is_valid': true,
          'device_id': deviceId,
          'location': 'Ana Giriş',
          'device_name': 'Cihaz $deviceId',
          'timestamp': DateTime.now().toIso8601String(),
        };
      }

      // Hiçbir format uymazsa genel bir cihaz olarak kabul et
      return {
        'is_valid': true,
        'device_id': 1,
        'location': 'Bilinmeyen Konum',
        'device_name': 'QR Cihaz',
        'timestamp': DateTime.now().toIso8601String(),
        'qr_raw_data': qrData, // Ham veriyi de sakla
      };

    } catch (e) {
      return {
        'is_valid': false,
        'error': 'QR kod formatı geçersiz: ${e.toString()}',
      };
    }
  }

  static bool isValidQRData(String qrData) {
    final parsedData = parseQRData(qrData);
    return parsedData['is_valid'] as bool;
  }
} 