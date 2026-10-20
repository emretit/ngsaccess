import 'dart:convert';

import '../config/convex_config.dart';
import '../core/errors.dart';
import '../models/door_operation.dart';

/// Employee identity comes exclusively from the injected client's session.
class DoorOperationRepository {
  DoorOperationRepository(this._client);
  final HttpConvexClient _client;

  DoorOperation? _decode(String raw, {bool nullable = false}) {
    try {
      final Object? value = jsonDecode(raw);
      if (value == null && nullable) return null;
      return DoorOperation.fromJson(value);
    } on FormatException {
      throw const ProtocolError();
    }
  }

  Future<DoorOperation> requestOpen({
    required String requestId,
    required String deviceId,
    String? doorId,
  }) async {
    final raw = await _client.employeeMutation(
      name: 'mobileAccess:requestOpen',
      args: {
        'requestId': doorOperationRequestId(requestId),
        'deviceId': doorOperationId(deviceId),
        if (doorId != null) 'doorId': doorOperationId(doorId),
      },
      retry: false,
    );
    final operation = _decode(raw);
    if (operation == null ||
        operation.deviceId != deviceId ||
        operation.doorId != doorId) {
      throw const ProtocolError();
    }
    return operation;
  }

  Future<DoorOperation> getOperation({required String operationId}) async {
    final raw = await _client.employeeQuery('mobileAccess:getOperation', {
      'operationId': doorOperationId(operationId),
    });
    final operation = _decode(raw);
    if (operation == null || operation.operationId != operationId) {
      throw const ProtocolError();
    }
    return operation;
  }

  /// A null result is absence of a known operation, never permission to resend.
  Future<DoorOperation?> getRequestOperation({
    required String requestId,
  }) async {
    final raw = await _client.employeeQuery(
      'mobileAccess:getRequestOperation',
      {'requestId': doorOperationRequestId(requestId)},
    );
    return _decode(raw, nullable: true);
  }
}
