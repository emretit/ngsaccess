import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/models/door_operation.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/door_operation_provider.dart';

import '../auth_fakes.dart';
import '../helpers/door_operation_fakes.dart';

void main() {
  late AuthProvider auth;
  late FakeAuthRepository authRepository;
  late MemoryOperationStore store;
  late FakeOperationRepository repository;
  late DoorOperationProvider provider;

  setUp(() async {
    authRepository = FakeAuthRepository();
    auth = AuthProvider(
      repository: authRepository,
      sessionStore: FakeSessionStore(),
    );
    await auth.signIn('a@example.test', 'synthetic-password');
    store = MemoryOperationStore();
    repository = FakeOperationRepository();
    provider = DoorOperationProvider(repository: repository, store: store);
    await provider.synchronizeSession(auth, deployment: scopeA.deployment);
  });
  tearDown(() {
    auth.dispose();
  });

  test(
    'ten concurrent taps capture one durable 128 bit intention before request',
    () async {
      final gate = Completer<DoorOperation>();
      repository.onRequest = () => gate.future;
      final taps = List.generate(
        10,
        (_) => provider.open(deviceId: 'device-a', doorId: 'door-a'),
      );
      await repository.requestStarted.future;
      expect(repository.requests, hasLength(1));
      final id = repository.requests.single.requestId;
      expect(id, matches(RegExp(r'^[0-9a-f]{32}$')));
      expect(store.records[scopeA]?.requestId, id);
      expect(provider.isLoading, isTrue);
      gate.complete(receipt());
      await Future.wait(taps);
      await provider.open(deviceId: 'another-target');
      expect(repository.requests, hasLength(1));
      expect(provider.requestId, id);
      expect(provider.pendingDeviceId, 'device-a');
      expect(provider.hasUnresolvedOperation, isTrue);
      provider.dispose();
    },
  );

  test(
    'commit response loss reconciles by request query and never creates another command',
    () async {
      repository.onRequest = () async => throw const TimeoutError();
      await provider.open(deviceId: 'device-a', doorId: 'door-a');
      final id = provider.requestId;
      expect(provider.operation, isNull);
      expect(provider.error, isA<TimeoutError>());
      expect(provider.hasUnresolvedOperation, isTrue);
      repository.onLookup = () async =>
          receipt(status: DoorOperationStatus.confirmed);
      await provider.checkStatus();
      expect(repository.requestLookups, [id]);
      expect(repository.requests, hasLength(1));
      expect(provider.operation?.status, DoorOperationStatus.confirmed);
      expect(provider.hasUnresolvedOperation, isFalse);
      expect(store.records, isEmpty);
      provider.dispose();
    },
  );

  test(
    'relaunch queries a stored request; null stays unresolved until explicit same-ID retry',
    () async {
      provider.dispose();
      store.records[scopeA] = storedIntent;
      provider = DoorOperationProvider(repository: repository, store: store);
      await provider.synchronizeSession(auth, deployment: scopeA.deployment);
      expect(repository.requests, isEmpty);
      expect(repository.requestLookups, [storedIntent.requestId]);
      expect(provider.requestId, storedIntent.requestId);
      await provider.checkStatus();
      expect(repository.requests, isEmpty);
      await provider.open(deviceId: 'device-b');
      expect(repository.requests, isEmpty);
      await provider.retrySameRequest();
      expect(repository.requests.single.requestId, storedIntent.requestId);
      expect(repository.requests.single.deviceId, storedIntent.deviceId);
      expect(repository.requests.single.doorId, storedIntent.doorId);
      provider.dispose();
    },
  );

  test(
    'relaunch with receipt queries operationId and never resends even unknown',
    () async {
      provider.dispose();
      store.records[scopeA] = storedIntent.withOperation('operation-a');
      repository.onOperation = () async =>
          receipt(status: DoorOperationStatus.unknown);
      repository.onLookup = () async =>
          receipt(status: DoorOperationStatus.unknown);
      provider = DoorOperationProvider(repository: repository, store: store);
      await provider.synchronizeSession(auth, deployment: scopeA.deployment);
      expect(repository.operationLookups, ['operation-a']);
      await provider.retrySameRequest();
      expect(repository.requests, isEmpty);
      expect(provider.hasUnresolvedOperation, isTrue);
      provider.dispose();
    },
  );

  test(
    'initial store failure prevents HTTP and explicit retry retains same intention',
    () async {
      store.writeError = StateError('synthetic failure');
      await provider.open(deviceId: 'device-a', doorId: 'door-a');
      final id = provider.requestId;
      expect(repository.requests, isEmpty);
      expect(provider.error, isA<BusinessError>());
      expect(provider.hasUnresolvedOperation, isTrue);
      store.writeError = null;
      await provider.retrySameRequest();
      expect(repository.requests.single.requestId, id);
      provider.dispose();
    },
  );

  test(
    'explicit first-request denial is distinct from response loss and permits later intent',
    () async {
      repository.onRequest = () async =>
          throw const BusinessError(message: '', code: 'ACCESS_DENIED');
      await provider.open(deviceId: 'device-a', doorId: 'door-a');
      expect(provider.error, isA<BusinessError>());
      expect((provider.error as BusinessError).code, 'ACCESS_DENIED');
      expect(provider.hasUnresolvedOperation, isFalse);
      expect(store.records, isEmpty);
      repository.onRequest = () async =>
          receipt(status: DoorOperationStatus.confirmed);
      await provider.open(deviceId: 'device-a', doorId: 'door-a');
      expect(repository.requests, hasLength(2));
      expect(
        repository.requests.first.requestId,
        isNot(repository.requests.last.requestId),
      );
      provider.dispose();
    },
  );

  test(
    'expiry ends only the owning auth session and keeps its unresolved receipt',
    () async {
      repository.onRequest = () async => throw const AuthExpiredError();
      await provider.open(deviceId: 'device-a', doorId: 'door-a');
      expect(auth.isAuthenticated, isFalse);
      expect(provider.operation, isNull);
      expect(provider.isLoading, isFalse);
      expect(provider.hasUnresolvedOperation, isFalse);
      expect(store.records[scopeA], isNotNull);
      provider.dispose();
    },
  );

  test('late A expiry cannot close a newly authenticated B session', () async {
    final gate = Completer<DoorOperation>();
    repository.onRequest = () => gate.future;
    final pending = provider.open(deviceId: 'device-a', doorId: 'door-a');
    await repository.requestStarted.future;
    await auth.signOut();
    authRepository.onSignIn = (_, _) async =>
        authResult(user: otherAuthTestUser);
    await auth.signIn('b@example.test', 'synthetic-password');
    await provider.synchronizeSession(auth, deployment: scopeA.deployment);
    gate.completeError(const AuthExpiredError());
    await pending;
    expect(auth.currentUser?.id, otherAuthTestUser.id);
    expect(auth.isAuthenticated, isTrue);
    expect(provider.error, isNull);
    expect(provider.isLoading, isFalse);
    provider.dispose();
  });

  test('failed read cannot silently discard previous pending state', () async {
    provider.dispose();
    store.readError = StateError('synthetic storage failure');
    provider = DoorOperationProvider(repository: repository, store: store);
    await provider.synchronizeSession(auth, deployment: scopeA.deployment);
    await provider.open(deviceId: 'device-a', doorId: 'door-a');
    expect(repository.requests, isEmpty);
    expect(provider.hasUnresolvedOperation, isTrue);
    store.readError = null;
    store.records[scopeA] = storedIntent;
    await provider.checkStatus();
    expect(provider.requestId, storedIntent.requestId);
    expect(repository.requests, isEmpty);
    provider.dispose();
  });

  test(
    'logout during persistence prevents command and preserves scoped intent for recovery',
    () async {
      store.writeGate = Completer<void>();
      final pending = provider.open(deviceId: 'device-a', doorId: 'door-a');
      await store.writeStarted.future;
      await auth.signOut();
      await provider.synchronizeSession(auth, deployment: scopeA.deployment);
      store.writeGate?.complete();
      await pending;
      expect(repository.requests, isEmpty);
      expect(provider.operation, isNull);
      expect(provider.isLoading, isFalse);
      expect(store.records[scopeA], isNotNull);
      provider.dispose();
    },
  );

  test(
    'A response cannot modify B state even before auth proxy synchronizes',
    () async {
      final gate = Completer<DoorOperation>();
      repository.onRequest = () => gate.future;
      final pending = provider.open(deviceId: 'device-a', doorId: 'door-a');
      await repository.requestStarted.future;
      await auth.signOut();
      authRepository.onSignIn = (_, _) async =>
          authResult(user: otherAuthTestUser);
      await auth.signIn('b@example.test', 'synthetic-password');
      gate.complete(receipt(status: DoorOperationStatus.confirmed));
      await pending;
      await provider.synchronizeSession(auth, deployment: scopeA.deployment);
      expect(provider.operation, isNull);
      expect(provider.error, isNull);
      expect(provider.isLoading, isFalse);
      expect(provider.requestId, isNull);
      expect(store.records[scopeA], isNotNull);
      provider.dispose();
    },
  );

  test('A finally cannot clear loading while B command is in flight', () async {
    final a = Completer<DoorOperation>();
    repository.onRequest = () => a.future;
    final pendingA = provider.open(deviceId: 'device-a', doorId: 'door-a');
    await repository.requestStarted.future;
    await auth.signOut();
    authRepository.onSignIn = (_, _) async =>
        authResult(user: otherAuthTestUser);
    await auth.signIn('b@example.test', 'synthetic-password');
    await provider.synchronizeSession(auth, deployment: scopeA.deployment);
    final b = Completer<DoorOperation>();
    final bStarted = Completer<void>();
    repository.onRequest = () {
      bStarted.complete();
      return b.future;
    };
    final pendingB = provider.open(deviceId: 'device-a', doorId: 'door-a');
    await bStarted.future;
    final requestB = provider.requestId;
    a.complete(receipt(status: DoorOperationStatus.confirmed));
    await pendingA;
    expect(provider.isLoading, isTrue);
    expect(provider.requestId, requestB);
    expect(provider.operation, isNull);
    b.complete(receipt());
    await pendingB;
    expect(provider.isLoading, isFalse);
    expect(provider.requestId, requestB);
    provider.dispose();
  });

  test(
    'late restored A query cannot write a receipt or error into B state',
    () async {
      provider.dispose();
      store.records[scopeA] = storedIntent;
      final query = Completer<DoorOperation?>();
      final queryStarted = Completer<void>();
      repository.onLookup = () {
        queryStarted.complete();
        return query.future;
      };
      provider = DoorOperationProvider(repository: repository, store: store);
      final restoreA = provider.synchronizeSession(
        auth,
        deployment: scopeA.deployment,
      );
      await queryStarted.future;
      await auth.signOut();
      authRepository.onSignIn = (_, _) async =>
          authResult(user: otherAuthTestUser);
      await auth.signIn('b@example.test', 'synthetic-password');
      await provider.synchronizeSession(auth, deployment: scopeA.deployment);
      query.complete(receipt(status: DoorOperationStatus.confirmed));
      await restoreA;
      expect(provider.operation, isNull);
      expect(provider.error, isNull);
      expect(provider.isLoading, isFalse);
      expect(store.records[scopeA]?.operationId, isNull);
      expect(store.removals, 0);
      provider.dispose();
    },
  );

  test(
    'dispose rejects late result and notification without deleting command receipt',
    () async {
      final gate = Completer<DoorOperation>();
      repository.onRequest = () => gate.future;
      final pending = provider.open(deviceId: 'device-a', doorId: 'door-a');
      await repository.requestStarted.future;
      var notifications = 0;
      provider.addListener(() {
        notifications++;
      });
      provider.dispose();
      gate.complete(receipt(status: DoorOperationStatus.confirmed));
      await pending;
      expect(notifications, 0);
      expect(store.records[scopeA], isNotNull);
      expect(store.removals, 0);
    },
  );

  test(
    'terminal cleanup failure blocks new intention until status confirms cleanup',
    () async {
      repository.onRequest = () async =>
          receipt(status: DoorOperationStatus.confirmed);
      store.removeError = StateError('synthetic failure');
      await provider.open(deviceId: 'device-a', doorId: 'door-a');
      expect(provider.operation?.status, DoorOperationStatus.confirmed);
      expect(provider.hasUnresolvedOperation, isTrue);
      await provider.open(deviceId: 'device-a', doorId: 'door-a');
      expect(repository.requests, hasLength(1));
      store.removeError = null;
      repository.onOperation = () async =>
          receipt(status: DoorOperationStatus.confirmed);
      await provider.checkStatus();
      expect(provider.hasUnresolvedOperation, isFalse);
      provider.dispose();
    },
  );
}
