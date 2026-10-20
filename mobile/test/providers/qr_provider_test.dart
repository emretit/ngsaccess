import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/providers/qr_provider.dart';
import 'package:ngsplusapp/repositories/qr_repository.dart';

class MockQrRepository extends Mock implements QrRepository {}

void main() {
  final serverNow = DateTime.utc(2026, 10, 19, 12);
  late MockQrRepository repo;
  late QrProvider provider;
  late DateTime phoneNow;
  String? session;
  QrToken issued({QrTokenStatus status = QrTokenStatus.active}) => QrToken(
    value: 'fixture-token',
    expiresAt: serverNow.add(const Duration(seconds: 42)),
    serverTime: serverNow,
    status: status,
  );

  setUp(() {
    session = 'fixture-session-A';
    phoneNow = serverNow.add(const Duration(minutes: 5));
    repo = MockQrRepository();
    when(() => repo.sessionKey).thenAnswer((_) => session);
    provider = QrProvider(repository: repo, now: () => phoneNow);
  });
  tearDown(() => provider.dispose());

  test(
    'server expiry survives phone skew and subtracts network round trip',
    () async {
      final response = Completer<QrToken>();
      when(() => repo.createToken()).thenAnswer((_) => response.future);
      final pending = provider.refresh();
      phoneNow = phoneNow.add(const Duration(seconds: 2));
      response.complete(issued());
      await pending;
      expect(provider.remaining, const Duration(seconds: 40));
      expect(provider.status, QrViewStatus.active);
      phoneNow = phoneNow.add(const Duration(seconds: 40));
      expect(provider.status, QrViewStatus.expired);
      expect(provider.canDisplay, isFalse);
    },
  );

  test(
    'duplicate refresh clicks issue one mutation; refresh failure stays visible with old token',
    () async {
      when(() => repo.createToken()).thenAnswer((_) async => issued());
      await provider.refresh();
      final failure = Completer<QrToken>();
      when(() => repo.createToken()).thenAnswer((_) => failure.future);
      final first = provider.refresh();
      await provider.refresh();
      failure.completeError(const NetworkError());
      await first;
      verify(() => repo.createToken()).called(2);
      expect(provider.token, isNotNull);
      expect(provider.status, QrViewStatus.refreshFailed);
      expect(provider.isRefreshing, isFalse);
      expect(provider.error, isA<NetworkError>());
    },
  );

  test('A result and finally cannot replace B token or busy state', () async {
    final a = Completer<QrToken>();
    final b = Completer<QrToken>();
    when(() => repo.createToken()).thenAnswer((_) => a.future);
    final pendingA = provider.refresh();
    session = 'fixture-session-B';
    provider.synchronizeSession();
    when(() => repo.createToken()).thenAnswer((_) => b.future);
    final pendingB = provider.refresh();
    a.complete(issued());
    await pendingA;
    expect(provider.token, isNull);
    expect(provider.isRefreshing, isTrue);
    b.complete(
      QrToken(
        value: 'fixture-B',
        expiresAt: serverNow.add(const Duration(seconds: 42)),
        serverTime: serverNow,
      ),
    );
    await pendingB;
    expect(provider.token?.value, 'fixture-B');
  });

  test('late result after disposal emits no notification', () async {
    final isolated = QrProvider(repository: repo, now: () => phoneNow);
    final response = Completer<QrToken>();
    when(() => repo.createToken()).thenAnswer((_) => response.future);
    var notifications = 0;
    isolated.addListener(() => notifications++);
    final pending = isolated.refresh();
    isolated.dispose();
    final before = notifications;
    response.complete(issued());
    await pending;
    expect(notifications, before);
  });

  test(
    'consumption hides the code and status failure cannot advertise an unverified code',
    () async {
      final active = issued();
      when(() => repo.createToken()).thenAnswer((_) async => active);
      when(() => repo.tokenStatus(active)).thenThrow(const NetworkError());
      await provider.refresh();
      await provider.checkStatus();
      expect(provider.statusError, isA<NetworkError>());
      expect(provider.canDisplay, isFalse);
      when(
        () => repo.tokenStatus(active),
      ).thenAnswer((_) async => issued(status: QrTokenStatus.consumed));
      await provider.checkStatus();
      expect(provider.status, QrViewStatus.consumed);
      expect(provider.canDisplay, isFalse);
      expect(provider.statusError, isNull);
    },
  );

  test(
    'camera gate requires every lifecycle condition; modal and same-code repeats never rearm by time',
    () {
      final gate = QrScanGate()..scanSelected = true;
      expect(gate.observe(['fixture-code']), 'fixture-code');
      expect(gate.cameraAllowed, isFalse);
      gate.modalOpen = true;
      gate.busy = false;
      expect(gate.observe(['another-code']), isNull);
      gate.modalOpen = false;
      expect(gate.observe(['fixture-code']), isNull);
      gate.routeVisible = false;
      expect(gate.observe([]), isNull);
      gate.routeVisible = true;
      expect(gate.observe(['fixture-code']), isNull);
      expect(gate.observe([]), isNull);
      expect(gate.observe(['fixture-code']), 'fixture-code');
      gate.busy = false;
      gate.resumed = false;
      expect(gate.cameraAllowed, isFalse);
      gate.resumed = true;
      gate.scanSelected = false;
      expect(gate.cameraAllowed, isFalse);
    },
  );
}
