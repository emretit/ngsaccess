import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/services/door_operation_store.dart';

const _scope = DoorOperationScope(
  userId: 'employee-a',
  projectId: 'project-a',
  deployment: 'https://example.convex.cloud',
);
const _intent = DoorOperationIntent(
  requestId: '0123456789abcdef0123456789abcdef',
  deviceId: 'device-a',
  doorId: 'door-a',
);

void main() {
  late Directory directory;
  late FileDoorOperationStore store;

  setUp(() async {
    directory = await Directory.systemTemp.createTemp('door-operation-test-');
    store = FileDoorOperationStore(directory: () async => directory);
  });
  tearDown(() async {
    await directory.delete(recursive: true);
  });

  Future<File> recordFile() async => directory
      .list(recursive: true)
      .where((entry) => entry is File && entry.path.endsWith('intent.json'))
      .cast<File>()
      .single;

  test(
    'one scoped file survives a new store instance with request and receipt together',
    () async {
      await store.write(_scope, _intent.withOperation('operation-a'));
      final reopened = FileDoorOperationStore(directory: () async => directory);
      final result = await reopened.read(_scope);
      expect(result?.requestId, _intent.requestId);
      expect(result?.deviceId, _intent.deviceId);
      expect(result?.doorId, _intent.doorId);
      expect(result?.operationId, 'operation-a');
      final file = await recordFile();
      final contents =
          jsonDecode(await file.readAsString()) as Map<String, dynamic>;
      expect(
        contents.keys,
        unorderedEquals([
          'version',
          'userId',
          'projectId',
          'deployment',
          'requestId',
          'deviceId',
          'doorId',
          'operationId',
        ]),
      );
      expect(await File('${file.path}.pending').exists(), isFalse);
    },
  );

  test(
    'user, project and deployment are separate scopes with no legacy reassignment',
    () async {
      await store.write(_scope, _intent);
      for (final scope in [
        const DoorOperationScope(
          userId: 'employee-b',
          projectId: 'project-a',
          deployment: 'https://example.convex.cloud',
        ),
        const DoorOperationScope(
          userId: 'employee-a',
          projectId: 'project-b',
          deployment: 'https://example.convex.cloud',
        ),
        const DoorOperationScope(
          userId: 'employee-a',
          projectId: 'project-a',
          deployment: 'https://other.convex.cloud',
        ),
      ]) {
        expect(await store.read(scope), isNull);
      }
      expect((await store.read(_scope))?.requestId, _intent.requestId);
    },
  );

  test(
    'truncated, wrong-scope, wrong-version and malformed files fail closed',
    () async {
      await store.write(_scope, _intent);
      final file = await recordFile();
      final valid =
          jsonDecode(await file.readAsString()) as Map<String, dynamic>;
      for (final raw in [
        '{"version":',
        jsonEncode({...valid, 'version': 2}),
        jsonEncode({...valid, 'version': 1.0}),
        jsonEncode({...valid, 'userId': 'employee-b'}),
        jsonEncode({...valid, 'projectId': 'project-b'}),
        jsonEncode({...valid, 'deployment': 'https://other.convex.cloud'}),
        jsonEncode({...valid, 'requestId': null}),
        jsonEncode({...valid, 'operationId': 12}),
      ]) {
        await file.writeAsString(raw, flush: true);
        await expectLater(store.read(_scope), throwsA(isA<ProtocolError>()));
        expect(await file.exists(), isTrue);
      }
    },
  );

  test(
    'crash before rename restores temporary intention, never silently drops it',
    () async {
      await store.write(_scope, _intent);
      final file = await recordFile();
      final temporary = File('${file.path}.pending');
      await file.rename(temporary.path);
      final reopened = FileDoorOperationStore(directory: () async => directory);
      expect((await reopened.read(_scope))?.requestId, _intent.requestId);
      await temporary.writeAsString('{', flush: true);
      await expectLater(reopened.read(_scope), throwsA(isA<ProtocolError>()));
    },
  );

  test(
    'incomplete newer file fails closed even when the previous record is valid',
    () async {
      await store.write(_scope, _intent);
      final file = await recordFile();
      await File('${file.path}.pending').writeAsString('{', flush: true);
      await expectLater(store.read(_scope), throwsA(isA<ProtocolError>()));
      await store.remove(_scope);
      expect(await store.read(_scope), isNull);
    },
  );

  test(
    'unavailable directory produces a write failure without a successful record',
    () async {
      final blocked = File('${directory.path}/not-a-directory');
      await blocked.writeAsString('synthetic fixture', flush: true);
      final broken = FileDoorOperationStore(
        directory: () async => Directory(blocked.path),
      );
      await expectLater(
        broken.write(_scope, _intent),
        throwsA(isA<FileSystemException>()),
      );
    },
  );

  test(
    'a replacement store waits for an earlier root write before deciding there is no intent',
    () async {
      final gate = Completer<Directory>();
      final started = Completer<void>();
      final oldStore = FileDoorOperationStore(
        directory: () {
          started.complete();
          return gate.future;
        },
      );
      final write = oldStore.write(_scope, _intent);
      await started.future;
      final replacement = FileDoorOperationStore(
        directory: () async => directory,
      );
      final read = replacement.read(_scope);
      gate.complete(directory);
      await write;
      expect((await read)?.requestId, _intent.requestId);
    },
  );
}
