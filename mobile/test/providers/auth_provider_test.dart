import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:ngsplusapp/config/convex_config.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/repositories/auth_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../helpers/mocks.dart';

void main() {
  late MockAuthRepository repo;
  late AuthProvider provider;

  setUpAll(() {
    registerCommonFallbacks();
    // ConvexConfig.client setAuth/clearAuth çağrıları için minimal init.
    SharedPreferences.setMockInitialValues({});
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    // Gerçek HttpConvexClient instance — sadece in-memory token storage için.
    await ConvexConfig.initialize();
    repo = MockAuthRepository();
    provider = AuthProvider(repository: repo);
  });

  group('signIn', () {
    test('başarılı yanıtta isAuthenticated true olur', () async {
      when(() => repo.signIn(
            email: any(named: 'email'),
            password: any(named: 'password'),
          )).thenAnswer((_) async => SignInResult(
            token: 'tok',
            expiresAt: '2099-12-31T00:00:00Z',
            user: const AuthUser(
              id: 'u1',
              email: 'a@b.c',
              firstName: 'A',
              lastName: 'B',
              cardNumber: '1',
            ),
          ));

      final ok = await provider.signIn('a@b.c', 'secret');

      expect(ok, isTrue);
      expect(provider.isAuthenticated, isTrue);
      expect(provider.currentUser?.firstName, 'A');
      expect(provider.errorMessage, isNull);
      expect(provider.lastError, isNull);
    });

    test('AppError fırlarsa errorMessage + lastError set edilir', () async {
      when(() => repo.signIn(
            email: any(named: 'email'),
            password: any(named: 'password'),
          )).thenThrow(const BusinessError(message: 'E-posta veya şifre hatalı'));

      final ok = await provider.signIn('a@b.c', 'wrong');

      expect(ok, isFalse);
      expect(provider.isAuthenticated, isFalse);
      expect(provider.lastError, isA<BusinessError>());
      expect(provider.errorMessage, contains('E-posta veya şifre'));
    });

    test('beklenmedik exception UnknownError olarak map edilir', () async {
      when(() => repo.signIn(
            email: any(named: 'email'),
            password: any(named: 'password'),
          )).thenThrow(Exception('boom'));

      final ok = await provider.signIn('a@b.c', 'x');

      expect(ok, isFalse);
      expect(provider.lastError, isA<UnknownError>());
    });
  });

  group('handleAuthExpiry', () {
    test('aktif oturum yoksa state\'i değiştirmez', () async {
      await provider.handleAuthExpiry();
      expect(provider.lastError, isNull);
    });

    test('aktif oturumda expiry → currentUser null + lastError set', () async {
      // Önce signIn ile aktif oturum oluştur.
      when(() => repo.signIn(
            email: any(named: 'email'),
            password: any(named: 'password'),
          )).thenAnswer((_) async => SignInResult(
            token: 'tok',
            expiresAt: null,
            user: const AuthUser(
              id: 'u1',
              email: 'a@b.c',
              firstName: 'A',
              lastName: 'B',
              cardNumber: '1',
            ),
          ));
      await provider.signIn('a@b.c', 'secret');
      expect(provider.isAuthenticated, isTrue);

      await provider.handleAuthExpiry();

      expect(provider.isAuthenticated, isFalse);
      expect(provider.currentUser, isNull);
      expect(provider.lastError, isA<AuthExpiredError>());
    });
  });

  group('signOut', () {
    test('repo.signOut çağrılır + state temizlenir', () async {
      // Aktif oturum oluştur.
      when(() => repo.signIn(
            email: any(named: 'email'),
            password: any(named: 'password'),
          )).thenAnswer((_) async => SignInResult(
            token: 'tok-out',
            expiresAt: null,
            user: const AuthUser(
              id: 'u1',
              email: 'x@y.z',
              firstName: 'X',
              lastName: 'Y',
              cardNumber: '1',
            ),
          ));
      await provider.signIn('x@y.z', 'pw');

      when(() => repo.signOut(any())).thenAnswer((_) async {});

      await provider.signOut();

      verify(() => repo.signOut('tok-out')).called(1);
      expect(provider.isAuthenticated, isFalse);
      expect(provider.currentUser, isNull);
    });

    test('repo.signOut hatası logout\'u engellemez', () async {
      // Aktif oturum oluştur.
      when(() => repo.signIn(
            email: any(named: 'email'),
            password: any(named: 'password'),
          )).thenAnswer((_) async => SignInResult(
            token: 'tok',
            expiresAt: null,
            user: const AuthUser(
              id: 'u1',
              email: 'a@b.c',
              firstName: 'A',
              lastName: 'B',
              cardNumber: '1',
            ),
          ));
      await provider.signIn('a@b.c', 'p');

      when(() => repo.signOut(any()))
          .thenThrow(const NetworkError('offline'));

      await provider.signOut();

      expect(provider.isAuthenticated, isFalse);
    });
  });

  group('clearError', () {
    test('lastError ve errorMessage null\'a döner', () async {
      when(() => repo.signIn(
            email: any(named: 'email'),
            password: any(named: 'password'),
          )).thenThrow(const NetworkError('x'));

      await provider.signIn('a@b.c', 'p');
      expect(provider.lastError, isNotNull);

      provider.clearError();
      expect(provider.lastError, isNull);
      expect(provider.errorMessage, isNull);
    });
  });
}
