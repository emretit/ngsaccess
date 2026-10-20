import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

import '../core/errors.dart';
import '../models/door_operation.dart';

/// Non-secret scope; credentials and email are intentionally absent.
class DoorOperationScope {
  const DoorOperationScope({
    required this.userId,
    required this.projectId,
    required this.deployment,
  });
  final String userId;
  final String projectId;
  final String deployment;

  String get storageKey =>
      'door_operation_v1_${base64Url.encode(utf8.encode(jsonEncode([userId, projectId, deployment])))}';

  @override
  bool operator ==(Object other) =>
      other is DoorOperationScope &&
      userId == other.userId &&
      projectId == other.projectId &&
      deployment == other.deployment;

  @override
  int get hashCode => Object.hash(userId, projectId, deployment);
}

/// One atomic record holds the whole intent, including its optional receipt.
class DoorOperationIntent {
  const DoorOperationIntent({
    required this.requestId,
    required this.deviceId,
    this.doorId,
    this.operationId,
  });
  final String requestId;
  final String deviceId;
  final String? doorId;
  final String? operationId;

  DoorOperationIntent withOperation(String id) => DoorOperationIntent(
    requestId: requestId,
    deviceId: deviceId,
    doorId: doorId,
    operationId: id,
  );
}

abstract interface class DoorOperationStore {
  Future<DoorOperationIntent?> read(DoorOperationScope scope);
  Future<void> write(DoorOperationScope scope, DoorOperationIntent intent);
  Future<void> remove(DoorOperationScope scope);
}

/// A flushed file in application support, replaced with a same-directory rename.
/// The command is sent only after this write completes. This protects process
/// death/relaunch; Dart cannot fsync the parent directory against power loss.
/// A leftover temporary or corrupt record fails closed instead of losing intent.
class FileDoorOperationStore implements DoorOperationStore {
  FileDoorOperationStore({Future<Directory> Function()? directory})
    : _directory = directory ?? getApplicationSupportDirectory;
  final Future<Directory> Function() _directory;
  // Serialize even across provider/store replacements in the same isolate. A
  // new root must not observe "empty" while an old root's write is in flight.
  static Future<void> _effects = Future<void>.value();

  static Future<T> _serialize<T>(Future<T> Function() effect) {
    final result = _effects.then((_) => effect());
    _effects = result.then<void>(
      (_) {},
      onError: (Object error, StackTrace stack) {},
    );
    return result;
  }

  Future<File> _file(DoorOperationScope scope) async {
    final root = await _directory();
    // Keep individual path components below filesystem name-length limits.
    final key = scope.storageKey;
    final parts = <String>[];
    for (var offset = 0; offset < key.length; offset += 100) {
      final end = offset + 100 < key.length ? offset + 100 : key.length;
      parts.add(key.substring(offset, end));
    }
    return File(
      [
        root.path,
        'door_operations_v1',
        ...parts,
        'intent.json',
      ].join(Platform.pathSeparator),
    );
  }

  Map<String, Object?> _record(
    DoorOperationScope scope,
    DoorOperationIntent intent,
  ) => {
    'version': 1,
    'userId': scope.userId,
    'projectId': scope.projectId,
    'deployment': scope.deployment,
    'requestId': doorOperationRequestId(intent.requestId),
    'deviceId': doorOperationId(intent.deviceId),
    if (intent.doorId != null) 'doorId': doorOperationId(intent.doorId),
    if (intent.operationId != null)
      'operationId': doorOperationId(intent.operationId),
  };

  @override
  Future<DoorOperationIntent?> read(DoorOperationScope scope) =>
      _serialize(() => _read(scope));

  Future<DoorOperationIntent?> _read(DoorOperationScope scope) async {
    final file = await _file(scope);
    final temporary = File('${file.path}.pending');
    // A crash before rename may leave a partial write. Never treat it as empty.
    // If both exist, the temporary one is the newer attempted state.
    final source = await temporary.exists() ? temporary : file;
    if (!await source.exists()) return null;
    final raw = await source.readAsString();
    try {
      final Object? record = jsonDecode(raw);
      if (record is! Map<String, Object?> ||
          record['version'] is! int ||
          record['version'] != 1 ||
          record['userId'] != scope.userId ||
          record['projectId'] != scope.projectId ||
          record['deployment'] != scope.deployment) {
        throw const ProtocolError();
      }
      return DoorOperationIntent(
        requestId: doorOperationRequestId(record['requestId']),
        deviceId: doorOperationId(record['deviceId']),
        doorId: record['doorId'] == null
            ? null
            : doorOperationId(record['doorId']),
        operationId: record['operationId'] == null
            ? null
            : doorOperationId(record['operationId']),
      );
    } on FormatException {
      throw const ProtocolError();
    }
  }

  @override
  Future<void> write(DoorOperationScope scope, DoorOperationIntent intent) =>
      _serialize(() => _write(scope, intent));

  Future<void> _write(
    DoorOperationScope scope,
    DoorOperationIntent intent,
  ) async {
    final file = await _file(scope);
    await file.parent.create(recursive: true);
    final temporary = File('${file.path}.pending');
    final raw = jsonEncode(_record(scope, intent));
    await temporary.writeAsString(raw, flush: true);
    await temporary.rename(file.path);
    if (await file.readAsString() != raw) {
      throw StateError('Operation storage verification failed');
    }
  }

  @override
  Future<void> remove(DoorOperationScope scope) =>
      _serialize(() => _remove(scope));

  Future<void> _remove(DoorOperationScope scope) async {
    final file = await _file(scope);
    final temporary = File('${file.path}.pending');
    if (await temporary.exists()) await temporary.delete();
    if (await file.exists()) await file.delete();
  }
}
