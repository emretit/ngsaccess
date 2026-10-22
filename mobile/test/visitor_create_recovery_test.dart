import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ngsplusapp/config/convex_config.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/models/visitor.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/visitor_provider.dart';
import 'package:ngsplusapp/repositories/visitor_repository.dart';
import 'package:ngsplusapp/services/visitor_create_intent_store.dart';

import 'auth_fakes.dart';
import 'visitor_provider_test.dart' show FakeVisitorRepository;

const firstRequest = '11111111-1111-4111-8111-111111111111';
const newRequest = '22222222-2222-4222-8222-222222222222';
const scopeA = VisitorCreateScope(
  employeeId: 'employee-a',
  projectId: 'project-a',
  deployment: 'https://synthetic.convex.cloud',
);
const scopeB = VisitorCreateScope(
  employeeId: 'employee-b',
  projectId: 'project-b',
  deployment: 'https://synthetic.convex.cloud',
);

VisitorDraft recoveryDraft({String name = 'Synthetic'}) => VisitorDraft(
  firstName: name,
  lastName: 'Recovery',
  phone: '+900000000000',
  notes: 'Private synthetic note',
  purpose: 'Synthetic visit',
  start: DateTime.utc(2030),
  end: DateTime.utc(2030, 1, 1, 1),
);

Future<bool> saveDraft(
  VisitorProvider provider, {
  String request = firstRequest,
}) => provider.save(
  recoveryDraft(),
  requestId: request,
  notice: const VisitorNotice(),
  noticeReviewed: false,
);

class MemoryVisitorIntents implements VisitorCreateIntentStore {
  final values = <VisitorCreateScope, String>{};
  bool failRead = false, failWrite = false, failRemove = false;
  Completer<void>? claimGate, readGate;
  @override
  Future<String?> read(VisitorCreateScope scope) async {
    await readGate?.future;
    if (failRead) throw StateError('synthetic read failure');
    return values[scope];
  }

  @override
  Future<String> claim(VisitorCreateScope scope, String requestId) async {
    await claimGate?.future;
    if (failWrite) throw StateError('synthetic write failure');
    return values.putIfAbsent(scope, () => requestId);
  }

  @override
  Future<void> remove(VisitorCreateScope scope, String requestId) async {
    if (failRemove) throw StateError('synthetic cleanup failure');
    if (values[scope] == requestId) values.remove(scope);
  }
}

class RecoveryVisitors extends FakeVisitorRepository {
  int receiptCalls = 0, noticeCalls = 0;
  String? receipt;
  Future<String?> Function(String)? receiptResult;
  @override
  Future<String?> getCreateReceipt(String requestId) {
    receiptCalls++;
    return receiptResult?.call(requestId) ?? Future.value(receipt);
  }

  @override
  Future<VisitorNotice> notice() async {
    noticeCalls++;
    return const VisitorNotice();
  }
}

Future<AuthProvider> recoveryAuth({FakeSessionStore? store}) async {
  final auth = AuthProvider(
    repository: FakeAuthRepository(),
    sessionStore: store ?? FakeSessionStore(),
  );
  await auth.signIn('a@example.test', 'synthetic-password');
  return auth;
}

/// Synthetic server with the existing create fingerprint/idempotency contract.
/// This exercises real HTTP decoding and disk persistence without a deployment.
class SyntheticVisitorServer {
  SyntheticVisitorServer(this.store);
  final VisitorCreateIntentStore store;
  final records = <String, Map<String, Object?>>{};
  final createRequests = <String>[];
  bool loseResponse = true, hideReceipt = false;
  int receiptCalls = 0;

  Future<http.Response> handle(http.Request request) async {
    final body = jsonDecode(request.body) as Map<String, Object?>;
    final args = (body['args'] as List<Object?>).single as Map<String, Object?>;
    expect(args['sessionToken'], 'test-session-a');
    Object? value;
    switch (body['path']) {
      case 'mobileVisitors:create':
        final requestId = args['requestId'] as String;
        createRequests.add(requestId);
        expect(
          await store.read(scopeA),
          requestId,
          reason: 'The durable intent must exist before mutation transport',
        );
        final payload = Map<String, Object?>.of(args)..remove('sessionToken');
        final prior = records[requestId];
        if (prior != null && jsonEncode(prior) != jsonEncode(payload)) {
          return http.Response(
            jsonEncode({
              'status': 'error',
              'errorMessage': 'synthetic conflict',
              'errorData': {'code': 'REQUEST_CONFLICT'},
            }),
            560,
          );
        }
        records.putIfAbsent(requestId, () => payload);
        if (loseResponse) {
          throw TimeoutException('synthetic committed response loss');
        }
        value = {'id': 'visitor-$requestId'};
      case 'mobileVisitors:getCreateReceipt':
        receiptCalls++;
        final requestId = args['requestId'] as String;
        value = !hideReceipt && records.containsKey(requestId)
            ? {'id': 'visitor-$requestId', 'status': 'preRegistered'}
            : null;
      case 'mobileVisitors:listPage':
        value = {
          'page': [
            for (final entry in records.entries)
              {
                'id': 'visitor-${entry.key}',
                'firstName': entry.value['firstName'],
                'lastName': entry.value['lastName'],
                'visitStart': entry.value['visitStart'],
                'visitEnd': entry.value['visitEnd'],
                'status': 'preRegistered',
                'canEdit': true,
              },
          ],
          'isDone': true,
          'continueCursor': 'done',
          'scanLimited': false,
        };
      case 'mobileVisitors:summary':
        value = {
          'total': records.length,
          'counts': {
            'preRegistered': records.length,
            'active': 0,
            'checkedOut': 0,
            'expired': 0,
          },
          'overflow': false,
        };
      default:
        throw StateError('Unexpected synthetic endpoint ${body['path']}');
    }
    return http.Response(
      jsonEncode({'status': 'success', 'value': value}),
      200,
    );
  }
}

void main() {
  test(
    'logout releases background recovery and notice waiters without sending transport',
    () async {
      final auth = await recoveryAuth();
      addTearDown(auth.dispose);
      final store = MemoryVisitorIntents()..values[scopeA] = firstRequest;
      final repo = RecoveryVisitors()..session = auth.sessionToken;
      final state = VisitorProvider(repository: repo, createIntentStore: store);
      addTearDown(state.dispose);
      state.synchronizeSession(auth);
      state.setForeground(false);
      final checking = state.reconcileCreate();
      final notice = state.loadNotice();
      await Future<void>.delayed(Duration.zero);
      expect(repo.receiptCalls, 0);
      expect(repo.noticeCalls, 0);
      await auth.signOut();
      state.synchronizeSession(auth);
      expect(await checking, isNull);
      expect(await notice, isNull);
      expect(repo.receiptCalls, 0);
      expect(repo.noticeCalls, 0);
      expect(store.values[scopeA], firstRequest);
      expect(state.createRecoveryLoading, isFalse);
    },
  );

  test(
    'dispose releases foreground waiters without applying a stale recovery',
    () async {
      final auth = await recoveryAuth();
      addTearDown(auth.dispose);
      final store = MemoryVisitorIntents()..values[scopeA] = firstRequest;
      final repo = RecoveryVisitors()..session = auth.sessionToken;
      final state = VisitorProvider(repository: repo, createIntentStore: store);
      state.synchronizeSession(auth);
      state.setForeground(false);
      final checking = state.reconcileCreate();
      final notice = state.loadNotice();
      await Future<void>.delayed(Duration.zero);
      state.dispose();
      expect(await checking, isNull);
      expect(await notice, isNull);
      expect(repo.receiptCalls, 0);
      expect(repo.noticeCalls, 0);
      expect(store.values[scopeA], firstRequest);
    },
  );

  test(
    'lost committed HTTP response reconciles after provider/client/store recreation',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'visitor-recovery-',
      );
      addTearDown(() => directory.delete(recursive: true));
      final store = FileVisitorCreateIntentStore(
        directory: () async => directory,
      );
      final server = SyntheticVisitorServer(store);
      final sessions = FakeSessionStore();
      final auth = await recoveryAuth(store: sessions);
      final client = HttpConvexClient(
        deploymentUrl: scopeA.deployment,
        httpClient: MockClient(server.handle),
        maxRetries: 0,
      );
      await client.setAuth(
        token: auth.sessionToken ?? (throw StateError('No test session')),
      );
      final first = VisitorProvider(
        repository: VisitorRepository(client),
        createIntentStore: store,
      );
      first.synchronizeSession(auth);
      expect(await saveDraft(first), isFalse);
      expect(first.mutationError, isA<TimeoutError>());
      expect(server.records, hasLength(1));
      expect(await store.read(scopeA), firstRequest);
      first.dispose();
      client.close();
      auth.dispose();

      final restoredAuth = AuthProvider(
        repository: FakeAuthRepository(),
        sessionStore: sessions,
      );
      await restoredAuth.bootstrap();
      addTearDown(restoredAuth.dispose);
      final restoredClient = HttpConvexClient(
        deploymentUrl: scopeA.deployment,
        httpClient: MockClient(server.handle),
        maxRetries: 0,
      );
      addTearDown(restoredClient.close);
      await restoredClient.setAuth(
        token:
            restoredAuth.sessionToken ??
            (throw StateError('No restored session')),
      );
      final restored = VisitorProvider(
        repository: VisitorRepository(restoredClient),
        createIntentStore: FileVisitorCreateIntentStore(
          directory: () async => directory,
        ),
      );
      addTearDown(restored.dispose);
      restored.synchronizeSession(restoredAuth);
      expect(
        restored.pendingCreate,
        isNull,
        reason: 'No form PII survives recreation',
      );
      expect(await restored.reconcileCreate(), 'visitor-$firstRequest');
      await restored.refresh();
      expect(restored.visitors.single.id, 'visitor-$firstRequest');
      expect(restored.summaryError, isNull);
      expect(server.createRequests, [firstRequest]);
      expect(server.records, hasLength(1));
      expect(await store.read(scopeA), isNull);
    },
  );

  test(
    'null receipt after recreation retains same ID and explicit replay stays one record',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'visitor-null-receipt-',
      );
      addTearDown(() => directory.delete(recursive: true));
      final store = FileVisitorCreateIntentStore(
        directory: () async => directory,
      );
      final server = SyntheticVisitorServer(store)..hideReceipt = true;
      final auth = await recoveryAuth();
      addTearDown(auth.dispose);
      final client = HttpConvexClient(
        deploymentUrl: scopeA.deployment,
        httpClient: MockClient(server.handle),
        maxRetries: 0,
      );
      addTearDown(client.close);
      await client.setAuth(
        token: auth.sessionToken ?? (throw StateError('No test session')),
      );
      final first = VisitorProvider(
        repository: VisitorRepository(client),
        createIntentStore: store,
      );
      first.synchronizeSession(auth);
      expect(await saveDraft(first), isFalse);
      first.dispose();
      final restored = VisitorProvider(
        repository: VisitorRepository(client),
        createIntentStore: FileVisitorCreateIntentStore(
          directory: () async => directory,
        ),
      );
      addTearDown(restored.dispose);
      restored.synchronizeSession(auth);
      expect(await restored.reconcileCreate(), isNull);
      expect(restored.recoveryRequestId, firstRequest);
      expect(server.createRequests, [firstRequest]);
      // Re-entering a different payload cannot commit another visitor under this ID.
      server.loseResponse = false;
      expect(
        await restored.save(
          recoveryDraft(name: 'Changed'),
          requestId: newRequest,
          notice: const VisitorNotice(),
          noticeReviewed: false,
        ),
        isFalse,
      );
      expect(await store.read(scopeA), firstRequest);
      expect(server.records, hasLength(1));
      expect(await saveDraft(restored, request: newRequest), isTrue);
      expect(server.createRequests, [firstRequest, firstRequest, firstRequest]);
      expect(server.records, hasLength(1));
    },
  );

  test(
    'store read/write failure sends no mutation and can be retried safely',
    () async {
      final auth = await recoveryAuth();
      addTearDown(auth.dispose);
      final store = MemoryVisitorIntents()..failRead = true;
      final repo = RecoveryVisitors()..session = auth.sessionToken;
      final state = VisitorProvider(repository: repo, createIntentStore: store);
      addTearDown(state.dispose);
      state.synchronizeSession(auth);
      expect(await saveDraft(state), isFalse);
      expect(repo.createCalls, 0);
      expect(state.createRecoveryStorageFailed, isTrue);
      store.failRead = false;
      store.failWrite = true;
      expect(await saveDraft(state), isFalse);
      expect(repo.createCalls, 0);
      store.failWrite = false;
      expect(await saveDraft(state), isTrue);
      expect(repo.requests, [firstRequest]);
    },
  );

  test(
    'cleanup failure keeps intent and receipt retry never sends another create',
    () async {
      final auth = await recoveryAuth();
      addTearDown(auth.dispose);
      final store = MemoryVisitorIntents()..failRemove = true;
      final repo = RecoveryVisitors()..session = auth.sessionToken;
      final state = VisitorProvider(repository: repo, createIntentStore: store);
      addTearDown(state.dispose);
      state.synchronizeSession(auth);
      expect(await saveDraft(state), isFalse);
      expect(store.values[scopeA], firstRequest);
      store.failRemove = false;
      repo.receipt = 'already-created';
      expect(await saveDraft(state, request: newRequest), isTrue);
      expect(repo.requests, [firstRequest]);
      expect(store.values, isEmpty);
    },
  );

  test(
    'logout clears PII while outstanding scoped intent survives same-account relogin',
    () async {
      final auth = await recoveryAuth();
      addTearDown(auth.dispose);
      final store = MemoryVisitorIntents();
      final repo = RecoveryVisitors()
        ..session = auth.sessionToken
        ..createResult = () => Future.error(const TimeoutError());
      final state = VisitorProvider(repository: repo, createIntentStore: store);
      addTearDown(state.dispose);
      state.synchronizeSession(auth);
      expect(await saveDraft(state), isFalse);
      expect(state.pendingCreate, isNotNull);
      await auth.signOut();
      state.synchronizeSession(auth);
      expect(state.pendingCreate, isNull);
      expect(state.recoveryRequestId, isNull);
      expect(store.values[scopeA], firstRequest);
      expect(await store.read(scopeB), isNull);
      await auth.signIn('a@example.test', 'synthetic-password');
      repo.session = auth.sessionToken;
      state.synchronizeSession(auth);
      await state.reconcileCreate();
      expect(state.recoveryRequestId, firstRequest);
    },
  );

  test(
    'late receipt from A cannot clear B metadata or expose A recovery state',
    () async {
      final authRepo = FakeAuthRepository();
      final auth = AuthProvider(
        repository: authRepo,
        sessionStore: FakeSessionStore(),
      );
      addTearDown(auth.dispose);
      await auth.signIn('a@example.test', 'synthetic-password');
      final store = MemoryVisitorIntents()
        ..values[scopeA] = firstRequest
        ..values[scopeB] = newRequest;
      final receipt = Completer<String?>();
      final repo = RecoveryVisitors()
        ..session = auth.sessionToken
        ..receiptResult = (_) => receipt.future;
      final state = VisitorProvider(repository: repo, createIntentStore: store);
      addTearDown(state.dispose);
      state.synchronizeSession(auth);
      final oldRecovery = state.reconcileCreate();
      await Future<void>.delayed(Duration.zero);
      await auth.signOut();
      state.synchronizeSession(auth);
      authRepo.onSignIn = (_, _) async =>
          authResult(token: 'session-b', user: otherAuthTestUser);
      await auth.signIn('b@example.test', 'synthetic-password');
      repo.session = auth.sessionToken;
      state.synchronizeSession(auth);
      receipt.complete('a-receipt');
      await oldRecovery;
      expect(store.values[scopeA], firstRequest);
      expect(store.values[scopeB], newRequest);
      expect(state.recoveryRequestId, isNull);
      repo.receiptResult = null;
      await state.reconcileCreate();
      expect(state.recoveryRequestId, newRequest);
    },
  );

  test(
    'auth expiry drops visible intent and rejects a late receipt without deleting recovery metadata',
    () async {
      final auth = await recoveryAuth();
      addTearDown(auth.dispose);
      final store = MemoryVisitorIntents()..values[scopeA] = firstRequest;
      final receipt = Completer<String?>();
      final repo = RecoveryVisitors()
        ..session = auth.sessionToken
        ..receiptResult = (_) => receipt.future;
      final state = VisitorProvider(repository: repo, createIntentStore: store);
      addTearDown(state.dispose);
      state.synchronizeSession(auth);
      final checking = state.reconcileCreate();
      await Future<void>.delayed(Duration.zero);
      await auth.handleAuthExpiry(
        sessionToken: auth.sessionToken,
        sessionEpoch: auth.sessionEpoch,
      );
      state.synchronizeSession(auth);
      receipt.complete('expired-account-receipt');
      await checking;
      expect(state.recoveryRequestId, isNull);
      expect(state.pendingCreate, isNull);
      expect(state.createRecoveryError, isNull);
      expect(store.values[scopeA], firstRequest);
      expect(repo.createCalls, 0);
    },
  );

  test(
    'a delayed A persistence claim cannot send after account switch or replace B intent',
    () async {
      final authRepo = FakeAuthRepository();
      final auth = AuthProvider(
        repository: authRepo,
        sessionStore: FakeSessionStore(),
      );
      addTearDown(auth.dispose);
      await auth.signIn('a@example.test', 'synthetic-password');
      final gate = Completer<void>();
      final store = MemoryVisitorIntents()
        ..values[scopeB] = newRequest
        ..claimGate = gate;
      final repo = RecoveryVisitors()..session = auth.sessionToken;
      final state = VisitorProvider(repository: repo, createIntentStore: store);
      addTearDown(state.dispose);
      state.synchronizeSession(auth);
      final saving = saveDraft(state);
      await Future<void>.delayed(Duration.zero);
      await auth.signOut();
      state.synchronizeSession(auth);
      authRepo.onSignIn = (_, _) async =>
          authResult(token: 'session-b', user: otherAuthTestUser);
      await auth.signIn('b@example.test', 'synthetic-password');
      repo.session = auth.sessionToken;
      state.synchronizeSession(auth);
      gate.complete();
      expect(await saving, isFalse);
      expect(repo.createCalls, 0);
      expect(state.recoveryRequestId, isNull);
      expect(store.values[scopeA], firstRequest);
      expect(store.values[scopeB], newRequest);
    },
  );

  test(
    'disk store is scoped, metadata only, atomic across replacements and fails closed on corruption',
    () async {
      final directory = await Directory.systemTemp.createTemp('visitor-store-');
      addTearDown(() => directory.delete(recursive: true));
      final store = FileVisitorCreateIntentStore(
        directory: () async => directory,
      );
      final replacement = FileVisitorCreateIntentStore(
        directory: () async => directory,
      );
      expect(
        await Future.wait([
          store.claim(scopeA, firstRequest),
          replacement.claim(scopeA, newRequest),
        ]),
        [firstRequest, firstRequest],
      );
      expect(await replacement.read(scopeB), isNull);
      const otherDeployment = VisitorCreateScope(
        employeeId: 'employee-a',
        projectId: 'project-a',
        deployment: 'https://other.convex.cloud',
      );
      expect(await replacement.read(otherDeployment), isNull);
      final files = await directory
          .list(recursive: true)
          .where((entry) => entry is File)
          .cast<File>()
          .toList();
      final json =
          jsonDecode(await files.single.readAsString()) as Map<String, Object?>;
      expect(json.keys.toSet(), {
        'version',
        'employeeId',
        'projectId',
        'deployment',
        'requestId',
      });
      await replacement.remove(scopeA, newRequest);
      expect(await store.read(scopeA), firstRequest);
      final temporary = File('${files.single.path}.pending');
      await temporary.writeAsString('{partial', flush: true);
      await expectLater(store.read(scopeA), throwsFormatException);
      await expectLater(store.claim(scopeA, newRequest), throwsFormatException);
      expect(await files.single.readAsString(), contains(firstRequest));
    },
  );
}
