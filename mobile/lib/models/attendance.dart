import 'dart:convert';
import 'dart:convert' show utf8;
import 'dart:convert' show base64Decode;

class Attendance {
  final String id;
  final String userId;
  final String type; // 'check_in' or 'check_out'
  final DateTime timestamp;
  final String doorName;
  final DateTime? checkInTime;
  final DateTime? checkOutTime;
  final String? qrData; // QR kod verisi
  final Map<String, dynamic>? deviceInfo; // Cihaz bilgileri

  Attendance({
    required this.id,
    required this.userId,
    required this.type,
    required this.timestamp,
    required this.doorName,
    this.checkInTime,
    this.checkOutTime,
    this.qrData,
    this.deviceInfo,
  });

  // UTC tarihini Türkiye saatine çeviren yardımcı metod
  static DateTime _parseToTurkeyTime(String dateTimeString) {
    final utcDateTime = DateTime.parse(dateTimeString);
    // UTC+3 (Türkiye saati) için 3 saat ekle
    return utcDateTime.add(const Duration(hours: 3));
  }

  factory Attendance.fromJson(Map<String, dynamic> json) {
    // QR kod verisini parse et
    Map<String, dynamic>? parsedDeviceInfo;
    if (json['qr_data'] != null) {
      try {
        final decodedData = utf8.decode(base64Decode(json['qr_data']));
        final data = jsonDecode(decodedData) as Map<String, dynamic>;
        parsedDeviceInfo = {
          'device_id': data['device_id'],
          'location': data['location'],
          'device_name': data['device_name'],
          'timestamp': data['timestamp'],
          if (data.containsKey('additional_data')) 
            'additional_data': data['additional_data'],
        };
      } catch (e) {
        print('QR kod verisi parse edilemedi: $e');
      }
    }

    // Eğer QR koddan device info yoksa, door_name'den oluştur
    if (parsedDeviceInfo == null && json['door_name'] != null) {
      final doorName = json['door_name'] as String;
      // "Cihaz Adı (Konum)" formatını parse et
      if (doorName.contains('(') && doorName.contains(')')) {
        final parts = doorName.split('(');
        final deviceName = parts[0].trim();
        final location = parts[1].replaceAll(')', '').trim();
        parsedDeviceInfo = {
          'device_name': deviceName,
          'location': location,
          'source': 'door_name',
        };
      } else {
        parsedDeviceInfo = {
          'device_name': doorName,
          'location': 'Bilinmeyen Konum',
          'source': 'door_name',
        };
      }
    }

    return Attendance(
      id: json['id']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? '',
      type: json['type'] ?? 'check_in',
      timestamp: json['created_at'] != null 
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
      doorName: json['door_name'] ?? 'Bilinmeyen Kapı',
      checkInTime: json['check_in_time'] != null 
          ? DateTime.parse(json['check_in_time'])
          : null,
      checkOutTime: json['check_out_time'] != null 
          ? DateTime.parse(json['check_out_time'])
          : null,
      qrData: json['qr_data'],
      deviceInfo: parsedDeviceInfo,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'type': type,
      'created_at': timestamp.toIso8601String(),
      'door_name': doorName,
      'check_in_time': checkInTime?.toIso8601String(),
      'check_out_time': checkOutTime?.toIso8601String(),
      'qr_data': qrData,
      'device_info': deviceInfo,
    };
  }

  // Cihaz bilgilerini formatla
  String get formattedDeviceInfo {
    // Önce deviceInfo'yu kontrol et
    if (deviceInfo != null) {
      final deviceName = deviceInfo!['device_name'] ?? 'Bilinmeyen Cihaz';
      final location = deviceInfo!['location'] ?? 'Bilinmeyen Konum';
      return '$deviceName ($location)';
    }
    
    // DeviceInfo yoksa doorName'i kullan
    if (doorName.isNotEmpty && doorName != 'Bilinmeyen Kapı') {
      return doorName;
    }
    
    return 'Bilinmeyen Cihaz (Bilinmeyen Konum)';
  }

  // QR kod verisini formatla
  String get formattedQRData {
    if (qrData == null) return 'QR Kod Yok';
    
    try {
      final decodedData = utf8.decode(base64Decode(qrData!));
      final data = jsonDecode(decodedData) as Map<String, dynamic>;
      
      final deviceName = data['device_name'] ?? 'Bilinmeyen Cihaz';
      final location = data['location'] ?? 'Bilinmeyen Konum';
      final timestamp = data['timestamp'] != null 
          ? DateTime.parse(data['timestamp'])
          : null;
      
      return '$deviceName - $location${timestamp != null ? ' (${timestamp.toString()})' : ''}';
    } catch (e) {
      return 'QR Kod Formatı Geçersiz';
    }
  }
} 