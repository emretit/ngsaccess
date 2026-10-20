import 'dart:convert';

class Device {
  final String id;
  final String? name;
  final String? deviceSerial;
  final String? deviceType;
  final String? zoneName;
  final String? doorName;
  final String? doorId;
  final String? targetId;
  final String? transport;
  final bool? canOpen;
  final String? reason;
  final bool? supportsReaderToken;
  final int? actuator;

  const Device({
    required this.id,
    required this.name,
    this.deviceSerial,
    this.deviceType,
    this.zoneName,
    this.doorName,
    this.doorId,
    this.targetId,
    this.transport,
    this.canOpen,
    this.reason,
    this.supportsReaderToken,
    this.actuator,
  });

  factory Device.fromConvex(Map<String, Object?> json) {
    final id = json['_id'] ?? json['id'] ?? json['deviceId'];
    if (id is! String || id.isEmpty || id.trim() != id || id == 'null') {
      throw const FormatException('Invalid device identity');
    }
    final alternateId = json['deviceId'];
    if (alternateId != null && alternateId != id) {
      throw const FormatException('Inconsistent device identity');
    }
    final actuator = json['actuator'];
    if (actuator != null && (actuator is! int || actuator < 0)) {
      throw const FormatException('Invalid actuator');
    }
    return Device(
      id: id,
      name: _optionalString(json, 'name'),
      deviceSerial: _optionalString(json, 'deviceSerial'),
      deviceType: _optionalString(json, 'deviceType'),
      zoneName: _optionalString(json, 'zoneName'),
      doorName: _optionalString(json, 'doorName'),
      doorId: _optionalId(json, 'doorId'),
      targetId: _optionalId(json, 'targetId'),
      transport: _optionalString(json, 'transport'),
      canOpen: _optionalBool(json, 'canOpen'),
      reason: _optionalString(json, 'reason'),
      supportsReaderToken: _optionalBool(json, 'supportsReaderToken'),
      actuator: actuator is int ? actuator : null,
    );
  }

  static String? _optionalId(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value == null) return null;
    if (value is! String ||
        value.isEmpty ||
        value.trim() != value ||
        value == 'null') {
      throw const FormatException('Invalid target identity');
    }
    return value;
  }

  static bool? _optionalBool(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value == null) return null;
    if (value is! bool) {
      throw const FormatException('Invalid target capability');
    }
    return value;
  }

  static String? _optionalString(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value == null) return null;
    if (value is! String) throw const FormatException('Invalid device label');
    return value.trim().isEmpty ? null : value;
  }

  String get subtitle {
    final parts = [
      if (doorName != null && name != doorName) name,
      zoneName,
    ].whereType<String>().toSet().toList();
    final serial = deviceSerial;
    if (parts.isEmpty && serial != null) parts.add(serial);
    return parts.join(' • ');
  }

  static List<Device> listFromConvexJson(
    String raw, {
    bool requireTargetMetadata = false,
  }) {
    final Object? decoded = jsonDecode(raw);
    if (decoded is! List) throw const FormatException('Invalid device list');
    final devices = <Device>[];
    final ids = <String>{};
    for (final item in decoded) {
      if (item is! Map<String, Object?>) {
        throw const FormatException('Invalid device record');
      }
      final device = Device.fromConvex(item);
      if (requireTargetMetadata &&
          (device.targetId == null ||
              device.canOpen == null ||
              device.transport == null ||
              device.supportsReaderToken == null ||
              !item.containsKey('actuator'))) {
        throw const FormatException('Missing target metadata');
      }
      final actuator = device.actuator;
      if (requireTargetMetadata &&
          device.canOpen == true &&
          (actuator == null ||
              actuator < 0 ||
              device.transport == 'unsupported' ||
              (device.transport != 'ide_mqtt' && actuator == 0))) {
        throw const FormatException('Openable target missing actual actuator');
      }
      if (requireTargetMetadata &&
          (device.targetId == 'null' ||
              !const [
                'ide_mqtt',
                'hik_local_bridge',
                'hik_gateway',
                'unsupported',
              ].contains(device.transport))) {
        throw const FormatException('Invalid target metadata');
      }
      if (!ids.add(device.targetId ?? device.id)) {
        throw const FormatException('Duplicate target');
      }
      devices.add(device);
    }
    return List.unmodifiable(devices);
  }
}
