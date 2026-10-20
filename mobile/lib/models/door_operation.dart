import '../core/errors.dart';

enum DoorOperationStatus { pending, sent, confirmed, failed, unknown }

/// Allowlisted server failure reasons. Never present arbitrary server text.
enum DoorOperationFailureCode {
  commandOutcomeUnknown,
  commandExpired,
  commandFailed,
  targetNotAllowed,
  unknown;

  static DoorOperationFailureCode decode(String value) => switch (value) {
    'COMMAND_OUTCOME_UNKNOWN' => commandOutcomeUnknown,
    'COMMAND_EXPIRED' => commandExpired,
    'COMMAND_FAILED' => commandFailed,
    'TARGET_NOT_ALLOWED' => targetNotAllowed,
    _ => unknown,
  };
}

/// A command acknowledgement is never evidence of a physical passage.
class DoorOperation {
  const DoorOperation({
    required this.operationId,
    required this.status,
    required this.deviceId,
    this.doorId,
    required this.deviceName,
    required this.requestedAt,
    this.errorCode,
  });

  final String operationId;
  final DoorOperationStatus status;
  final String deviceId;
  final String? doorId;
  final String deviceName;
  final DateTime requestedAt;
  final DoorOperationFailureCode? errorCode;

  bool get isUnresolved => switch (status) {
    DoorOperationStatus.pending ||
    DoorOperationStatus.sent ||
    DoorOperationStatus.unknown => true,
    DoorOperationStatus.confirmed || DoorOperationStatus.failed => false,
  };

  /// Only unsent commands have the backend's 30 second execution deadline.
  DateTime? get pendingExpiresAt => status == DoorOperationStatus.pending
      ? requestedAt.add(const Duration(seconds: 30))
      : null;

  factory DoorOperation.fromJson(Object? json) {
    if (json is! Map<String, Object?>) throw const ProtocolError();
    final status = switch (json['status']) {
      'pending' => DoorOperationStatus.pending,
      'sent' => DoorOperationStatus.sent,
      'confirmed' => DoorOperationStatus.confirmed,
      'failed' => DoorOperationStatus.failed,
      'unknown' => DoorOperationStatus.unknown,
      _ => throw const ProtocolError(),
    };
    final deviceName = json['deviceName'];
    final timestamp = json['requestedAt'];
    final rawCode = json['errorCode'];
    if (deviceName is! String ||
        deviceName.trim().isEmpty ||
        timestamp is! String ||
        (rawCode != null && rawCode is! String)) {
      throw const ProtocolError();
    }
    // Require the canonical UTC timestamp produced by Date.toISOString().
    // DateTime.parse alone normalizes invalid calendar dates (e.g. Feb 30).
    final parsed = DateTime.tryParse(timestamp);
    if (parsed == null ||
        !parsed.isUtc ||
        parsed.toIso8601String() != timestamp ||
        parsed.millisecondsSinceEpoch < 0) {
      throw const ProtocolError();
    }
    return DoorOperation(
      operationId: doorOperationId(json['operationId']),
      status: status,
      deviceId: doorOperationId(json['deviceId']),
      doorId: json['doorId'] == null ? null : doorOperationId(json['doorId']),
      deviceName: deviceName,
      requestedAt: parsed,
      errorCode: rawCode is String
          ? DoorOperationFailureCode.decode(rawCode)
          : status == DoorOperationStatus.failed
          ? DoorOperationFailureCode.unknown
          : null,
    );
  }
}

/// Used for identifiers only, never coercing null/bool/numeric values to strings.
String doorOperationId(Object? value) {
  if (value is! String ||
      value.isEmpty ||
      value.length > 512 ||
      value.trim() != value ||
      value == 'null' ||
      RegExp(r'\s').hasMatch(value)) {
    throw const ProtocolError();
  }
  return value;
}

String doorOperationRequestId(Object? value) {
  final id = doorOperationId(value);
  if (!RegExp(r'^[A-Za-z0-9_-]{16,128}$').hasMatch(id)) {
    throw const ProtocolError();
  }
  return id;
}
