import 'dart:async';
import 'package:ngsplusapp/models/visitor.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/visitor_provider.dart';
import 'package:ngsplusapp/services/visitor_create_intent_store.dart';
import '../auth_fakes.dart';
import 'visitor_fakes.dart';

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
