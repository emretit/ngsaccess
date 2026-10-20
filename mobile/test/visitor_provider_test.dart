import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/config/convex_config.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/models/visitor.dart';
import 'package:ngsplusapp/providers/visitor_provider.dart';
import 'package:ngsplusapp/repositories/visitor_repository.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'auth_fakes.dart';

Visitor visitorFixture(String id, {bool active = false, String? notes}) =>
    Visitor(
      id: id,
      firstName: 'Synthetic',
      lastName: id,
      visitStart: DateTime.utc(2030, 1, 1, 10),
      visitEnd: DateTime.utc(2030, 1, 1, 11),
      status: active
          ? VisitorAccessStatus.active
          : VisitorAccessStatus.preRegistered,
      canEdit: !active,
      phone: '+900000000000',
      purpose: 'Synthetic visit',
      notes: notes,
    );

VisitorPage visitorPage(List<Visitor> rows) =>
    VisitorPage(visitors: rows, cursor: 'done', isDone: true);

class FakeVisitorRepository extends VisitorRepository {
  FakeVisitorRepository()
    : super(HttpConvexClient(deploymentUrl: 'https://synthetic.convex.cloud'));
  String? session = 'A';
  int listCalls = 0, cancelCalls = 0, createCalls = 0, summaryCalls = 0;
  final requests = <String>[];
  VisitorDraft? updatedDraft;
  Future<VisitorPage> Function()? listResult;
  Future<Visitor> Function(String)? detailResult;
  Future<VisitorSummary> Function()? summaryResult;
  final filters =
      <({String? cursor, String search, VisitorAccessStatus? status})>[];
  Future<bool> Function(String)? cancelResult;
  Future<String> Function()? createResult;
  @override
  String? get sessionKey => session;
  @override
  Future<VisitorPage> list({
    String? cursor,
    String search = '',
    VisitorAccessStatus? status,
  }) {
    listCalls++;
    filters.add((cursor: cursor, search: search, status: status));
    return listResult?.call() ?? Future.value(visitorPage([]));
  }

  @override
  Future<VisitorSummary> summary() {
    summaryCalls++;
    return summaryResult?.call() ??
        Future.value(
          const VisitorSummary(total: 0, counts: {}, overflow: false),
        );
  }

  @override
  Future<Visitor> detail(String id) =>
      detailResult?.call(id) ?? Future.value(visitorFixture(id));
  @override
  Future<VisitorNotice> notice() async => const VisitorNotice();
  @override
  Future<bool> cancel(String id) {
    cancelCalls++;
    return cancelResult?.call(id) ?? Future.value(true);
  }

  @override
  Future<String> create(
    VisitorDraft draft, {
    required String requestId,
    required VisitorNotice notice,
    required bool noticeReviewed,
  }) {
    createCalls++;
    requests.add(requestId);
    return createResult?.call() ?? Future.value('created');
  }

  @override
  Future<void> update(String id, VisitorDraft draft) async {
    updatedDraft = draft;
  }
}

void main() {
  test(
    'a delayed A list cannot overwrite B data or loading after session change',
    () async {
      final repo = FakeVisitorRepository();
      final provider = VisitorProvider(repository: repo);
      addTearDown(provider.dispose);
      final a = Completer<VisitorPage>();
      final b = Completer<VisitorPage>();
      repo.listResult = () => a.future;
      final old = provider.refresh();
      repo.session = 'B';
      provider.synchronizeSession();
      repo.listResult = () => b.future;
      final current = provider.refresh();
      b.complete(visitorPage([visitorFixture('B')]));
      await current;
      a.complete(visitorPage([visitorFixture('A')]));
      await old;
      expect(provider.visitors.single.id, 'B');
      expect(provider.error, isNull);
      expect(provider.loading, isFalse);
    },
  );

  test(
    'late A detail and mutation failure cannot expose contact data or errors in B',
    () async {
      final repo = FakeVisitorRepository();
      final provider = VisitorProvider(repository: repo);
      addTearDown(provider.dispose);
      final detail = Completer<Visitor>();
      final cancelled = Completer<bool>();
      repo.detailResult = (_) => detail.future;
      repo.cancelResult = (_) => cancelled.future;
      final oldDetail = provider.openDetail('A');
      final oldCancel = provider.cancel('A');
      repo.session = 'B';
      provider.synchronizeSession();
      detail.complete(visitorFixture('A'));
      cancelled.completeError(const TimeoutError());
      await oldDetail;
      expect(await oldCancel, isNull);
      expect(provider.selected, isNull);
      expect(provider.mutationError, isNull);
      expect(provider.busy, isFalse);
    },
  );

  test(
    'a failed refresh preserves successful data with an explicit error',
    () async {
      final repo = FakeVisitorRepository()
        ..listResult = () async => visitorPage([visitorFixture('existing')]);
      final provider = VisitorProvider(repository: repo);
      addTearDown(provider.dispose);
      await provider.refresh();
      repo.listResult = () => Future.error(const NetworkError());
      await provider.refresh();
      expect(provider.visitors.single.id, 'existing');
      expect(provider.loaded, isTrue);
      expect(provider.error, isA<NetworkError>());
    },
  );

  test('ownership denial clears previously visible detail PII', () async {
    final repo = FakeVisitorRepository();
    final provider = VisitorProvider(repository: repo);
    addTearDown(provider.dispose);
    await provider.openDetail('own');
    expect(provider.selected?.phone, isNotNull);
    repo.detailResult = (_) =>
        Future.error(const BusinessError(message: '', code: 'ACCESS_DENIED'));
    await provider.openDetail('own');
    expect(provider.selected, isNull);
    expect(provider.detailError, isA<BusinessError>());
  });

  test(
    'ambiguous create retains the same intent across retries and clears on logout',
    () async {
      final repo = FakeVisitorRepository()
        ..createResult = () => Future.error(const TimeoutError());
      final provider = VisitorProvider(repository: repo);
      addTearDown(provider.dispose);
      final draft = VisitorDraft(
        firstName: 'Synthetic',
        lastName: 'Visitor',
        phone: '000',
        purpose: 'Visit',
        start: DateTime.utc(2030),
        end: DateTime.utc(2030, 1, 1, 1),
      );
      expect(
        await provider.save(
          draft,
          requestId: 'first',
          notice: const VisitorNotice(),
          noticeReviewed: false,
        ),
        isFalse,
      );
      expect(provider.pendingCreate?.requestId, 'first');
      expect(
        await provider.save(
          draft,
          id: 'existing',
          requestId: 'ignored',
          notice: const VisitorNotice(),
          noticeReviewed: false,
        ),
        isTrue,
      );
      expect(
        provider.pendingCreate?.requestId,
        'first',
      ); // Editing another record cannot discard unresolved create intent.
      repo.createResult = () async => 'created';
      expect(
        await provider.save(
          draft,
          requestId: 'different',
          notice: const VisitorNotice(),
          noticeReviewed: false,
        ),
        isTrue,
      );
      expect(repo.requests, ['first', 'first']);
      expect(provider.pendingCreate, isNull);
      repo.createResult = () => Future.error(const TimeoutError());
      await provider.save(
        draft,
        requestId: 'second',
        notice: const VisitorNotice(),
        noticeReviewed: false,
      );
      repo.session = null;
      provider.synchronizeSession();
      expect(provider.pendingCreate, isNull);
      expect(provider.visitors, isEmpty);
    },
  );

  testWidgets(
    'polling runs only while visible and stops on logout and dispose',
    (tester) async {
      final repo = FakeVisitorRepository();
      final provider = VisitorProvider(repository: repo);
      provider.setVisible(true);
      await tester.pump();
      expect(repo.listCalls, 1);
      await tester.pump(const Duration(seconds: 30));
      expect(repo.listCalls, 2);
      provider.setVisible(false);
      await tester.pump(const Duration(seconds: 60));
      expect(repo.listCalls, 2);
      provider.setVisible(true);
      await tester.pump();
      repo.session = null;
      provider.synchronizeSession();
      final stopped = repo.listCalls;
      await tester.pump(const Duration(seconds: 60));
      expect(repo.listCalls, stopped);
      provider.dispose();
      await tester.pump(const Duration(seconds: 60));
      expect(repo.listCalls, stopped);
    },
  );

  test(
    'auth logout clears PII immediately while the HTTP client still has its previous token',
    () async {
      final auth = AuthProvider(
        repository: FakeAuthRepository(),
        sessionStore: FakeSessionStore(),
      );
      addTearDown(auth.dispose);
      await auth.signIn('synthetic@example.test', 'synthetic-test-password');
      final repo = FakeVisitorRepository()..session = auth.sessionToken;
      final provider = VisitorProvider(repository: repo);
      addTearDown(provider.dispose);
      provider.synchronizeSession(auth);
      await provider.openDetail('own');
      expect(provider.selected?.phone, isNotNull);
      final logout = auth.signOut();
      provider.synchronizeSession(auth);
      expect(
        repo.sessionKey,
        isNotNull,
      ); // Transport cleanup deliberately lags.
      expect(provider.selected, isNull);
      final before = repo.listCalls;
      await provider.refresh();
      expect(repo.listCalls, before);
      await logout;
    },
  );

  test(
    'filter changes discard a stale archive page and reset its cursor',
    () async {
      final repo = FakeVisitorRepository();
      repo.listResult = () async => VisitorPage(
        visitors: [visitorFixture('initial')],
        cursor: 'old-cursor',
        isDone: false,
      );
      final provider = VisitorProvider(repository: repo);
      addTearDown(provider.dispose);
      await provider.refresh();
      final archive = Completer<VisitorPage>();
      final filtered = Completer<VisitorPage>();
      repo.listResult = () => archive.future;
      final old = provider.refresh(more: true);
      expect(repo.filters.last.cursor, 'old-cursor');
      repo.listResult = () => filtered.future;
      provider.setFilters(
        search: 'IŞIL',
        status: VisitorAccessStatus.preRegistered,
      );
      expect(repo.filters.last.cursor, isNull);
      expect(repo.filters.last.search, 'IŞIL');
      expect(repo.filters.last.status, VisitorAccessStatus.preRegistered);
      filtered.complete(visitorPage([visitorFixture('filtered')]));
      await filtered.future;
      await Future<void>.value();
      archive.complete(visitorPage([visitorFixture('stale-archive')]));
      await old;
      expect(provider.visitors.map((row) => row.id), ['filtered']);
      expect(provider.error, isNull);
      expect(provider.loading, isFalse);
    },
  );

  test(
    'independent summary totals do not grow when archive pages are appended',
    () async {
      final repo = FakeVisitorRepository();
      repo.summaryResult = () async => const VisitorSummary(
        total: 80,
        counts: {VisitorAccessStatus.preRegistered: 80},
        overflow: false,
      );
      repo.listResult = () async => VisitorPage(
        visitors: [visitorFixture('first')],
        cursor: 'next',
        isDone: false,
      );
      final provider = VisitorProvider(repository: repo);
      addTearDown(provider.dispose);
      await provider.refresh();
      await Future<void>.value();
      expect(provider.summary?.total, 80);
      repo.listResult = () async => visitorPage([visitorFixture('second')]);
      await provider.refresh(more: true);
      expect(provider.visitors.length, 2);
      expect(provider.summary?.total, 80);
      expect(repo.summaryCalls, 1);
    },
  );

  test('a delayed A summary cannot overwrite B independent totals', () async {
    final repo = FakeVisitorRepository();
    final oldSummary = Completer<VisitorSummary>();
    repo.summaryResult = () => oldSummary.future;
    final provider = VisitorProvider(repository: repo);
    addTearDown(provider.dispose);
    await provider.refresh();
    repo.session = 'B';
    provider.synchronizeSession();
    repo.summaryResult = () async => const VisitorSummary(
      total: 2,
      counts: {VisitorAccessStatus.preRegistered: 2},
      overflow: false,
    );
    await provider.refresh();
    await Future<void>.value();
    oldSummary.complete(
      const VisitorSummary(
        total: 999,
        counts: {VisitorAccessStatus.preRegistered: 999},
        overflow: false,
      ),
    );
    await oldSummary.future;
    await Future<void>.value();
    expect(provider.summary?.total, 2);
    expect(provider.summaryLoading, isFalse);
    expect(provider.summaryError, isNull);
  });

  test('dispose makes late completion inert', () async {
    final repo = FakeVisitorRepository();
    final result = Completer<VisitorPage>();
    repo.listResult = () => result.future;
    final provider = VisitorProvider(repository: repo);
    var notifications = 0;
    provider.addListener(() => notifications++);
    final pending = provider.refresh();
    provider.dispose();
    final before = notifications;
    result.complete(visitorPage([visitorFixture('late')]));
    await pending;
    expect(notifications, before);
  });
}
