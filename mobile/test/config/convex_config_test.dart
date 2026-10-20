import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ngsplusapp/config/convex_config.dart';
import 'package:ngsplusapp/core/errors.dart';

void main() {
  transportRegressions();
  testWidgets(
    'polling yanıt tamamlanmadan yeni istek başlatmaz ve iptal edilir',
    (tester) async {
      var requestCount = 0;
      var inFlight = 0;
      var maxInFlight = 0;
      var updates = 0;

      final client = HttpConvexClient(
        deploymentUrl: 'https://example.convex.cloud',
        maxRetries: 1,
        httpClient: MockClient((_) async {
          requestCount++;
          inFlight++;
          if (inFlight > maxInFlight) maxInFlight = inFlight;
          await Future<void>.delayed(const Duration(milliseconds: 25));
          inFlight--;
          return http.Response(
            jsonEncode({'status': 'success', 'value': <Object>[]}),
            200,
          );
        }),
      );
      addTearDown(client.close);
      await client.setAuth(token: 'test-token');

      final pendingHandle = client.subscribeEmployeeQuery(
        name: 'cardReadings:listForEmployee',
        args: const {'limit': 50},
        pollingInterval: const Duration(milliseconds: 10),
        maxPollingInterval: const Duration(milliseconds: 10),
        onUpdate: (_) => updates++,
        onError: (error) => fail(error.toString()),
      );

      await tester.pump();
      expect(requestCount, 1);
      await tester.pump(const Duration(milliseconds: 25));
      final handle = await pendingHandle;
      expect(updates, 1);
      await tester.pump(const Duration(milliseconds: 10));
      expect(requestCount, 2);
      await tester.pump(const Duration(milliseconds: 20));
      expect(inFlight, 1);
      expect(requestCount, 2);
      handle.cancel();
      final requestsAtCancellation = requestCount;
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));

      expect(requestCount, requestsAtCancellation);
      expect(maxInFlight, 1);
      expect(updates, 1);
    },
  );

  test('oturum hatasından sonra polling yeniden zamanlanmaz', () async {
    var requestCount = 0;
    final errors = <AppError>[];
    final client = HttpConvexClient(
      deploymentUrl: 'https://example.convex.cloud',
      maxRetries: 1,
      httpClient: MockClient((_) async {
        requestCount++;
        return http.Response('', 401);
      }),
    );
    await client.setAuth(token: 'expired-token');

    final handle = await client.subscribeEmployeeQuery(
      name: 'cardReadings:listForEmployee',
      args: const {'limit': 50},
      pollingInterval: const Duration(milliseconds: 5),
      maxPollingInterval: const Duration(milliseconds: 10),
      onUpdate: (_) => fail('expired session must not update'),
      onError: errors.add,
    );

    await Future<void>.delayed(const Duration(milliseconds: 30));
    handle.cancel();

    expect(requestCount, 1);
    expect(errors, hasLength(1));
    expect(errors.single, isA<AuthExpiredError>());
  });
}

void transportRegressions() {
  String success(Object? value) =>
      jsonEncode({'status': 'success', 'value': value});
  String failure(String code) => jsonEncode({
    'status': 'error',
    'errorMessage': 'Server Error',
    'errorData': {'code': code, 'message': 'secret-marker'},
  });

  group('configuration', () {
    for (final value in [
      '',
      ' ',
      'invalid',
      'http://example.convex.cloud',
      'https://user:secret@example.convex.cloud',
      'https://example.convex.cloud/path',
      'https://example..cloud',
      'https://example.cloud:bad',
      'https://example.cloud:70000',
      'https://example.convex.cloud?token=secret',
      'https://example.convex.cloud#secret',
    ]) {
      test('rejects invalid target without HTTP: $value', () {
        var requests = 0;
        expect(
          () => HttpConvexClient(
            deploymentUrl: value,
            httpClient: MockClient((_) async {
              requests++;
              return http.Response(success(null), 200);
            }),
          ),
          throwsA(isA<ConfigurationError>()),
        );
        expect(requests, 0);
      });
    }
    test('release ignores env and requires explicit compile target', () {
      expect(
        () => ConvexConfig.resolveDeploymentUrl(
          definedUrl: '',
          environment: {'CONVEX_URL': 'https://dev.example.test'},
          releaseMode: true,
        ),
        throwsA(isA<ConfigurationError>()),
      );
      expect(
        ConvexConfig.resolveDeploymentUrl(
          definedUrl: 'https://release.example.test/',
          environment: {'CONVEX_URL': 'https://dev.example.test'},
          releaseMode: true,
          appEnvironment: 'production',
          allowedHost: 'release.example.test',
        ),
        'https://release.example.test',
      );
      expect(
        ConvexConfig.resolveDeploymentUrl(
          definedUrl: '',
          environment: {'CONVEX_URL': 'https://dev.example.test/'},
          releaseMode: false,
        ),
        'https://dev.example.test',
      );
    });
    test('release requires environment and exact approved host', () {
      for (final (environment, host) in [
        ('', 'release.example.test'),
        ('development', 'release.example.test'),
        ('production', ''),
        ('staging', 'wrong.example.test'),
      ]) {
        expect(
          () => ConvexConfig.resolveDeploymentUrl(
            definedUrl: 'https://release.example.test',
            environment: {},
            releaseMode: true,
            appEnvironment: environment,
            allowedHost: host,
          ),
          throwsA(isA<ConfigurationError>()),
        );
      }
    });
    test('explicit but invalid define never falls back to debug env', () {
      expect(
        () => ConvexConfig.resolveDeploymentUrl(
          definedUrl: ' ',
          environment: {'CONVEX_URL': 'https://dev.example.test'},
          releaseMode: false,
        ),
        throwsA(isA<ConfigurationError>()),
      );
    });
  });

  test(
    '560 expires session exactly once with no retry, even for concurrent calls',
    () async {
      var requests = 0;
      var expiries = 0;
      final client = HttpConvexClient(
        deploymentUrl: 'https://example.convex.cloud',
        httpClient: MockClient((_) async {
          requests++;
          return http.Response(failure('SESSION_EXPIRED'), 560);
        }),
      );
      addTearDown(client.close);
      await client.setAuth(token: 'synthetic-token');
      client.setOnAuthExpired(() {
        expiries++;
      });
      await Future.wait([
        expectLater(
          client.employeeQuery('employee:me', {}),
          throwsA(isA<AuthExpiredError>()),
        ),
        expectLater(
          client.employeeQuery('employee:me', {}),
          throwsA(isA<AuthExpiredError>()),
        ),
      ]);
      expect(requests, 2);
      expect(expiries, 1);
    },
  );

  for (final status in [200, 560]) {
    test(
      '$status schedule denial preserves session and makes one HTTP attempt',
      () async {
        var requests = 0;
        var expiries = 0;
        final client = HttpConvexClient(
          deploymentUrl: 'https://example.convex.cloud',
          httpClient: MockClient((_) async {
            requests++;
            return http.Response(failure('SCHEDULE_DENIED'), status);
          }),
        );
        addTearDown(client.close);
        await client.setAuth(token: 'synthetic-token');
        client.setOnAuthExpired(() {
          expiries++;
        });
        await expectLater(
          client.employeeQuery('employee:target', {}),
          throwsA(
            isA<BusinessError>()
                .having((error) => error.safeCode, 'reason', 'SCHEDULE_DENIED')
                .having((error) => error.isAccessDenied, 'denial', isTrue),
          ),
        );
        expect(requests, 1);
        expect(expiries, 0);
        expect(client.sessionToken, 'synthetic-token');
      },
    );

    test('$status business UDF error has no retry or auth callback', () async {
      var requests = 0;
      final client = HttpConvexClient(
        deploymentUrl: 'https://example.convex.cloud',
        httpClient: MockClient((_) async {
          requests++;
          return http.Response(failure('INVALID_CREDENTIALS'), status);
        }),
      );
      addTearDown(client.close);
      client.setOnAuthExpired(() => fail('business error cannot expire auth'));
      await expectLater(
        client.query('employee:public', {}),
        throwsA(isA<BusinessError>()),
      );
      expect(requests, 1);
    });
  }

  test(
    '503 queries retry only to bound; mutation and action default to one attempt',
    () async {
      final requests = <String, int>{};
      final client = HttpConvexClient(
        deploymentUrl: 'https://example.convex.cloud',
        maxRetries: 2,
        httpClient: MockClient((request) async {
          requests.update(request.url.path, (n) => n + 1, ifAbsent: () => 1);
          return http.Response('secret-marker', 503);
        }),
      );
      addTearDown(client.close);
      await expectLater(
        client.query('example:query', {}),
        throwsA(isA<ServerError>()),
      );
      await expectLater(
        client.mutation(name: 'example:write', args: {}),
        throwsA(isA<ServerError>()),
      );
      await expectLater(
        client.action(name: 'example:action', args: {}),
        throwsA(isA<ServerError>()),
      );
      expect(requests, {'/api/query': 2, '/api/mutation': 1, '/api/action': 1});
    },
  );

  for (final status in [401, 403, 429]) {
    test(
      '$status is not retried and 403/429 do not expire a session',
      () async {
        var requests = 0;
        var expired = false;
        final client = HttpConvexClient(
          deploymentUrl: 'https://example.convex.cloud',
          httpClient: MockClient((_) async {
            requests++;
            return http.Response('secret-marker', status);
          }),
        );
        addTearDown(client.close);
        await client.setAuth(token: 'synthetic-token');
        client.setOnAuthExpired(() {
          expired = true;
        });
        await expectLater(
          client.employeeQuery('employee:me', {}),
          throwsA(isA<AppError>()),
        );
        expect(requests, 1);
        expect(expired, status == 401);
      },
    );
  }

  test(
    'employeeAction injects original token and preserves explicit null arguments',
    () async {
      final client = HttpConvexClient(
        deploymentUrl: 'https://example.convex.cloud/',
        httpClient: MockClient((request) async {
          expect(
            request.url.toString(),
            'https://example.convex.cloud/api/action',
          );
          final envelope = jsonDecode(request.body) as Map<String, dynamic>;
          final args = (envelope['args'] as List).single as Map;
          expect(args['sessionToken'], 'current-token');
          expect(args.containsKey('clearValue'), isTrue);
          expect(args['clearValue'], isNull);
          return http.Response(success({'result': null}), 200);
        }),
      );
      addTearDown(client.close);
      await client.setAuth(token: 'current-token');
      final result = await client.employeeAction(
        name: 'employee:operation',
        args: {'sessionToken': 'forged-token', 'clearValue': null},
      );
      expect(jsonDecode(result), {'result': null});
    },
  );

  for (final lateStatus in [200, 401, 560]) {
    test(
      'late A response ($lateStatus) cannot expire B session or return A data',
      () async {
        final pending = Completer<http.Response>();
        final started = Completer<void>();
        final client = HttpConvexClient(
          deploymentUrl: 'https://example.convex.cloud',
          httpClient: MockClient((_) {
            started.complete();
            return pending.future;
          }),
        );
        addTearDown(client.close);
        await client.setAuth(token: 'token-A');
        var expired = false;
        client.setOnAuthExpired(() {
          expired = true;
        });
        final request = client.employeeQuery('employee:me', {});
        final checked = expectLater(
          request,
          throwsA(
            isA<BusinessError>().having(
              (e) => e.safeCode,
              'code',
              'SESSION_CHANGED',
            ),
          ),
        );
        await started.future;
        await client.clearAuth();
        await client.setAuth(token: 'token-B');
        pending.complete(
          http.Response(
            lateStatus == 200
                ? success({'person': 'A'})
                : failure('SESSION_EXPIRED'),
            lateStatus,
          ),
        );
        await checked;
        expect(expired, isFalse);
        expect(client.sessionToken, 'token-B');
      },
    );
  }

  test(
    'same token reinstalled is a new generation; old expiry is discarded',
    () async {
      final pending = Completer<http.Response>();
      final started = Completer<void>();
      var expired = false;
      final client = HttpConvexClient(
        deploymentUrl: 'https://example.convex.cloud',
        httpClient: MockClient((_) {
          started.complete();
          return pending.future;
        }),
      );
      addTearDown(client.close);
      await client.setAuth(token: 'same-synthetic-token');
      client.setOnAuthExpired(() {
        expired = true;
      });
      final checked = expectLater(
        client.employeeQuery('employee:me', {}),
        throwsA(
          isA<BusinessError>().having(
            (e) => e.safeCode,
            'code',
            'SESSION_CHANGED',
          ),
        ),
      );
      await started.future;
      await client.clearAuth();
      await client.setAuth(token: 'same-synthetic-token');
      pending.complete(http.Response(failure('SESSION_EXPIRED'), 560));
      await checked;
      expect(expired, isFalse);
      expect(client.sessionToken, 'same-synthetic-token');
    },
  );

  test(
    'close cancels polling and clears callback even with a request in flight',
    () async {
      final pending = Completer<http.Response>();
      final started = Completer<void>();
      var updates = 0;
      var errors = 0;
      final client = HttpConvexClient(
        deploymentUrl: 'https://example.convex.cloud',
        httpClient: MockClient((_) {
          started.complete();
          return pending.future;
        }),
      );
      await client.setAuth(token: 'synthetic-token');
      client.setOnAuthExpired(() => fail('closed callback'));
      final subscription = client.subscribeEmployeeQuery(
        name: 'employee:me',
        args: {},
        onUpdate: (_) {
          updates++;
        },
        onError: (_) {
          errors++;
        },
      );
      await started.future;
      client.close();
      client.close();
      pending.complete(http.Response(failure('SESSION_EXPIRED'), 560));
      (await subscription).cancel();
      expect(updates, 0);
      expect(errors, 0);
      expect(client.sessionToken, isNull);
      await expectLater(
        client.query('employee:me', {}),
        throwsA(isA<BusinessError>()),
      );
    },
  );

  test('old callback owner cannot clear its replacement', () async {
    var newCalled = false;
    void oldCallback() => fail('old callback');
    final client = HttpConvexClient(
      deploymentUrl: 'https://example.convex.cloud',
      httpClient: MockClient((_) async => http.Response('', 401)),
    );
    addTearDown(client.close);
    await client.setAuth(token: 'synthetic-token');
    client.setOnAuthExpired(oldCallback);
    client.setOnAuthExpired(() {
      newCalled = true;
    });
    client.clearOnAuthExpired(oldCallback);
    await expectLater(
      client.employeeQuery('employee:me', {}),
      throwsA(isA<AuthExpiredError>()),
    );
    expect(newCalled, isTrue);
    client.clearOnAuthExpired();
    await client.setAuth(token: 'next-token');
    newCalled = false;
    await expectLater(
      client.employeeQuery('employee:me', {}),
      throwsA(isA<AuthExpiredError>()),
    );
    expect(newCalled, isFalse);
  });
}
