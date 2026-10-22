import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/repositories/auth_repository.dart' show SignInResult;
import 'package:ngsplusapp/services/session_store.dart';

import '../auth_fakes.dart';

void main() {
  late FakeAuthRepository repo;
  late FakeSessionStore store;
  late AuthProvider auth;
  setUp(() {
    repo = FakeAuthRepository();
    store = FakeSessionStore();
    auth = AuthProvider(repository: repo, sessionStore: store);
  });
  tearDown(() => auth.dispose());

  test(
    'employment ended bootstrap removes token and never becomes retryable',
    () async {
      store.session = const StoredSession(token: 'saved-session');
      repo.onMe = () async => throw const EmploymentEndedError();
      await auth.bootstrap();
      expect(auth.phase, AuthPhase.unauthenticated);
      expect(auth.bootstrapError, isNull);
      expect(auth.lastError, isA<EmploymentEndedError>());
      expect(auth.sessionToken, isNull);
      expect(auth.currentUser, isNull);
      expect(store.session, isNull);
      expect(repo.clientToken, isNull);
      await auth.bootstrap();
      expect(repo.meCalls, 1);
    },
  );

  test('login commits secure session and remembers only email', () async {
    expect(
      await auth.signIn(
        ' a@example.test ',
        'test-password',
        rememberEmail: true,
      ),
      isTrue,
    );
    expect(auth.phase, AuthPhase.authenticated);
    expect(auth.currentUser, authTestUser);
    expect(store.session?.token, 'test-session-a');
    expect(store.email, 'a@example.test');
    expect(repo.clientToken, 'test-session-a');
  });

  test(
    'remember disabled removes old email and keeps safe session persistence',
    () async {
      store.email = 'previous@example.test';
      await auth.signIn('a@example.test', 'test-password');
      expect(store.email, isNull);
      expect(store.session, isNotNull);
    },
  );

  test('secure write failure cannot report successful login', () async {
    store.writeError = StateError('simulated storage error');
    expect(await auth.signIn('a@example.test', 'test-password'), isFalse);
    expect(auth.isAuthenticated, isFalse);
    expect(auth.lastError, isA<BusinessError>());
    expect((auth.lastError as BusinessError).code, 'SESSION_STORAGE_FAILED');
    expect(repo.clientToken, isNull);
    expect(store.session, isNull);
    expect(repo.signOutCalls, 1);
  });

  test('concurrent submit creates one remote login', () async {
    final reply = Completer<SignInResult>();
    repo.onSignIn = (email, password) => reply.future;
    final first = auth.signIn('a@example.test', 'test-password');
    await repo.signInStarted.future;
    expect(await auth.signIn('b@example.test', 'test-password'), isFalse);
    expect(repo.signInCalls, 1);
    reply.complete(authResult());
    expect(await first, isTrue);
  });

  test(
    'logout immediately closes local auth while remote revocation waits',
    () async {
      await auth.signIn('a@example.test', 'test-password');
      final remote = Completer<void>();
      repo.onSignOut = (_) => remote.future;
      final epoch = auth.sessionEpoch;
      final logout = auth.signOut();
      expect(auth.phase, AuthPhase.unauthenticated);
      expect(auth.sessionEpoch, greaterThan(epoch));
      expect(auth.currentUser, isNull);
      await logout; // Does not wait for remote completion.
      expect(store.session, isNull);
      expect(repo.clientToken, isNull);
      remote.complete();
    },
  );

  test('offline logout stays logged out after process recreation', () async {
    await auth.signIn('a@example.test', 'test-password', rememberEmail: true);
    repo.onSignOut = (_) async => throw const NetworkError();
    await auth.signOut();
    final relaunched = AuthProvider(
      repository: FakeAuthRepository(),
      sessionStore: store,
    );
    addTearDown(relaunched.dispose);
    await relaunched.bootstrap();
    expect(relaunched.phase, AuthPhase.unauthenticated);
    expect(relaunched.isAuthenticated, isFalse);
  });

  test('late login success after logout cannot restore the session', () async {
    final reply = Completer<SignInResult>();
    repo.onSignIn = (email, password) => reply.future;
    final login = auth.signIn('a@example.test', 'test-password');
    await repo.signInStarted.future;
    await auth.signOut();
    reply.complete(authResult());
    expect(await login, isFalse);
    expect(auth.phase, AuthPhase.unauthenticated);
    expect(store.session, isNull);
    expect(repo.clientToken, isNull);
  });

  test('logout wins over a secure write already in flight', () async {
    store.writeGate = Completer<void>();
    final login = auth.signIn('a@example.test', 'test-password');
    await store.writeStarted.future;
    final logout = auth.signOut();
    store.writeGate?.complete();
    expect(await login, isFalse);
    await logout;
    expect(store.session, isNull);
    expect(repo.clientToken, isNull);
    expect(auth.isAuthenticated, isFalse);
  });

  test(
    'late A login error cannot change successful B session or busy state',
    () async {
      final oldReply = Completer<SignInResult>();
      repo.onSignIn = (email, password) => oldReply.future;
      final oldLogin = auth.signIn('a@example.test', 'test-password');
      await repo.signInStarted.future;
      await auth.signOut();
      repo.onSignIn = (email, password) async =>
          authResult(token: 'session-b', user: otherAuthTestUser);
      expect(await auth.signIn('b@example.test', 'test-password'), isTrue);
      oldReply.completeError(const NetworkError());
      expect(await oldLogin, isFalse);
      expect(auth.currentUser, otherAuthTestUser);
      expect(auth.lastError, isNull);
      expect(auth.isLoading, isFalse);
      expect(store.session?.token, 'session-b');
    },
  );

  test(
    'late A login success cannot replace successful B credentials',
    () async {
      final oldReply = Completer<SignInResult>();
      repo.onSignIn = (email, password) => oldReply.future;
      final oldLogin = auth.signIn('a@example.test', 'test-password');
      await repo.signInStarted.future;
      await auth.signOut();
      repo.onSignIn = (email, password) async =>
          authResult(token: 'session-b', user: otherAuthTestUser);
      expect(await auth.signIn('b@example.test', 'test-password'), isTrue);
      oldReply.complete(authResult());
      expect(await oldLogin, isFalse);
      expect(auth.currentUser, otherAuthTestUser);
      expect(auth.sessionToken, 'session-b');
      expect(repo.clientToken, 'session-b');
      expect(store.session?.token, 'session-b');
    },
  );

  test(
    'bootstrap deduplicates work and authenticates the stored token',
    () async {
      store.session = const StoredSession(token: 'saved-session');
      final reply = Completer<AuthUser>();
      repo.onMe = () => reply.future;
      final first = auth.bootstrap();
      final second = auth.bootstrap();
      expect(identical(first, second), isTrue);
      await repo.meStarted.future;
      reply.complete(authTestUser);
      await first;
      expect(store.reads, 1);
      expect(repo.meCalls, 1);
      expect(auth.isInitialized, isTrue);
      expect(auth.isBootstrapping, isFalse);
      expect(auth.isAuthenticated, isTrue);
    },
  );

  test(
    'temporary bootstrap failure retains secure token and can retry',
    () async {
      store.session = const StoredSession(token: 'saved-session');
      repo.onMe = () async => throw const NetworkError();
      await auth.bootstrap();
      expect(auth.phase, AuthPhase.retryableFailure);
      expect(auth.bootstrapError, isA<NetworkError>());
      expect(auth.isAuthenticated, isFalse);
      expect(repo.clientToken, isNull);
      expect(store.session?.token, 'saved-session');
      repo.onMe = () async => authTestUser;
      await auth.bootstrap(force: true);
      expect(auth.isAuthenticated, isTrue);
      expect(auth.bootstrapError, isNull);
    },
  );

  test(
    'secure read failure is visible retryable startup and can recover',
    () async {
      store.readError = StateError('simulated unavailable storage');
      await auth.bootstrap();
      expect(auth.phase, AuthPhase.retryableFailure);
      expect(
        (auth.bootstrapError as BusinessError).code,
        'SESSION_STORAGE_FAILED',
      );
      expect(auth.isInitialized, isTrue);
      expect(auth.isLoading, isFalse);
      store.readError = null;
      await auth.bootstrap(force: true);
      expect(auth.phase, AuthPhase.unauthenticated);
      expect(auth.bootstrapError, isNull);
    },
  );

  test('expired stored session is rejected at exact expiry boundary', () async {
    auth.dispose();
    auth = AuthProvider(
      repository: repo,
      sessionStore: store,
      now: () => DateTime.utc(2026, 10, 19),
    );
    store.session = const StoredSession(
      token: 'saved-session',
      expiresAt: '2026-10-19T00:00:00Z',
    );
    await auth.bootstrap();
    expect(auth.phase, AuthPhase.unauthenticated);
    expect(store.session, isNull);
    expect(repo.meCalls, 0);
  });

  test(
    'terminal bootstrap error removes credentials, network errors do not',
    () async {
      store.session = const StoredSession(token: 'saved-session');
      repo.onMe = () async => throw const AuthExpiredError('SESSION_REVOKED');
      await auth.bootstrap();
      expect(auth.phase, AuthPhase.unauthenticated);
      expect(store.session, isNull);
      expect(auth.lastError, isA<AuthExpiredError>());
    },
  );

  test('late bootstrap response cannot replace a new user', () async {
    store.session = const StoredSession(token: 'saved-session-a');
    final reply = Completer<AuthUser>();
    repo.onMe = () => reply.future;
    final bootstrap = auth.bootstrap();
    await repo.meStarted.future;
    await auth.signOut();
    repo.onSignIn = (email, password) async =>
        authResult(token: 'session-b', user: otherAuthTestUser);
    await auth.signIn('b@example.test', 'test-password');
    reply.complete(authTestUser);
    await bootstrap;
    expect(auth.currentUser, otherAuthTestUser);
    expect(auth.sessionToken, 'session-b');
    expect(auth.lastError, isNull);
  });

  test(
    'expiry from an older token or epoch cannot close a new session',
    () async {
      await auth.signIn('a@example.test', 'test-password');
      final epoch = auth.sessionEpoch;
      await auth.signOut();
      repo.onSignIn = (email, password) async =>
          authResult(token: 'session-b', user: otherAuthTestUser);
      await auth.signIn('b@example.test', 'test-password');
      await auth.handleAuthExpiry(
        sessionToken: 'test-session-a',
        sessionEpoch: epoch,
      );
      expect(auth.currentUser, otherAuthTestUser);
      await auth.handleAuthExpiry(
        sessionToken: 'session-b',
        sessionEpoch: auth.sessionEpoch,
      );
      expect(auth.isAuthenticated, isFalse);
      expect(store.session, isNull);
    },
  );

  test(
    'dispose while login waits suppresses late notifications and state writes',
    () async {
      final reply = Completer<SignInResult>();
      repo.onSignIn = (email, password) => reply.future;
      var notifications = 0;
      auth.addListener(() => notifications++);
      final login = auth.signIn('a@example.test', 'test-password');
      await repo.signInStarted.future;
      final beforeDispose = notifications;
      auth.dispose();
      // Replace the teardown target with another object; the disposed instance
      // still owns the pending future below.
      auth = AuthProvider(repository: repo, sessionStore: store);
      reply.complete(authResult());
      expect(await login, isFalse);
      expect(notifications, beforeDispose);
      expect(store.session, isNull);
    },
  );

  test('local logout cleanup survives provider disposal', () async {
    await auth.signIn('a@example.test', 'test-password');
    final logout = auth.signOut();
    auth.dispose();
    auth = AuthProvider(repository: repo, sessionStore: store);
    await logout;
    expect(store.session, isNull);
    expect(repo.clientToken, isNull);
  });

  test(
    'password change logs out after server confirms requiresSignIn',
    () async {
      await auth.signIn('a@example.test', 'test-password');
      expect(
        await auth.changePassword(
          currentPassword: 'test-password',
          newPassword: 'New-test-password1',
        ),
        isTrue,
      );
      expect(repo.passwordChangeCalls, 1);
      expect(auth.phase, AuthPhase.unauthenticated);
      expect(auth.isChangingPassword, isFalse);
      expect(store.session, isNull);
    },
  );

  test(
    'password policy rejects weak, multibyte over-limit and unchanged secrets',
    () async {
      await auth.signIn('a@example.test', 'test-password');
      for (final value in [
        'Short1a',
        'lowercase-only1',
        'UPPERCASE-ONLY1',
        'No-digits-here',
        'Aa1${List.filled(24, '界').join()}',
        'Current-pass1',
      ]) {
        expect(
          await auth.changePassword(
            currentPassword: 'Current-pass1',
            newPassword: value,
          ),
          isFalse,
        );
        expect((auth.lastError as BusinessError).code, 'PASSWORD_POLICY');
      }
      expect(repo.passwordChangeCalls, 0);
      expect(auth.isAuthenticated, isTrue);
    },
  );

  test(
    'password request is single flight and failure keeps current session',
    () async {
      await auth.signIn('a@example.test', 'test-password');
      final reply = Completer<void>();
      repo.onChangePassword = (email, password) => reply.future;
      final first = auth.changePassword(
        currentPassword: 'test-password',
        newPassword: 'New-test-password1',
      );
      expect(auth.isChangingPassword, isTrue);
      expect(
        await auth.changePassword(
          currentPassword: 'test-password',
          newPassword: 'New-test-password1',
        ),
        isFalse,
      );
      reply.completeError(
        const BusinessError(message: '', code: 'INVALID_CREDENTIALS'),
      );
      expect(await first, isFalse);
      expect(auth.isAuthenticated, isTrue);
      expect(auth.isChangingPassword, isFalse);
      expect(repo.passwordChangeCalls, 1);
    },
  );

  test('late password-change success cannot sign out a new account', () async {
    await auth.signIn('a@example.test', 'test-password');
    final reply = Completer<void>();
    repo.onChangePassword = (email, password) => reply.future;
    final change = auth.changePassword(
      currentPassword: 'test-password',
      newPassword: 'New-test-password1',
    );
    await auth.signOut();
    repo.onSignIn = (email, password) async =>
        authResult(token: 'session-b', user: otherAuthTestUser);
    await auth.signIn('b@example.test', 'test-password');
    reply.complete();
    expect(await change, isFalse);
    expect(auth.currentUser, otherAuthTestUser);
    expect(auth.lastError, isNull);
    expect(auth.isChangingPassword, isFalse);
  });

  test(
    'password change timeout releases busy without claiming success',
    () async {
      auth.dispose();
      auth = AuthProvider(
        repository: repo,
        sessionStore: store,
        passwordChangeTimeout: const Duration(milliseconds: 1),
      );
      await auth.signIn('a@example.test', 'test-password');
      final reply = Completer<void>();
      repo.onChangePassword = (email, password) => reply.future;
      expect(
        await auth.changePassword(
          currentPassword: 'test-password',
          newPassword: 'New-test-password1',
        ),
        isFalse,
      );
      expect(auth.lastError, isA<TimeoutError>());
      expect(auth.isChangingPassword, isFalse);
      expect(auth.isAuthenticated, isTrue);
      reply.complete();
    },
  );

  test(
    'recovery clears an old login error without promising email delivery',
    () async {
      repo.onSignIn = (email, password) async => throw const NetworkError();
      await auth.signIn('a@example.test', 'test-password');
      expect(auth.lastError, isNotNull);
      expect(await auth.resetPassword('a@example.test'), isFalse);
      expect(auth.lastError, isNull);
      expect(auth.errorMessage, contains('yöneticiniz'));
    },
  );
}
