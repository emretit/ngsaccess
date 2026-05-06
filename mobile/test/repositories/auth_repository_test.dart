import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/repositories/auth_repository.dart';

import '../helpers/mocks.dart';

void main() {
  late MockHttpConvexClient client;
  late AuthRepository repo;

  setUpAll(registerCommonFallbacks);

  setUp(() {
    client = MockHttpConvexClient();
    repo = AuthRepository(client);
  });

  group('AuthRepository.signIn', () {
    test('başarılı yanıtta SignInResult döner', () async {
      final body = jsonEncode({
        'token': 'tok-123',
        'expiresAt': '2099-01-01T00:00:00Z',
        'employee': {
          'id': 'j123',
          'firstName': 'Ali',
          'lastName': 'Yılmaz',
          'email': 'ali@example.com',
          'photoUrl': null,
          'departmentId': null,
          'cardNumber': 'CARD-1',
        },
      });

      when(
        () => client.mutation(
          name: any(named: 'name'),
          args: any(named: 'args'),
        ),
      ).thenAnswer((_) async => body);

      final result =
          await repo.signIn(email: 'ali@example.com', password: 'secret');

      expect(result.token, 'tok-123');
      expect(result.expiresAt, '2099-01-01T00:00:00Z');
      expect(result.user.firstName, 'Ali');
      expect(result.user.cardNumber, 'CARD-1');
    });

    test('eksik token alanı BusinessError fırlatır', () async {
      final body = jsonEncode({'employee': {'id': 'j1'}});
      when(
        () => client.mutation(
          name: any(named: 'name'),
          args: any(named: 'args'),
        ),
      ).thenAnswer((_) async => body);

      expect(
        () => repo.signIn(email: 'a@b.c', password: 'x'),
        throwsA(isA<BusinessError>()),
      );
    });

    test('client AuthExpiredError fırlatırsa repo da fırlatır', () async {
      when(
        () => client.mutation(
          name: any(named: 'name'),
          args: any(named: 'args'),
        ),
      ).thenThrow(const AuthExpiredError('Mobil oturum yok'));

      expect(
        () => repo.signIn(email: 'a@b.c', password: 'x'),
        throwsA(isA<AuthExpiredError>()),
      );
    });
  });

  group('AuthRepository.me', () {
    test('Map yanıtı AuthUser\'a parse eder', () async {
      final body = jsonEncode({
        'id': 'j1',
        'firstName': 'Ayşe',
        'lastName': 'Demir',
        'email': 'ayse@x.com',
        'cardNumber': 'C-2',
        'departmentName': 'IT',
      });
      when(() => client.employeeQuery(any(), any()))
          .thenAnswer((_) async => body);

      final user = await repo.me();
      expect(user.firstName, 'Ayşe');
      expect(user.email, 'ayse@x.com');
      expect(user.departmentName, 'IT');
    });

    test('parse edilemeyen yanıtta BusinessError', () async {
      when(() => client.employeeQuery(any(), any()))
          .thenAnswer((_) async => 'not-json');

      expect(repo.me, throwsA(isA<BusinessError>()));
    });
  });

  group('AuthRepository.signOut', () {
    test('client mutation çağrısı yapar', () async {
      when(
        () => client.mutation(
          name: any(named: 'name'),
          args: any(named: 'args'),
        ),
      ).thenAnswer((_) async => 'null');

      await repo.signOut('tok');

      verify(
        () => client.mutation(
          name: 'employeeAuth:signOut',
          args: {'sessionToken': 'tok'},
        ),
      ).called(1);
    });
  });
}
