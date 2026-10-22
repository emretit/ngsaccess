import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/core/response_decoder.dart';

void main() {
  String decode(Object? envelope, [int status = 200]) =>
      decodeConvexResponse(statusCode: status, body: jsonEncode(envelope));

  test('success preserves explicit nulls in nested maps and lists', () {
    const value = {
      'cleared': null,
      'nested': [
        {'optional': null},
      ],
    };
    expect(jsonDecode(decode({'status': 'success', 'value': value})), value);
    expect(encodeConvexValue(value), value);
    expect(decode({'status': 'success', 'value': null}), 'null');
  });

  test('Convex float64 whole numbers decode as safe integer fields', () {
    final value =
        jsonDecode(
              decodeConvexResponse(
                statusCode: 200,
                body:
                    '{"status":"success","value":{"total":0.0,'
                    '"nested":[{"actuator":1.0}],"fraction":1.5,'
                    '"unsafe":9007199254740992.0,"negativeZero":-0.0}}',
              ),
            )
            as Map<String, dynamic>;
    expect(value['total'], isA<int>());
    expect(value['total'], 0);
    expect(value['nested'][0]['actuator'], isA<int>());
    expect(value['fraction'], 1.5);
    expect(value['unsafe'], isA<double>());
    expect((value['negativeZero'] as double).isNegative, isTrue);
  });

  test(
    '560 structured auth data takes priority over redacted errorMessage',
    () {
      expect(
        () => decode({
          'status': 'error',
          'errorMessage': 'Server Error',
          'errorData': {'code': 'SESSION_EXPIRED', 'message': 'secret-marker'},
        }, 560),
        throwsA(isA<AuthExpiredError>()),
      );
    },
  );

  test('structured retryAfterMs is bounded typed metadata', () {
    expect(
      () => decode({
        'status': 'error',
        'errorMessage': 'Server Error',
        'errorData': {'code': 'RATE_LIMITED', 'retryAfterMs': 5000},
      }, 560),
      throwsA(
        isA<BusinessError>().having(
          (e) => e.retryAfterMs,
          'retryAfterMs',
          5000,
        ),
      ),
    );
    expect(
      () => decode({
        'status': 'error',
        'errorMessage': 'Server Error',
        'errorData': {'code': 'RATE_LIMITED', 'retryAfterMs': 'secret-marker'},
      }, 560),
      throwsA(
        isA<BusinessError>().having(
          (e) => e.retryAfterMs,
          'retryAfterMs',
          isNull,
        ),
      ),
    );
  });

  for (final code in [
    'SESSION_REVOKED',
    'EMPLOYEE_INACTIVE',
    'EMPLOYMENT_ENDED',
  ]) {
    test('terminal backend session code $code is auth expiry', () {
      expect(
        () => decode({
          'status': 'error',
          'errorMessage': 'Server Error',
          'errorData': {'code': code},
        }, 560),
        throwsA(isA<AuthExpiredError>()),
      );
    });
  }

  test('200 can carry an error envelope and structured business code', () {
    expect(
      () => decode({
        'status': 'error',
        'errorMessage': 'Server Error',
        'errorData': {
          'code': 'INVALID_CREDENTIALS',
          'message': 'secret-marker',
        },
      }),
      throwsA(
        isA<BusinessError>().having(
          (e) => e.safeCode,
          'code',
          'INVALID_CREDENTIALS',
        ),
      ),
    );
  });

  for (final status in [200, 560]) {
    for (final code in [
      'TARGET_NOT_ALLOWED',
      'DOOR_REQUIRED',
      'DEVICE_INACTIVE',
      'DOOR_INACTIVE',
      'ACCESS_EPOCH_DENIED',
      'SCHEDULE_DENIED',
      'TARGET_UNSUPPORTED',
      'TRANSPORT_UNSUPPORTED',
      'ACCESS_GRAPH_LIMIT',
      'INVALID_REQUEST_ID',
      'REQUEST_TARGET_MISMATCH',
      'OPERATION_NOT_FOUND',
      'READER_REQUIRED',
    ]) {
      test(
        '$status preserves typed operation rejection $code through decoding',
        () {
          expect(
            () => decode({
              'status': 'error',
              'errorMessage': 'Mobil oturum yok',
              'errorData': {'code': code, 'message': 'private-backend-marker'},
            }, status),
            throwsA(
              isA<BusinessError>()
                  .having((error) => error.code, 'wire code', code)
                  .having((error) => error.safeCode, 'safe code', code)
                  .having(
                    (error) => error.userMessage,
                    'presentation',
                    isNot(contains('private-backend-marker')),
                  ),
            ),
          );
        },
      );
    }
  }

  test(
    'legacy plain UDF error is allowlisted, not treated as infrastructure',
    () {
      expect(
        () => decode({
          'status': 'error',
          'errorMessage':
              'Uncaught Error: E-posta veya şifre hatalı\n    at hidden',
        }, 560),
        throwsA(
          isA<BusinessError>().having(
            (e) => e.safeCode,
            'code',
            'INVALID_CREDENTIALS',
          ),
        ),
      );
      expect(
        () => decode({
          'status': 'error',
          'errorMessage': 'Mobil oturum yok',
        }, 560),
        throwsA(isA<AuthExpiredError>()),
      );
    },
  );

  for (final message in [
    'Server Error',
    'secret-token card password',
    'prefix session expired suffix',
    'unexpected exception',
  ]) {
    test(
      'redacted/unknown UDF messages are safe business failures: $message',
      () {
        expect(
          () => decode({'status': 'error', 'errorMessage': message}, 560),
          throwsA(
            isA<BusinessError>()
                .having((e) => e.safeCode, 'code', 'BUSINESS_ERROR')
                .having(
                  (e) => e.toString(),
                  'safe debug',
                  isNot(contains(message)),
                ),
          ),
        );
      },
    );
  }

  test('unknown structured code cannot trigger text auth fallback', () {
    expect(
      () => decode({
        'status': 'error',
        'errorMessage': 'Mobil oturum yok',
        'errorData': {'code': 'FUTURE_ERROR', 'message': 'Mobil oturum yok'},
      }, 560),
      throwsA(
        isA<BusinessError>().having(
          (e) => e.safeCode,
          'code',
          'BUSINESS_ERROR',
        ),
      ),
    );
  });

  for (final fixture in <Object?>[
    null,
    [],
    'raw-body-marker',
    {},
    {'status': 'success'},
    {'status': 'unknown', 'value': []},
    {'status': 'error', 'errorMessage': false},
    {
      'status': 'success',
      'value': {r'$integer': 'AA=='},
    },
    {
      'status': 'success',
      'value': {r'$float': 'invalid'},
    },
    {
      'status': 'error',
      'errorMessage': 'x',
      'errorData': {'code': 23},
    },
  ]) {
    test('invalid envelope/value becomes ProtocolError: $fixture', () {
      expect(() => decode(fixture), throwsA(isA<ProtocolError>()));
    });
  }

  test('malformed JSON never appears in exception text', () {
    expect(
      () => decodeConvexResponse(
        statusCode: 200,
        body: '{password: secret-marker',
      ),
      throwsA(
        isA<ProtocolError>().having(
          (e) => e.toString(),
          'redacted',
          isNot(contains('secret-marker')),
        ),
      ),
    );
  });

  test('560 cannot claim success', () {
    expect(
      () => decode({'status': 'success', 'value': null}, 560),
      throwsA(isA<ProtocolError>()),
    );
  });

  test('HTTP status semantics do not consume untrusted bodies', () {
    for (final status in [401, 403, 429, 503]) {
      final matcher = switch (status) {
        401 => isA<AuthExpiredError>(),
        503 => isA<ServerError>(),
        _ => isA<BusinessError>(),
      };
      expect(
        () => decodeConvexResponse(statusCode: status, body: 'secret-marker'),
        throwsA(matcher),
      );
    }
  });

  test('repository shape helpers reject wrong top-level shape', () {
    expect(() => decodeResponseObject('[]'), throwsA(isA<ProtocolError>()));
    expect(() => decodeResponseList('{}'), throwsA(isA<ProtocolError>()));
    expect(decodeResponseObject('{"value":null}'), {'value': null});
    expect(decodeResponseList('[null]'), [null]);
  });
}
