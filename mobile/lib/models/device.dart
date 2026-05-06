import 'dart:convert';

class Device {
  final String id;
  final String name;
  final String? deviceSerial;
  final String? deviceType;
  final String? zoneName;
  final String? doorName;

  const Device({
    required this.id,
    required this.name,
    this.deviceSerial,
    this.deviceType,
    this.zoneName,
    this.doorName,
  });

  factory Device.fromConvex(Map<String, dynamic> json) {
    return Device(
      id: (json['_id'] ?? json['id']).toString(),
      name: (json['name'] as String?) ?? 'Bilinmeyen Cihaz',
      deviceSerial: json['deviceSerial'] as String?,
      deviceType: json['deviceType'] as String?,
      zoneName: json['zoneName'] as String?,
      doorName: json['doorName'] as String?,
    );
  }

  String get subtitle {
    final parts = <String>[];
    if (zoneName != null && zoneName!.isNotEmpty) parts.add(zoneName!);
    if (doorName != null && doorName!.isNotEmpty) parts.add(doorName!);
    if (parts.isEmpty && deviceSerial != null && deviceSerial!.isNotEmpty) {
      parts.add(deviceSerial!);
    }
    return parts.join(' • ');
  }

  static List<Device> listFromConvexJson(String raw) {
    final decoded = jsonDecode(raw);
    if (decoded is! List) return [];
    return decoded
        .whereType<Map<String, dynamic>>()
        .map(Device.fromConvex)
        .toList();
  }
}
