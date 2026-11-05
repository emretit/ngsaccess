import 'dart:async';
import 'package:ngsplusapp/models/door_operation.dart';
import 'package:ngsplusapp/repositories/door_operation_repository.dart';
import 'package:ngsplusapp/services/door_operation_store.dart';

const scopeA = DoorOperationScope(
  userId: 'employee-a',
  projectId: 'project-a',
  deployment: 'https://example.convex.cloud',
);
const storedIntent = DoorOperationIntent(
  requestId: '0123456789abcdef0123456789abcdef',
  deviceId: 'device-a',
  doorId: 'door-a',
);

DoorOperation receipt({
  DoorOperationStatus status = DoorOperationStatus.pending,
}) => DoorOperation(
  operationId: 'operation-a',
  status: status,
  deviceId: 'device-a',
  doorId: 'door-a',
  deviceName: 'Test door',
  requestedAt: DateTime.utc(2026, 10, 19, 10),
);

class MemoryOperationStore implements DoorOperationStore {
  final records = <DoorOperationScope, DoorOperationIntent>{};
  Object? writeError;
  Object? readError;
  Object? removeError;
  Completer<void>? writeGate;
  final writeStarted = Completer<void>();
  int writes = 0;
  int removals = 0;

  @override
  Future<DoorOperationIntent?> read(DoorOperationScope scope) async {
    final failure = readError;
    if (failure != null) throw failure;
    return records[scope];
  }

  @override
  Future<void> write(
    DoorOperationScope scope,
    DoorOperationIntent intent,
  ) async {
    writes++;
    if (!writeStarted.isCompleted) writeStarted.complete();
    await writeGate?.future;
    final failure = writeError;
    if (failure != null) throw failure;
    records[scope] = intent;
  }

  @override
  Future<void> remove(DoorOperationScope scope) async {
    removals++;
    final failure = removeError;
    if (failure != null) throw failure;
    records.remove(scope);
  }
}

class FakeOperationRepository implements DoorOperationRepository {
  final requests = <DoorOperationIntent>[];
  final requestLookups = <String>[];
  final operationLookups = <String>[];
  final requestStarted = Completer<void>();
  Future<DoorOperation> Function()? onRequest;
  Future<DoorOperation?> Function()? onLookup;
  Future<DoorOperation> Function()? onOperation;

  @override
  Future<DoorOperation> requestOpen({
    required String requestId,
    required String deviceId,
    String? doorId,
  }) async {
    requests.add(
      DoorOperationIntent(
        requestId: requestId,
        deviceId: deviceId,
        doorId: doorId,
      ),
    );
    if (!requestStarted.isCompleted) requestStarted.complete();
    final callback = onRequest;
    return callback == null ? receipt() : await callback();
  }

  @override
  Future<DoorOperation?> getRequestOperation({
    required String requestId,
  }) async {
    requestLookups.add(requestId);
    final callback = onLookup;
    return callback == null ? null : await callback();
  }

  @override
  Future<DoorOperation> getOperation({required String operationId}) async {
    operationLookups.add(operationId);
    final callback = onOperation;
    return callback == null ? receipt() : await callback();
  }
}
