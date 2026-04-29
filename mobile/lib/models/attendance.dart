import 'dart:convert';

class Attendance {
  final String id;
  final String? employeeId;
  final String? deviceId;
  final String cardNo;
  final String? employeeName;
  final DateTime accessTime;
  final bool granted;
  final Map<String, dynamic>? deviceInfo;

  Attendance({
    required this.id,
    required this.employeeId,
    required this.deviceId,
    required this.cardNo,
    required this.employeeName,
    required this.accessTime,
    required this.granted,
    this.deviceInfo,
  });

  String get type => 'check_in';
  DateTime get timestamp => accessTime;
  String? get userId => employeeId;
  String get doorName => deviceInfo?['name'] as String? ?? 'Bilinmeyen Cihaz';
  DateTime? get checkInTime => accessTime;
  DateTime? get checkOutTime => null;
  String? get qrData => cardNo.isEmpty ? null : cardNo;

  factory Attendance.fromConvex(Map<String, dynamic> json) {
    final accessStatus = json['accessStatus'] as String?;
    final device = json['device'] as Map<String, dynamic>?;
    Map<String, dynamic>? deviceInfo;
    if (device != null) {
      deviceInfo = {
        'deviceId': device['_id'],
        'name': device['name'],
        'location': device['description'] ?? '',
        'serial': device['deviceSerial'],
      };
    }

    return Attendance(
      id: (json['_id'] ?? json['id'])?.toString() ?? '',
      employeeId: json['employeeId']?.toString(),
      deviceId: json['deviceId']?.toString(),
      cardNo: (json['cardNo'] as String?) ?? '',
      employeeName: json['employeeName'] as String?,
      accessTime: DateTime.parse(json['accessTime'] as String),
      granted: accessStatus == 'izin_verildi',
      deviceInfo: deviceInfo,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'employeeId': employeeId,
      'deviceId': deviceId,
      'cardNo': cardNo,
      'employeeName': employeeName,
      'accessTime': accessTime.toIso8601String(),
      'accessStatus': granted ? 'izin_verildi' : 'reddedildi',
    };
  }

  String get formattedDeviceInfo {
    if (deviceInfo != null) {
      final deviceName = deviceInfo!['name'] ?? 'Bilinmeyen Cihaz';
      final location = deviceInfo!['location'];
      if (location != null && (location as String).isNotEmpty) {
        return '$deviceName ($location)';
      }
      return deviceName;
    }
    return 'Bilinmeyen Cihaz';
  }

  static List<Attendance> listFromConvexJson(String raw) {
    final decoded = jsonDecode(raw);
    if (decoded is! List) return [];
    return decoded
        .whereType<Map<String, dynamic>>()
        .map(Attendance.fromConvex)
        .toList();
  }
}
