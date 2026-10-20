import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:ngsplusapp/repositories/qr_repository.dart';

import '../helpers/mocks.dart';

void main() {
  late MockHttpConvexClient client;
  late QrRepository repository;
  final now = DateTime.utc(2026, 10, 19, 12);
  setUpAll(registerCommonFallbacks);
  setUp(() {
    client = MockHttpConvexClient();
    repository = QrRepository(client);
  });

  test(
    'token creation uses injected employee client exactly once without mutation retry',
    () async {
      when(
        () => client.employeeMutation(
          name: any(named: 'name'),
          args: any(named: 'args'),
          retry: false,
        ),
      ).thenAnswer(
        (_) async => jsonEncode({
          'token': 'fixture-token',
          'expiresAt': now.add(const Duration(seconds: 33)).toIso8601String(),
          'serverTime': now.toIso8601String(),
          'purpose': 'reader',
        }),
      );
      final token = await repository.createToken();
      expect(token.expiresAt.difference(token.serverTime ?? now).inSeconds, 33);
      verify(
        () => client.employeeMutation(
          name: 'employeeCheckIn:createMyCheckInToken',
          args: const {},
          retry: false,
        ),
      ).called(1);
      verifyNever(
        () => client.employeeMutation(
          name: 'cardReadings:selfCheckIn',
          args: any(named: 'args'),
          retry: any(named: 'retry'),
        ),
      );
    },
  );

  test(
    'consumption query uses only token; employee identity comes from session',
    () async {
      final token = QrToken(value: 'fixture-token', expiresAt: now);
      when(() => client.employeeQuery(any(), any())).thenAnswer(
        (_) async => jsonEncode({
          'status': 'consumed',
          'expiresAt': now.toIso8601String(),
          'serverTime': now.toIso8601String(),
        }),
      );
      final result = await repository.tokenStatus(token);
      expect(result.status, QrTokenStatus.consumed);
      verify(
        () => client.employeeQuery('employeeCheckIn:getMyCheckInTokenStatus', {
          'token': 'fixture-token',
        }),
      ).called(1);
    },
  );

  test('malformed DTO cannot become a successful token', () async {
    for (final fixture in [
      [],
      null,
      {'token': true, 'expiresAt': now.toIso8601String()},
      {'token': 'fixture', 'expiresAt': 'bad'},
      {
        'token': 'fixture',
        'expiresAt': now.toIso8601String(),
        'status': 'unexpected',
      },
      {
        'token': 'fixture',
        'expiresAt': now.toIso8601String(),
        'serverTime': true,
      },
    ]) {
      when(
        () => client.employeeMutation(
          name: any(named: 'name'),
          args: any(named: 'args'),
          retry: false,
        ),
      ).thenAnswer((_) async => jsonEncode(fixture));
      await expectLater(repository.createToken(), throwsFormatException);
    }
  });
}
