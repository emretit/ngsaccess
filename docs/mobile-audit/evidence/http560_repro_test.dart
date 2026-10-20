// Audit characterization: proves current behavior, not desired behavior.
// Run from mobile/: flutter test --no-pub ../docs/mobile-audit/evidence/http560_repro_test.dart
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ngsplusapp/config/convex_config.dart';
import 'package:ngsplusapp/core/errors.dart';

void main() {
  for (final status in [200, 560]) {
    test('same expired-session envelope with HTTP $status', () async {
      var expiredCallback = false;
      final transport = MockClient((_) async => http.Response(
            jsonEncode({
              'status': 'error',
              'errorMessage': 'Oturum süresi doldu',
            }),
            status,
          ));
      final client = HttpConvexClient(
        deploymentUrl: 'https://audit.invalid',
        maxRetries: 1,
        httpClient: transport,
      );
      client.setOnAuthExpired(() => expiredCallback = true);
      await client.setAuth(token: 'synthetic-audit-token');
      await expectLater(
        client.employeeQuery('audit:fixture', {}),
        status == 560
            ? throwsA(isA<ServerError>())
            : throwsA(isA<AuthExpiredError>()),
      );
      expect(expiredCallback, status == 200);
      // The 560 case should become AuthExpiredError + callback after the fix.
      transport.close();
    });
  }
}
