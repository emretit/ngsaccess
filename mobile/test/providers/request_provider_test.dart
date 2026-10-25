import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/models/employee_request.dart';
import 'package:ngsplusapp/providers/request_provider.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/repositories/request_repository.dart';
import '../auth_fakes.dart';
import '../helpers/mocks.dart';

class RequestFakeRepository extends RequestRepository {
  RequestFakeRepository() : super(MockHttpConvexClient());
  int reads = 0, submits = 0, withdrawals = 0;
  Object? failure, readFailure, withdrawFailure;
  Completer<void>? withdrawGate;
  Completer<String>? gate;
  Completer<List<LeaveRequest>>? listGate;
  List<LeaveRequest> leaves = [];
  List<AttendanceCorrectionRequest> corrections = [];
  @override
  Future<List<LeaveRequest>> listLeaves() async {
    reads++;
    if (readFailure case final e?) throw e;
    return listGate == null ? leaves : listGate?.future ?? leaves;
  }

  @override
  Future<List<AttendanceCorrectionRequest>> listCorrections() async =>
      corrections;
  @override
  Future<String> submitLeave({
    required String leaveType,
    required String startDate,
    required String endDate,
    String? notes,
  }) async {
    submits++;
    if (failure case final e?) throw e;
    return gate == null ? 'id' : gate?.future ?? 'id';
  }

  @override
  Future<String> submitCorrection({
    required String date,
    required String correctionType,
    required String reason,
    String? requestedCheckIn,
    String? requestedCheckOut,
  }) async {
    submits++;
    if (failure case final e?) throw e;
    return gate == null ? 'id' : gate?.future ?? 'id';
  }

  @override
  Future<void> withdrawLeave(String id) async {
    withdrawals++;
    if (withdrawFailure case final e?) throw e;
    await withdrawGate?.future;
    leaves = [];
  }

  @override
  Future<void> withdrawCorrection(String id) async {
    withdrawals++;
    if (withdrawFailure case final e?) throw e;
    await withdrawGate?.future;
    corrections = [];
  }
}

LeaveRequest testLeave({
  String id = 'id',
  String status = 'pending',
  String? source = 'employee',
  String type = 'annual',
  String? decision,
}) => LeaveRequest(
  id: id,
  leaveType: type,
  startDate: '2026-10-19',
  endDate: '2026-10-20',
  status: status,
  source: source,
  createdAt: DateTime.utc(2026, 10, 19),
  decisionNote: decision,
);
AttendanceCorrectionRequest testCorrection({String status = 'pending'}) =>
    AttendanceCorrectionRequest(
      id: 'c1',
      date: '2026-10-19',
      correctionType: 'checkIn',
      reason: 'Gerekçe',
      status: status,
      createdAt: DateTime.utc(2026, 10, 19),
    );
void main() {
  late AuthProvider auth;
  late RequestProvider p;
  late RequestFakeRepository repo;
  void sync() => p.synchronizeSession(auth);
  setUp(() async {
    auth = AuthProvider(
      repository: FakeAuthRepository(),
      sessionStore: FakeSessionStore(),
    );
    await auth.bootstrap();
    await auth.signIn('a@example.test', 'password');
    repo = RequestFakeRepository();
    p = RequestProvider(repository: repo);
    auth.addListener(sync);
    p.synchronizeSession(auth);
  });
  tearDown(() {
    auth.removeListener(sync);
    p.dispose();
    auth.dispose();
  });
  Future<bool> submit() => p.submitLeave(
    leaveType: 'annual',
    startDate: '2026-10-19',
    endDate: '2026-10-20',
  );
  test(
    'skipped busy or invalid-session command clears the previous withdraw error',
    () async {
      repo.withdrawFailure = const NetworkError();
      repo.listGate = Completer();
      final inFlight = p.withdrawLeave(testLeave());
      await Future<void>.delayed(Duration.zero);
      expect(p.busy, true);
      expect(p.commandError, isA<NetworkError>());
      expect(await p.withdrawLeave(testLeave()), false);
      expect(p.commandError, isNull);
      expect(repo.withdrawals, 1);
      repo.listGate?.complete([]);
      expect(await inFlight, false);
      await auth.signOut();
      p.commandError = const ProtocolError();
      expect(await p.withdrawLeave(testLeave()), false);
      expect(p.commandError, isNull);
    },
  );
  for (final failure in <AppError>[
    const NetworkError(),
    const TimeoutError(),
    const ServerError(statusCode: 500),
    const ServerError(statusCode: 503),
    const ProtocolError(),
  ]) {
    for (final correction in [false, true]) {
      test(
        'uncertain ${failure.runtimeType} ${correction ? "correction" : "leave"} withdraw sends once and refreshes once',
        () async {
          repo.withdrawFailure = failure;
          expect(
            await (correction
                ? p.withdrawCorrection(testCorrection())
                : p.withdrawLeave(testLeave())),
            false,
          );
          expect(repo.withdrawals, 1);
          expect(repo.reads, 1);
          expect(p.uncertain, true);
          expect(p.commandError, failure);
          expect(p.busy, false);
        },
      );
    }
  }
  for (final failure in <AppError>[
    const ServerError(statusCode: 500),
    const ServerError(statusCode: 503),
    const ProtocolError(),
  ]) {
    for (final correction in [false, true]) {
      test(
        'uncertain ${failure.runtimeType} ${correction ? "correction" : "leave"} submit sends once and refreshes once',
        () async {
          repo.failure = failure;
          final success = await (correction
              ? p.submitCorrection(
                  date: '2026-10-19',
                  correctionType: 'checkIn',
                  requestedCheckIn: '09:00',
                  reason: 'Gerekçe',
                )
              : submit());
          expect(success, false);
          expect(repo.submits, 1);
          expect(repo.reads, 1);
          expect(p.uncertain, true);
          expect(p.commandError, failure);
        },
      );
    }
  }
  for (final failure in <AppError>[
    const ServerError(statusCode: 560),
    const ServerError(statusCode: 400),
    const BusinessError(message: 'unsafe', code: 'REQUEST_NOT_PENDING'),
  ]) {
    test(
      '${failure.debugMessage} is a definitive rejection for submit and withdraw',
      () async {
        repo.failure = failure;
        repo.withdrawFailure = failure;
        expect(await submit(), false);
        expect(p.uncertain, false);
        expect(repo.reads, 0);
        expect(await p.withdrawLeave(testLeave()), false);
        expect(p.uncertain, false);
        expect(repo.reads, 0);
        expect(repo.submits, 1);
        expect(repo.withdrawals, 1);
      },
    );
  }
  test('empty/loading/error/data and explicit refresh only', () async {
    expect(p.leaves, isEmpty);
    expect(repo.reads, 0);
    repo.listGate = Completer();
    final load = p.refresh();
    expect(p.loading, true);
    repo.listGate?.complete([testLeave()]);
    await load;
    expect(p.loading, false);
    expect(p.leaves, hasLength(1));
    expect(repo.reads, 1);
    repo.listGate = null;
    repo.readFailure = const NetworkError();
    await p.refresh();
    expect(p.error, isA<NetworkError>());
    expect(p.loading, false);
    repo.readFailure = null;
    await p.refresh();
    expect(p.error, isNull);
    expect(p.leaves, isEmpty);
  });
  test(
    'both submits lock duplicate calls and refresh once on success',
    () async {
      repo.gate = Completer();
      final first = submit();
      expect(p.busy, true);
      expect(await submit(), false);
      expect(repo.submits, 1);
      repo.gate?.complete('id');
      expect(await first, true);
      expect(p.busy, false);
      expect(repo.reads, 1);
      repo.gate = Completer();
      final correction = p.submitCorrection(
        date: '2026-10-19',
        correctionType: 'checkIn',
        reason: 'Gerekçe',
        requestedCheckIn: '09:00',
      );
      expect(
        await p.submitCorrection(
          date: '2026-10-19',
          correctionType: 'checkIn',
          reason: 'Gerekçe',
        ),
        false,
      );
      repo.gate?.complete('id');
      expect(await correction, true);
      expect(repo.submits, 2);
      expect(repo.reads, 2);
    },
  );
  test(
    'network and timeout never resubmit, refresh list once, preserve uncertainty',
    () async {
      for (final error in [const NetworkError(), const TimeoutError()]) {
        repo.failure = error;
        final before = repo.submits, reads = repo.reads;
        expect(await submit(), false);
        expect(repo.submits, before + 1);
        expect(repo.reads, reads + 1);
        expect(p.uncertain, true);
        expect(p.commandError, error);
        expect(p.busy, false);
      }
      repo.failure = const BusinessError(
        message: 'unsafe',
        code: 'REQUEST_OVERLAP_PENDING',
      );
      final reads = repo.reads;
      await submit();
      expect(p.uncertain, false);
      expect(repo.reads, reads);
    },
  );
  test(
    'withdraw only own pending employee leave and pending correction then refresh',
    () async {
      for (final row in [
        testLeave(status: 'approved'),
        testLeave(source: 'admin'),
        testLeave(source: null),
      ]) {
        expect(await p.withdrawLeave(row), false);
      }
      expect(
        await p.withdrawCorrection(testCorrection(status: 'withdrawn')),
        false,
      );
      expect(repo.withdrawals, 0);
      expect(await p.withdrawLeave(testLeave()), true);
      expect(repo.withdrawals, 1);
      expect(repo.reads, 1);
      expect(await p.withdrawCorrection(testCorrection()), true);
      expect(repo.withdrawals, 2);
      expect(repo.reads, 2);
    },
  );
  test(
    'EMPLOYMENT_ENDED uses global auth path and clears request state',
    () async {
      repo.leaves = [testLeave()];
      await p.refresh();
      repo.failure = const EmploymentEndedError();
      expect(await submit(), false);
      await Future<void>.delayed(Duration.zero);
      expect(auth.isAuthenticated, false);
      expect(auth.phase, AuthPhase.unauthenticated);
      expect(auth.lastError, isA<EmploymentEndedError>());
      expect(p.leaves, isEmpty);
      expect(p.busy, false);
    },
  );
  test(
    'stale response after signout cannot publish another session data',
    () async {
      repo.listGate = Completer();
      final load = p.refresh();
      await auth.signOut();
      repo.listGate?.complete([testLeave()]);
      await load;
      expect(p.leaves, isEmpty);
      expect(p.loading, false);
    },
  );
}
