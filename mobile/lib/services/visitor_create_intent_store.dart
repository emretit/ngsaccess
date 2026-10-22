import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// Identifiers only: no token, visitor contact details, or form payload.
class VisitorCreateScope {
  const VisitorCreateScope({
    required this.employeeId,
    required this.projectId,
    required this.deployment,
  });

  final String employeeId, projectId, deployment;

  String get storageKey => base64Url.encode(
    utf8.encode(jsonEncode([employeeId, projectId, deployment])),
  );

  @override
  bool operator ==(Object other) =>
      other is VisitorCreateScope &&
      employeeId == other.employeeId &&
      projectId == other.projectId &&
      deployment == other.deployment;

  @override
  int get hashCode => Object.hash(employeeId, projectId, deployment);
}

abstract interface class VisitorCreateIntentStore {
  Future<String?> read(VisitorCreateScope scope);

  /// Atomically preserves an existing unresolved request instead of replacing it.
  Future<String> claim(VisitorCreateScope scope, String requestId);

  /// Only a confirmed receipt/success may remove its matching intent.
  Future<void> remove(VisitorCreateScope scope, String requestId);
}

class FileVisitorCreateIntentStore implements VisitorCreateIntentStore {
  FileVisitorCreateIntentStore({Future<Directory> Function()? directory})
    : _directory = directory ?? getApplicationSupportDirectory;

  final Future<Directory> Function() _directory;
  static Future<void> _effects = Future<void>.value();

  static Future<T> _serialize<T>(Future<T> Function() effect) {
    final result = _effects.then((_) => effect());
    _effects = result.then<void>((_) {}, onError: (Object e, StackTrace s) {});
    return result;
  }

  String _validate(String requestId) {
    if (!RegExp(
      r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
      caseSensitive: false,
    ).hasMatch(requestId)) {
      throw const FormatException('Invalid visitor request intent');
    }
    return requestId;
  }

  Future<File> _file(VisitorCreateScope scope) async {
    if (scope.employeeId.isEmpty ||
        scope.projectId.isEmpty ||
        scope.deployment.isEmpty) {
      throw const FormatException('Missing visitor request scope');
    }
    final root = await _directory();
    final key = scope.storageKey;
    final parts = <String>[];
    for (var offset = 0; offset < key.length; offset += 100) {
      parts.add(
        key.substring(
          offset,
          offset + 100 < key.length ? offset + 100 : key.length,
        ),
      );
    }
    return File(
      [
        root.path,
        'visitor_create_v1',
        ...parts,
        'intent.json',
      ].join(Platform.pathSeparator),
    );
  }

  Future<String?> _read(VisitorCreateScope scope) async {
    final file = await _file(scope);
    final temporary = File('${file.path}.pending');
    // A crash before rename leaves an unresolved intent, never an empty slot.
    final source = await temporary.exists() ? temporary : file;
    if (!await source.exists()) return null;
    final Object? value = jsonDecode(await source.readAsString());
    if (value is! Map<String, Object?> ||
        value['version'] != 1 ||
        value['employeeId'] != scope.employeeId ||
        value['projectId'] != scope.projectId ||
        value['deployment'] != scope.deployment ||
        value['requestId'] is! String) {
      throw const FormatException('Invalid visitor request scope');
    }
    return _validate(value['requestId'] as String);
  }

  @override
  Future<String?> read(VisitorCreateScope scope) =>
      _serialize(() => _read(scope));

  @override
  Future<String> claim(VisitorCreateScope scope, String requestId) =>
      _serialize(() async {
        final existing = await _read(scope);
        if (existing != null) return existing;
        final file = await _file(scope);
        await file.parent.create(recursive: true);
        final temporary = File('${file.path}.pending');
        final raw = jsonEncode({
          'version': 1,
          'employeeId': scope.employeeId,
          'projectId': scope.projectId,
          'deployment': scope.deployment,
          'requestId': _validate(requestId),
        });
        await temporary.writeAsString(raw, flush: true);
        await temporary.rename(file.path);
        if (await file.readAsString() != raw) {
          throw StateError('Visitor intent storage verification failed');
        }
        return requestId;
      });

  @override
  Future<void> remove(VisitorCreateScope scope, String requestId) =>
      _serialize(() async {
        if (await _read(scope) != requestId) return;
        final file = await _file(scope);
        final temporary = File('${file.path}.pending');
        if (await temporary.exists()) await temporary.delete();
        if (await file.exists()) await file.delete();
      });
}
