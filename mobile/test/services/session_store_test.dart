import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:ngsplusapp/services/session_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockSecureStorage extends Mock implements FlutterSecureStorage {}

void main() {
  late MockSecureStorage secure;
  late SecureSessionStore store;
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    secure = MockSecureStorage();
    when(
      () => secure.write(
        key: any(named: 'key'),
        value: any(named: 'value'),
      ),
    ).thenAnswer((_) async {});
    when(() => secure.delete(key: any(named: 'key'))).thenAnswer((_) async {});
    store = SecureSessionStore(storage: secure);
  });

  test(
    'migration deletes all legacy secrets without restoring old password or token',
    () async {
      SharedPreferences.setMockInitialValues({
        'remembered_password': 'old-test-password',
        'mobile_employee_token': 'old-test-session',
        'mobile_employee_expires': '2099-01-01T00:00:00Z',
        'convex_access_token': 'old-test-access',
        'convex_refresh_token': 'old-test-refresh',
        'remember_me': true,
        'remembered_email': 'a@example.test',
      });
      expect(await store.readSession(), isNull);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getKeys(), {SecureSessionStore.rememberedEmailKey});
      expect(await store.readRememberedEmail(), 'a@example.test');
      verifyNever(
        () => secure.write(
          key: any(named: 'key'),
          value: any(named: 'value'),
        ),
      );
    },
  );

  test(
    'credentials are one secure record and never written to preferences',
    () async {
      await store.writeSession(
        const StoredSession(
          token: 'new-test-session',
          expiresAt: '2099-01-01T00:00:00Z',
        ),
      );
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getKeys(), {SecureSessionStore.restoreAllowedKey});
      expect(prefs.getBool(SecureSessionStore.restoreAllowedKey), isTrue);
      final capture =
          verify(
                () => secure.write(
                  key: SecureSessionStore.sessionKey,
                  value: captureAny(named: 'value'),
                ),
              ).captured.single
              as String;
      expect(jsonDecode(capture), {
        'token': 'new-test-session',
        'expiresAt': '2099-01-01T00:00:00Z',
      });
    },
  );

  test(
    'valid secure session restores only with explicit restore permission',
    () async {
      SharedPreferences.setMockInitialValues({
        SecureSessionStore.restoreAllowedKey: true,
      });
      when(() => secure.read(key: any(named: 'key'))).thenAnswer(
        (_) async => jsonEncode({
          'token': 'saved-test-session',
          'expiresAt': '2099-01-01T00:00:00Z',
        }),
      );
      final session = await store.readSession();
      expect(session?.token, 'saved-test-session');
      expect(session?.expiresAt, '2099-01-01T00:00:00Z');
    },
  );

  test('secure write failure leaves restore disabled', () async {
    when(
      () => secure.write(
        key: any(named: 'key'),
        value: any(named: 'value'),
      ),
    ).thenThrow(StateError('simulated failure'));
    await expectLater(
      store.writeSession(const StoredSession(token: 'new-test-session')),
      throwsStateError,
    );
    expect(await store.readSession(), isNull);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getBool(SecureSessionStore.restoreAllowedKey), isFalse);
  });

  test(
    'logout tombstone prevents restore even if secure deletion fails',
    () async {
      SharedPreferences.setMockInitialValues({
        SecureSessionStore.restoreAllowedKey: true,
      });
      when(
        () => secure.delete(key: any(named: 'key')),
      ).thenThrow(StateError('simulated failure'));
      await expectLater(store.clearSession(), throwsStateError);
      final relaunched = SecureSessionStore(storage: secure);
      expect(await relaunched.readSession(), isNull);
      verifyNever(() => secure.read(key: any(named: 'key')));
    },
  );

  test(
    'a surviving secure item without preferences does not restore after reinstall',
    () async {
      when(() => secure.read(key: any(named: 'key'))).thenAnswer(
        (_) async =>
            jsonEncode({'token': 'surviving-test-session', 'expiresAt': null}),
      );
      expect(await store.readSession(), isNull);
      verifyNever(() => secure.read(key: any(named: 'key')));
    },
  );

  test(
    'malformed secure record is removed rather than authenticated',
    () async {
      SharedPreferences.setMockInitialValues({
        SecureSessionStore.restoreAllowedKey: true,
      });
      when(
        () => secure.read(key: any(named: 'key')),
      ).thenAnswer((_) async => '{bad-json');
      expect(await store.readSession(), isNull);
      verify(() => secure.delete(key: SecureSessionStore.sessionKey)).called(1);
      expect(
        (await SharedPreferences.getInstance()).getBool(
          SecureSessionStore.restoreAllowedKey,
        ),
        isFalse,
      );
    },
  );

  test(
    'remembered email can be removed without any credential storage',
    () async {
      await store.writeRememberedEmail(' a@example.test ');
      expect(await store.readRememberedEmail(), 'a@example.test');
      await store.writeRememberedEmail(null);
      expect(await store.readRememberedEmail(), isNull);
      verifyNever(
        () => secure.write(
          key: any(named: 'key'),
          value: any(named: 'value'),
        ),
      );
    },
  );
}
