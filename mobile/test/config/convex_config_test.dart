import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ngsplusapp/config/convex_config.dart';
import 'package:ngsplusapp/core/errors.dart';

void main() {
  test(
    'polling yanıt tamamlanmadan yeni istek başlatmaz ve iptal edilir',
    () async {
      var requestCount = 0;
      var inFlight = 0;
      var maxInFlight = 0;

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
      await client.setAuth(token: 'test-token');

      final handle = await client.subscribeEmployeeQuery(
        name: 'cardReadings:listForEmployee',
        args: const {'limit': 50},
        pollingInterval: const Duration(milliseconds: 10),
        maxPollingInterval: const Duration(milliseconds: 10),
        onUpdate: (_) {},
        onError: (error) => fail(error.toString()),
      );

      await Future<void>.delayed(const Duration(milliseconds: 100));
      handle.cancel();
      final requestsAtCancellation = requestCount;
      await Future<void>.delayed(const Duration(milliseconds: 50));

      expect(requestCount, greaterThanOrEqualTo(2));
      expect(requestCount, requestsAtCancellation);
      expect(maxInFlight, 1);
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
