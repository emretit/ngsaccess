import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ngsplusapp/config/convex_config.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/models/door_operation.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/door_operation_provider.dart';
import 'package:ngsplusapp/repositories/door_operation_repository.dart';
import 'package:ngsplusapp/services/door_operation_store.dart';

import '../auth_fakes.dart';
import '../models/door_operation_test.dart' show operationJson;

void main() {
  test(
    'real persisted intention + lost HTTP response survives provider relaunch with query only',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'door-operation-flow-',
      );
      addTearDown(() => directory.delete(recursive: true));
      final store = FileDoorOperationStore(directory: () async => directory);
      const scope = DoorOperationScope(
        userId: 'employee-a',
        projectId: 'project-a',
        deployment: 'https://example.convex.cloud',
      );
      final paths = <String>[];
      String? committedId;
      final client = HttpConvexClient(
        deploymentUrl: scope.deployment,
        maxRetries: 3,
        httpClient: MockClient((request) async {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          final args =
              (body['args'] as List<dynamic>).single as Map<String, dynamic>;
          paths.add(body['path'] as String);
          if (body['path'] == 'mobileAccess:requestOpen') {
            committedId = args['requestId'] as String;
            expect(
              (await store.read(scope))?.requestId,
              committedId,
              reason:
                  'The intention must reach real storage before any HTTP command',
            );
            throw TimeoutException('synthetic committed response loss');
          }
          expect(args['requestId'], committedId);
          return http.Response(
            jsonEncode({
              'status': 'success',
              'value': operationJson(status: 'confirmed'),
            }),
            200,
          );
        }),
      );
      addTearDown(client.close);
      await client.setAuth(token: 'synthetic-session');
      final auth = AuthProvider(
        repository: FakeAuthRepository(),
        sessionStore: FakeSessionStore(),
      );
      addTearDown(auth.dispose);
      await auth.signIn('a@example.test', 'synthetic-password');
      final first = DoorOperationProvider(
        repository: DoorOperationRepository(client),
        store: store,
      );
      await first.synchronizeSession(auth, deployment: scope.deployment);
      await first.open(deviceId: 'device-a', doorId: 'door-a');
      expect(first.error, isA<TimeoutError>());
      expect(first.requestId, committedId);
      first.dispose();
      final relaunched = DoorOperationProvider(
        repository: DoorOperationRepository(client),
        store: FileDoorOperationStore(directory: () async => directory),
      );
      addTearDown(relaunched.dispose);
      await relaunched.synchronizeSession(auth, deployment: scope.deployment);
      expect(relaunched.operation?.status, DoorOperationStatus.confirmed);
      expect(relaunched.hasUnresolvedOperation, isFalse);
      expect(paths, [
        'mobileAccess:requestOpen',
        'mobileAccess:getRequestOperation',
      ]);
      expect(await store.read(scope), isNull);
    },
  );

  test(
    'employee command has exact target/session and response loss is queried without replay',
    () async {
      final requests = <Map<String, dynamic>>[];
      final paths = <String>[];
      final client = HttpConvexClient(
        deploymentUrl: 'https://example.convex.cloud',
        maxRetries: 3,
        httpClient: MockClient((request) async {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          requests.add(body);
          paths.add(request.url.path);
          if (body['path'] == 'mobileAccess:requestOpen') {
            // The server committed, but the transport lost the response.
            throw TimeoutException('synthetic response loss');
          }
          return http.Response(
            jsonEncode({
              'status': 'success',
              'value': operationJson(status: 'confirmed'),
            }),
            200,
          );
        }),
      );
      addTearDown(client.close);
      await client.setAuth(token: 'synthetic-session');
      final repository = DoorOperationRepository(client);
      await expectLater(
        repository.requestOpen(
          requestId: '0123456789abcdef0123456789abcdef',
          deviceId: 'device-a',
          doorId: 'door-a',
        ),
        throwsA(isA<TimeoutError>()),
      );
      expect(requests, hasLength(1));
      final operation = await repository.getRequestOperation(
        requestId: '0123456789abcdef0123456789abcdef',
      );
      expect(operation?.status, DoorOperationStatus.confirmed);
      expect(paths, ['/api/mutation', '/api/query']);
      final mutationArgs =
          (requests.first['args'] as List<dynamic>).single
              as Map<String, dynamic>;
      final lookupArgs =
          (requests.last['args'] as List<dynamic>).single
              as Map<String, dynamic>;
      expect(mutationArgs, {
        'requestId': '0123456789abcdef0123456789abcdef',
        'deviceId': 'device-a',
        'doorId': 'door-a',
        'sessionToken': 'synthetic-session',
      });
      expect(lookupArgs.keys, unorderedEquals(['requestId', 'sessionToken']));
    },
  );

  test(
    'nullable request lookup is distinct from malformed or mismatched receipts',
    () async {
      Object? response;
      final client = HttpConvexClient(
        deploymentUrl: 'https://example.convex.cloud',
        maxRetries: 1,
        httpClient: MockClient(
          (_) async => http.Response(
            jsonEncode({'status': 'success', 'value': response}),
            200,
          ),
        ),
      );
      addTearDown(client.close);
      await client.setAuth(token: 'synthetic-session');
      final repository = DoorOperationRepository(client);
      expect(
        await repository.getRequestOperation(
          requestId: '0123456789abcdef0123456789abcdef',
        ),
        isNull,
      );
      await expectLater(
        repository.getOperation(operationId: 'operation-a'),
        throwsA(isA<ProtocolError>()),
      );
      response = operationJson();
      await expectLater(
        repository.requestOpen(
          requestId: '0123456789abcdef0123456789abcdef',
          deviceId: 'device-b',
        ),
        throwsA(isA<ProtocolError>()),
      );
      await expectLater(
        repository.getOperation(operationId: 'operation-b'),
        throwsA(isA<ProtocolError>()),
      );
      response = {'granted': true};
      await expectLater(
        repository.getRequestOperation(
          requestId: '0123456789abcdef0123456789abcdef',
        ),
        throwsA(isA<ProtocolError>()),
      );
    },
  );
}
