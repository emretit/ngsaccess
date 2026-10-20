import 'dart:async';

import 'package:mocktail/mocktail.dart';

import 'package:ngsplusapp/repositories/auth_repository.dart';
import 'package:ngsplusapp/services/session_store.dart';

const authTestUser = AuthUser(
  id: 'employee-a',
  email: 'a@example.test',
  firstName: 'A',
  lastName: 'Test',
  cardNumber: 'test-card',
  projectId: 'project-a',
);
const otherAuthTestUser = AuthUser(
  id: 'employee-b',
  email: 'b@example.test',
  firstName: 'B',
  lastName: 'Test',
  cardNumber: 'other-card',
  projectId: 'project-b',
);

SignInResult authResult({
  String token = 'test-session-a',
  AuthUser user = authTestUser,
}) => SignInResult(token: token, expiresAt: '2099-01-01T00:00:00Z', user: user);

class FakeSessionStore implements SessionStore {
  StoredSession? session;
  String? email;
  Object? writeError;
  Object? readError;
  Object? clearError;
  Future<String?> Function()? onReadRememberedEmail;
  Completer<void>? writeGate;
  final writeStarted = Completer<void>();
  int reads = 0;
  int clears = 0;
  int purges = 0;

  @override
  Future<void> purgeLegacySecrets() async {
    purges++;
  }

  @override
  Future<StoredSession?> readSession() async {
    reads++;
    final failure = readError;
    if (failure != null) throw failure;
    return session;
  }

  @override
  Future<void> writeSession(StoredSession value) async {
    if (!writeStarted.isCompleted) writeStarted.complete();
    await writeGate?.future;
    final failure = writeError;
    if (failure != null) throw failure;
    session = value;
  }

  @override
  Future<void> clearSession() async {
    clears++;
    final failure = clearError;
    if (failure != null) throw failure;
    session = null;
  }

  @override
  Future<String?> readRememberedEmail() async {
    final callback = onReadRememberedEmail;
    return callback == null ? email : await callback();
  }

  @override
  Future<void> writeRememberedEmail(String? value) async {
    email = value;
  }
}

class FakeAuthRepository extends Fake implements AuthRepository {
  String? clientToken;
  int signInCalls = 0;
  int meCalls = 0;
  int signOutCalls = 0;
  int passwordChangeCalls = 0;
  Future<void> Function(String currentPassword, String newPassword)?
  onChangePassword;
  final signInStarted = Completer<void>();
  final meStarted = Completer<void>();
  Future<SignInResult> Function(String email, String password)? onSignIn;
  Future<AuthUser> Function()? onMe;
  Future<void> Function(String token)? onSignOut;

  @override
  Future<void> setAuth(String token) async {
    clientToken = token;
  }

  @override
  Future<void> clearAuth() async {
    clientToken = null;
  }

  @override
  Future<SignInResult> signIn({
    required String email,
    required String password,
  }) async {
    signInCalls++;
    if (!signInStarted.isCompleted) signInStarted.complete();
    final callback = onSignIn;
    if (callback != null) return callback(email, password);
    return authResult();
  }

  @override
  Future<AuthUser> me() async {
    meCalls++;
    if (!meStarted.isCompleted) meStarted.complete();
    final callback = onMe;
    if (callback != null) return callback();
    return authTestUser;
  }

  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    passwordChangeCalls++;
    await onChangePassword?.call(currentPassword, newPassword);
  }

  @override
  Future<void> signOut(String token) async {
    signOutCalls++;
    await onSignOut?.call(token);
  }
}
