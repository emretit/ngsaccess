import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/repositories/auth_repository.dart';

import '../helpers/mocks.dart';

Map<String, Object?> employeeJson() => {
  'id': 'employee-a',
  'email': 'a@example.test',
  'firstName': 'A',
  'lastName': 'Test',
  'cardNumber': 'test-card',
  'projectId': 'project-a',
  'departmentName': null,
  'departmentId': null,
  'photoUrl': null,
};

void main() {
  late MockHttpConvexClient client;
  late AuthRepository repo;
  setUpAll(registerCommonFallbacks);
  setUp(() {
    client = MockHttpConvexClient();
    repo = AuthRepository(client);
  });

  void replyWith(Object? value) {
    when(
      () => client.mutation(
        name: any(named: 'name'),
        args: any(named: 'args'),
      ),
    ).thenAnswer((_) async => jsonEncode(value));
  }

  test('valid response decodes strict user and optional project', () async {
    replyWith({
      'token': 'test-session',
      'expiresAt': '2099-01-01T00:00:00Z',
      'employee': employeeJson(),
    });
    final result = await repo.signIn(
      email: ' a@example.test ',
      password: 'test-password',
    );
    expect(result.user.projectId, 'project-a');
    expect(result.user.firstName, 'A');
    expect(result.token, 'test-session');
    verify(
      () => client.mutation(
        name: 'employeeAuth:signIn',
        args: {'email': 'a@example.test', 'password': 'test-password'},
      ),
    ).called(1);
  });

  test('older valid user without optional project still decodes', () {
    final user = employeeJson()..remove('projectId');
    expect(AuthUser.fromJson(user).projectId, isNull);
  });

  for (final field in ['id', 'email', 'firstName', 'lastName', 'cardNumber']) {
    test('rejects missing required user field $field', () {
      final user = employeeJson()..remove(field);
      expect(() => AuthUser.fromJson(user), throwsA(isA<BusinessError>()));
    });
    test('rejects wrong type for user field $field', () {
      final user = employeeJson()..[field] = false;
      expect(() => AuthUser.fromJson(user), throwsA(isA<BusinessError>()));
    });
  }

  for (final field in [
    'projectId',
    'photoUrl',
    'departmentId',
    'departmentName',
  ]) {
    test('optional field $field must still have correct type', () {
      final user = employeeJson()..[field] = <Object?>[];
      expect(() => AuthUser.fromJson(user), throwsA(isA<BusinessError>()));
    });
  }

  final invalidShapes = <Object?>[
    null,
    [],
    true,
    {'employee': employeeJson()},
    {'token': '', 'employee': employeeJson()},
    {
      'token': 'test-session',
      'expiresAt': 'bad-date',
      'employee': employeeJson(),
    },
    {'token': 'test-session', 'employee': false},
  ];
  for (var index = 0; index < invalidShapes.length; index++) {
    final invalid = invalidShapes[index];
    test('malformed login shape $index fails safely', () async {
      replyWith(invalid);
      await expectLater(
        repo.signIn(email: 'a@example.test', password: 'test-password'),
        throwsA(
          isA<BusinessError>().having((e) => e.code, 'code', 'PROTOCOL_ERROR'),
        ),
      );
    });
  }

  test('invalid JSON never includes response body in error message', () async {
    when(
      () => client.employeeQuery(any(), any()),
    ).thenAnswer((_) async => 'invalid response with private fixture content');
    await expectLater(
      repo.me(),
      throwsA(
        isA<BusinessError>().having(
          (e) => e.userMessage,
          'safe message',
          isNot(contains('private fixture')),
        ),
      ),
    );
  });

  test('me decodes current employee and project', () async {
    when(
      () => client.employeeQuery(any(), any()),
    ).thenAnswer((_) async => jsonEncode(employeeJson()));
    expect((await repo.me()).projectId, 'project-a');
  });

  test(
    'invalid credentials structured value becomes typed business error',
    () async {
      replyWith({
        'error': {
          'code': 'INVALID_CREDENTIALS',
          'message': 'untrusted server text',
        },
      });
      await expectLater(
        repo.signIn(email: 'a@example.test', password: 'wrong-password'),
        throwsA(
          isA<BusinessError>()
              .having((e) => e.code, 'code', 'INVALID_CREDENTIALS')
              .having(
                (e) => e.message,
                'safe message',
                isNot(contains('untrusted')),
              ),
        ),
      );
    },
  );

  test('rate limit structured value becomes typed business error', () async {
    replyWith({
      'error': {
        'code': 'RATE_LIMITED',
        'message': 'untrusted',
        'retryAfterMs': 1000,
      },
    });
    await expectLater(
      repo.signIn(email: 'a@example.test', password: 'test-password'),
      throwsA(
        isA<BusinessError>()
            .having((e) => e.code, 'code', 'RATE_LIMITED')
            .having((e) => e.retryAfterMs, 'retry delay', 1000),
      ),
    );
  });

  for (final code in [
    'SESSION_INVALID',
    'SESSION_EXPIRED',
    'SESSION_REVOKED',
    'EMPLOYEE_INACTIVE',
  ]) {
    test('$code terminates restored session', () async {
      when(() => client.employeeQuery(any(), any())).thenAnswer(
        (_) async => jsonEncode({
          'error': {'code': code, 'message': 'untrusted'},
        }),
      );
      await expectLater(repo.me(), throwsA(isA<AuthExpiredError>()));
    });
  }

  test('unknown and malformed error envelopes are protocol failures', () async {
    for (final error in <Object?>[
      false,
      null,
      {'code': 4},
      {'code': 'NEW_UNKNOWN_CODE', 'message': 'untrusted'},
    ]) {
      replyWith({'error': error});
      await expectLater(
        repo.signIn(email: 'a@example.test', password: 'test-password'),
        throwsA(
          isA<BusinessError>().having((e) => e.code, 'code', 'PROTOCOL_ERROR'),
        ),
      );
    }
  });

  test(
    'change password uses employee authority and requires confirmed success',
    () async {
      when(
        () => client.employeeMutation(
          name: any(named: 'name'),
          args: any(named: 'args'),
        ),
      ).thenAnswer((_) async => jsonEncode({'requiresSignIn': true}));
      await repo.changePassword(
        currentPassword: 'test-password',
        newPassword: 'new-test-password',
      );
      verify(
        () => client.employeeMutation(
          name: 'employeeAuth:changePassword',
          args: {
            'currentPassword': 'test-password',
            'newPassword': 'new-test-password',
          },
        ),
      ).called(1);
      verifyNever(() => client.clearAuth());
    },
  );

  test(
    'change password rejects empty success and returns typed backend policy error',
    () async {
      for (final response in <Object?>[
        {},
        {'requiresSignIn': false},
      ]) {
        when(
          () => client.employeeMutation(
            name: any(named: 'name'),
            args: any(named: 'args'),
          ),
        ).thenAnswer((_) async => jsonEncode(response));
        await expectLater(
          repo.changePassword(
            currentPassword: 'test-password',
            newPassword: 'new-test-password',
          ),
          throwsA(isA<ProtocolError>()),
        );
      }
      when(
        () => client.employeeMutation(
          name: any(named: 'name'),
          args: any(named: 'args'),
        ),
      ).thenAnswer(
        (_) async => jsonEncode({
          'error': {'code': 'PASSWORD_POLICY', 'message': 'untrusted'},
        }),
      );
      await expectLater(
        repo.changePassword(
          currentPassword: 'test-password',
          newPassword: 'new-test-password',
        ),
        throwsA(
          isA<BusinessError>().having(
            (e) => e.code,
            'policy code',
            'PASSWORD_POLICY',
          ),
        ),
      );
    },
  );

  test('authentication attaches and detaches only injected client', () async {
    when(
      () => client.setAuth(token: any(named: 'token')),
    ).thenAnswer((_) async {});
    when(() => client.clearAuth()).thenAnswer((_) async {});
    await repo.setAuth('test-session');
    await repo.clearAuth();
    verify(() => client.setAuth(token: 'test-session')).called(1);
    verify(() => client.clearAuth()).called(1);
  });

  test(
    'remote signout revokes explicit token without changing another client session',
    () async {
      replyWith(null);
      await repo.signOut('old-test-session');
      verify(
        () => client.mutation(
          name: 'employeeAuth:signOut',
          args: {'sessionToken': 'old-test-session'},
        ),
      ).called(1);
      verifyNever(() => client.clearAuth());
    },
  );
}
