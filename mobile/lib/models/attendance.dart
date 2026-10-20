import 'dart:convert';

import '../core/attendance_date.dart';

enum AttendanceDirection { entry, exit, unknown }

enum AttendanceDecision { granted, denied, unknown }

class Attendance {
  final String id;
  final String? employeeId;
  final String? deviceId;
  final String cardNo;
  final String? employeeName;
  final DateTime accessTime;
  final AttendanceDecision decision;
  final String? direction;
  final String? source;
  final Map<String, dynamic>? deviceInfo;

  Attendance({
    required this.id,
    required this.employeeId,
    required this.deviceId,
    required this.cardNo,
    required this.employeeName,
    required this.accessTime,
    required bool granted,
    AttendanceDecision? decision,
    this.direction,
    this.source,
    this.deviceInfo,
  }) : decision =
           decision ??
           (granted ? AttendanceDecision.granted : AttendanceDecision.denied);

  bool get granted => decision == AttendanceDecision.granted;
  bool get denied => decision == AttendanceDecision.denied;
  AttendanceDirection get movement => switch (direction) {
    'entry' => AttendanceDirection.entry,
    'exit' => AttendanceDirection.exit,
    _ => AttendanceDirection.unknown,
  };
  String get type => switch (movement) {
    AttendanceDirection.entry => 'check_in',
    AttendanceDirection.exit => 'check_out',
    AttendanceDirection.unknown => 'unknown',
  };
  DateTime get timestamp => accessTime;
  String? get userId => employeeId;
  String get doorName => _optionalString(deviceInfo?['name']) ?? '';
  bool get isEntry => movement == AttendanceDirection.entry;
  bool get isExit => movement == AttendanceDirection.exit;
  DateTime? get checkInTime => granted && isEntry ? accessTime : null;
  DateTime? get checkOutTime => granted && isExit ? accessTime : null;
  String? get qrData => cardNo.isEmpty ? null : cardNo;

  factory Attendance.fromConvex(Map<String, dynamic> json) {
    final id = _optionalString(json['_id'] ?? json['id']);
    final accessTime = parseInstant(json['accessTime']);
    if (id == null) throw const FormatException('Invalid attendance id');
    final status = _optionalString(json['accessStatus']);
    final decision = switch (status) {
      'izin_verildi' || 'granted' => AttendanceDecision.granted,
      'reddedildi' || 'denied' => AttendanceDecision.denied,
      _ => AttendanceDecision.unknown,
    };
    final rawDevice = json['device'];
    if (rawDevice != null && rawDevice is! Map<String, dynamic>) {
      throw const FormatException('Invalid attendance device');
    }
    final device = rawDevice is Map<String, dynamic> ? rawDevice : null;
    return Attendance(
      id: id,
      employeeId: _optionalString(json['employeeId']),
      deviceId: _optionalString(json['deviceId']),
      cardNo: _optionalString(json['cardNo']) ?? '',
      employeeName: _optionalString(json['employeeName']),
      accessTime: accessTime,
      granted: decision == AttendanceDecision.granted,
      decision: decision,
      direction: _optionalString(json['direction']),
      source: _optionalString(json['source']),
      deviceInfo: device == null
          ? null
          : {
              'deviceId': _optionalString(device['_id']),
              'name': _optionalString(device['name']),
              'location': _optionalString(device['description']),
              'serial': _optionalString(device['deviceSerial']),
            },
    );
  }

  static DateTime parseInstant(Object? value) {
    if (value is! String) {
      throw const FormatException('Invalid attendance timestamp');
    }
    final parts = RegExp(
      r'^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$',
    ).firstMatch(value);
    if (parts == null) {
      throw const FormatException('Invalid attendance timestamp');
    }
    AttendanceDate.parseDay(parts.group(1) ?? '');
    if (int.parse(parts.group(2) ?? '99') > 23 ||
        int.parse(parts.group(3) ?? '99') > 59 ||
        int.parse(parts.group(4) ?? '99') > 59) {
      throw const FormatException('Invalid attendance timestamp');
    }
    final zone = parts.group(5) ?? '';
    if (zone != 'Z' &&
        (int.parse(zone.substring(1, 3)) > 23 ||
            int.parse(zone.substring(4, 6)) > 59)) {
      throw const FormatException('Invalid attendance timezone');
    }
    final parsed = DateTime.tryParse(value);
    if (parsed == null) {
      throw const FormatException('Invalid attendance timestamp');
    }
    return parsed.toUtc();
  }

  static String? _optionalString(Object? value) {
    if (value == null) return null;
    if (value is! String) {
      throw const FormatException('Invalid attendance text');
    }
    return value.trim().isEmpty ? null : value;
  }

  Map<String, dynamic> toJson() => {
    '_id': id,
    'employeeId': employeeId,
    'deviceId': deviceId,
    'cardNo': cardNo,
    'employeeName': employeeName,
    'accessTime': accessTime.toUtc().toIso8601String(),
    'accessStatus': switch (decision) {
      AttendanceDecision.granted => 'izin_verildi',
      AttendanceDecision.denied => 'reddedildi',
      AttendanceDecision.unknown => null,
    },
    'direction': direction,
    'source': source,
  };
  String get formattedDeviceInfo {
    final location = _optionalString(deviceInfo?['location']);
    if (location == null) return doorName;
    return doorName.isEmpty ? location : '$doorName ($location)';
  }

  static List<Attendance> decodeList(Object? decoded) {
    if (decoded is! List) {
      throw const FormatException('Invalid attendance list');
    }
    return List.unmodifiable(
      decoded.map((row) {
        if (row is! Map<String, dynamic>) {
          throw const FormatException('Invalid attendance record');
        }
        return Attendance.fromConvex(row);
      }),
    );
  }

  static List<Attendance> listFromConvexJson(String raw) =>
      decodeList(jsonDecode(raw));
}
