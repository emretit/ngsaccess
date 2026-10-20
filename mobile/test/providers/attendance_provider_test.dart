import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/config/convex_config.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/models/attendance.dart';
import 'package:ngsplusapp/models/attendance_page.dart';
import 'package:ngsplusapp/models/attendance_summary.dart';
import 'package:ngsplusapp/providers/attendance_provider.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/repositories/attendance_repository.dart';

import '../helpers/mocks.dart';

class _Auth extends AuthProvider {
  _Auth() : super(repository: MockAuthRepository());
  String? user;
  int epoch = 0;
  int expiries = 0;
  @override
  AuthUser? get currentUser => user == null
      ? null
      : AuthUser(
          id: user ?? '',
          email: '',
          firstName: '',
          lastName: '',
          cardNumber: '',
        );
  @override
  bool get isAuthenticated => user != null;
  @override
  String? get sessionToken => user == null ? null : 'test-session-$epoch';
  @override
  int get sessionEpoch => epoch;
  void change(String? id) {
    epoch++;
    user = id;
    notifyListeners();
  }

  @override
  Future<void> handleAuthExpiry({
    String? sessionToken,
    int? sessionEpoch,
  }) async {
    if (sessionEpoch != null && sessionEpoch != epoch) return;
    expiries++;
    change(null);
  }
}

class _PageCall {
  _PageCall(
    this.cursor,
    this.startDate,
    this.endDate,
    this.deviceId,
    this.numItems,
  );
  final String? cursor;
  final String? startDate;
  final String? endDate;
  final String? deviceId;
  final int numItems;
  final result = Completer<AttendancePage>();
}

class _Poll {
  _Poll(this.onUpdate, this.onError, this.numItems);
  final void Function(AttendancePage) onUpdate;
  final void Function(AppError) onError;
  final int numItems;
  bool cancelled = false;
}

class _Repo extends AttendanceRepository {
  _Repo() : super(MockHttpConvexClient());
  final calls = <_PageCall>[];
  final polls = <_Poll>[];
  final summaryCalls =
      <({String start, String end, Completer<AttendanceSummary> result})>[];
  final commands = <Completer<bool>>[];
  @override
  Future<AttendancePage> listPage({
    String? cursor,
    int numItems = 50,
    String? startDate,
    String? endDate,
    String? deviceId,
  }) {
    final call = _PageCall(cursor, startDate, endDate, deviceId, numItems);
    calls.add(call);
    return call.result.future;
  }

  @override
  Future<ConvexSubscriptionHandle> subscribePage({
    required void Function(AttendancePage) onUpdate,
    required void Function(AppError) onError,
    int numItems = 50,
    String? startDate,
    String? endDate,
    String? deviceId,
  }) async {
    final poll = _Poll(onUpdate, onError, numItems);
    polls.add(poll);
    return ConvexSubscriptionHandle(() => poll.cancelled = true);
  }

  @override
  Future<AttendanceSummary> summary({
    required String startDate,
    required String endDate,
  }) {
    final result = Completer<AttendanceSummary>();
    summaryCalls.add((start: startDate, end: endDate, result: result));
    return result.future;
  }

  @override
  Future<bool> selfCheckIn({String? deviceId, String? deviceSerial}) {
    final result = Completer<bool>();
    commands.add(result);
    return result.future;
  }
}

Attendance _record(
  String id, {
  String? deviceId = 'door',
  String? direction = 'entry',
  bool granted = true,
}) => Attendance(
  id: id,
  employeeId: 'employee',
  deviceId: deviceId,
  cardNo: '',
  employeeName: null,
  accessTime: DateTime.utc(2026, 10, 19, 6),
  granted: granted,
  direction: direction,
  deviceInfo: {'name': 'Same name'},
);
AttendancePage _page(
  List<Attendance> records, {
  bool done = true,
  String cursor = '',
}) => AttendancePage(page: records, isDone: done, continueCursor: cursor);
AttendanceSummary _summary(
  String start,
  String end, {
  int entries = 0,
  AttendanceDirection direction = AttendanceDirection.unknown,
}) => AttendanceSummary(
  startDate: start,
  endDate: end,
  generatedAt: DateTime.utc(2026, 10, 19, 7),
  days: [
    AttendanceDaySummary(
      date: start,
      entryCount: entries,
      exitCount: 0,
      deniedCount: 0,
      unknownCount: direction == AttendanceDirection.unknown && entries > 0
          ? 1
          : 0,
      firstEntry: entries == 0 ? null : DateTime.utc(2026, 10, 19, 6),
      lastEntry: entries == 0 ? null : DateTime.utc(2026, 10, 19, 6),
      lastExit: null,
      lastDirection: direction,
    ),
  ],
  totals: AttendanceTotals(
    entryCount: entries,
    exitCount: 0,
    deniedCount: 0,
    unknownCount: 0,
    presentDays: entries > 0 ? 1 : 0,
  ),
);
Future<void> _flush() => Future<void>.delayed(Duration.zero);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late _Repo repo;
  late _Auth auth;
  late AttendanceProvider provider;
  setUp(() {
    repo = _Repo();
    auth = _Auth();
    provider = AttendanceProvider(
      repository: repo,
      clock: () => DateTime.utc(2026, 10, 19, 12),
    );
    provider.didChangeAppLifecycleState(AppLifecycleState.resumed);
    provider.setAuthProvider(auth);
    auth.change('A');
  });
  tearDown(() {
    provider.dispose();
    auth.dispose();
  });

  test(
    'logout clears immediately; late list result/error/finally cannot touch B',
    () async {
      final old = provider.loadAttendanceRecords();
      auth.change(null);
      expect(provider.attendanceRecords, isEmpty);
      expect(provider.isLoading, isFalse);
      expect(provider.listError, isNull);
      auth.change('B');
      final fresh = provider.loadAttendanceRecords();
      repo.calls[1].result.complete(_page([_record('B')]));
      await fresh;
      repo.calls[0].result.completeError(const AuthExpiredError());
      await old;
      expect(provider.attendanceRecords.map((r) => r.id), ['B']);
      expect(provider.listError, isNull);
      expect(auth.expiries, 0);
      expect(auth.user, 'B');
    },
  );

  test(
    'latest manual refresh wins even when older success completes last',
    () async {
      final first = provider.loadAttendanceRecords();
      final second = provider.loadAttendanceRecords();
      repo.calls[1].result.complete(_page([_record('latest')]));
      await second;
      repo.calls[0].result.complete(_page([_record('old')]));
      await first;
      expect(provider.attendanceRecords.single.id, 'latest');
    },
  );

  test('old finally cannot clear busy state of a newer refresh', () async {
    final first = provider.loadAttendanceRecords();
    final second = provider.loadAttendanceRecords();
    repo.calls[0].result.complete(_page([_record('old')]));
    await first;
    expect(provider.isLoading, isTrue);
    repo.calls[1].result.complete(_page([]));
    await second;
    expect(provider.listLoaded, isTrue);
    expect(provider.isLoading, isFalse);
  });

  test(
    'same-user new session clears records and rejects old poll callbacks',
    () async {
      final oldPoll = repo.polls.last;
      oldPoll.onUpdate(_page([_record('old')]));
      auth.change('A');
      expect(provider.attendanceRecords, isEmpty);
      oldPoll.onUpdate(_page([_record('leak')]));
      oldPoll.onError(const AuthExpiredError());
      expect(provider.attendanceRecords, isEmpty);
      expect(auth.expiries, 0);
    },
  );

  test(
    'archive cursor remains fixed while live head changes and deduplicates IDs',
    () async {
      repo.polls.last.onUpdate(
        _page([_record('head')], done: false, cursor: 'boundary'),
      );
      final more = provider.loadMore();
      expect(repo.calls.single.cursor, 'boundary');
      repo.polls.last.onUpdate(
        _page([_record('new')], done: false, cursor: 'new-boundary'),
      );
      repo.calls.single.result.complete(
        _page(
          [_record('head'), _record('archive')],
          done: false,
          cursor: 'older',
        ),
      );
      await more;
      expect(provider.attendanceRecords.map((r) => r.id).toSet(), {
        'new',
        'head',
        'archive',
      });
      final next = provider.loadMore();
      expect(repo.calls.last.cursor, 'older');
      repo.calls.last.result.complete(_page([]));
      await next;
      expect(provider.hasMore, isFalse);
      expect(repo.polls.every((poll) => poll.numItems == 50), isTrue);
      expect(repo.calls.every((call) => call.numItems == 50), isTrue);
    },
  );

  test(
    'server device/date filter resets cursor and keeps identity facets',
    () async {
      repo.polls.last.onUpdate(
        _page(
          [_record('one', deviceId: '1'), _record('two', deviceId: '2')],
          done: false,
          cursor: 'old',
        ),
      );
      final filtered = provider.setFilters(
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        deviceId: '2',
      );
      final call = repo.calls.single;
      expect(call.cursor, isNull);
      expect(call.startDate, '2026-09-01');
      expect(call.endDate, '2026-09-30');
      expect(call.deviceId, '2');
      expect(provider.deviceFacets.keys, containsAll(['1', '2']));
      call.result.complete(_page([_record('old-remote-match', deviceId: '2')]));
      await filtered;
      expect(provider.attendanceRecords.single.id, 'old-remote-match');
    },
  );

  test(
    'daily/week/month summaries are independent of pagination and each other',
    () async {
      final day = provider.loadDailySummary();
      final week = provider.loadSummary(
        startDate: '2026-10-19',
        endDate: '2026-10-25',
      );
      final month = provider.loadSummary(
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      );
      for (final call in repo.summaryCalls) {
        call.result.complete(
          _summary(
            call.start,
            call.end,
            entries: 150,
            direction: AttendanceDirection.entry,
          ),
        );
      }
      await Future.wait([day, week, month]);
      expect(provider.firstEntryToday, DateTime.utc(2026, 10, 19, 6));
      expect(provider.todaySummary?.entryCount, 150);
      expect(provider.daysPresent, 1);
      expect(
        provider.summaryFor(startDate: '2026-10-19', endDate: '2026-10-25'),
        isNotNull,
      );
      repo.polls.last.onUpdate(_page([_record('single-visible-record')]));
      expect(provider.todaySummary?.entryCount, 150);
      expect(provider.hasSummaryLoaded, isTrue);
    },
  );

  test(
    'same-range newer summary wins; old error cannot clear busy state or expire new session',
    () async {
      final first = provider.loadDailySummary();
      final oldCall = repo.summaryCalls.last;
      final second = provider.loadDailySummary();
      final newCall = repo.summaryCalls.last;
      oldCall.result.completeError(const AuthExpiredError());
      await first;
      expect(provider.isSummaryLoading, isTrue);
      expect(provider.summaryError, isNull);
      expect(auth.expiries, 0);
      newCall.result.complete(
        _summary(
          '2026-10-19',
          '2026-10-19',
          entries: 2,
          direction: AttendanceDirection.entry,
        ),
      );
      await second;
      expect(provider.todaySummary?.entryCount, 2);
      expect(provider.isSummaryLoading, isFalse);
    },
  );

  test(
    'logout drops late summary success and expiry without contaminating B',
    () async {
      final old = provider.loadDailySummary();
      final oldCall = repo.summaryCalls.last;
      auth.change('B');
      final current = provider.loadDailySummary();
      repo.summaryCalls.last.result.complete(
        _summary('2026-10-19', '2026-10-19'),
      );
      await current;
      oldCall.result.completeError(const AuthExpiredError());
      await old;
      expect(provider.hasSummaryLoaded, isTrue);
      expect(provider.todaySummary?.entryCount, 0);
      expect(provider.summaryError, isNull);
      expect(auth.expiries, 0);
    },
  );

  test('empty intermediate archive page continues by server cursor', () async {
    repo.polls.last.onUpdate(
      _page([_record('head')], done: false, cursor: 'start'),
    );
    final first = provider.loadMore();
    repo.calls.last.result.complete(_page([], done: false, cursor: 'advanced'));
    await first;
    expect(provider.hasMore, isTrue);
    final next = provider.loadMore();
    expect(repo.calls.last.cursor, 'advanced');
    repo.calls.last.result.complete(_page([_record('older')]));
    await next;
    expect(provider.attendanceRecords.map((r) => r.id), contains('older'));
  });

  test(
    'late archive error/finally cannot affect a new filter request',
    () async {
      repo.polls.last.onUpdate(
        _page([_record('head')], done: false, cursor: 'start'),
      );
      final old = provider.loadMore();
      final filtered = provider.setFilters(deviceId: 'new-door');
      repo.calls.first.result.completeError(const AuthExpiredError());
      await old;
      expect(provider.isLoading, isTrue);
      expect(provider.listError, isNull);
      expect(auth.expiries, 0);
      repo.calls.last.result.complete(_page([_record('filtered')]));
      await filtered;
      expect(provider.isLoadingMore, isFalse);
      expect(provider.attendanceRecords.single.id, 'filtered');
    },
  );

  test(
    'manual refresh replaces archive snapshot only after successful head response',
    () async {
      repo.polls.last.onUpdate(
        _page([_record('head')], done: false, cursor: 'snapshot-1'),
      );
      final more = provider.loadMore();
      repo.calls.last.result.complete(
        _page([_record('archive')], done: false, cursor: 'older'),
      );
      await more;
      final refresh = provider.loadAttendanceRecords();
      expect(provider.attendanceRecords.map((r) => r.id), contains('archive'));
      repo.calls.last.result.complete(
        _page([_record('fresh')], done: false, cursor: 'snapshot-2'),
      );
      await refresh;
      expect(provider.attendanceRecords.map((r) => r.id), ['fresh']);
      final next = provider.loadMore();
      expect(repo.calls.last.cursor, 'snapshot-2');
      repo.calls.last.result.complete(_page([]));
      await next;
    },
  );

  test('unknown latest direction never produces inside status', () async {
    final future = provider.loadDailySummary();
    repo.summaryCalls.last.result.complete(
      _summary('2026-10-19', '2026-10-19', entries: 1),
    );
    await future;
    expect(provider.attendanceStatus, AttendanceStatus.none);
    expect(provider.isTodayStatusKnown, isFalse);
  });

  test('loading vs successful empty summary are distinguishable', () async {
    expect(provider.hasSummaryLoaded, isFalse);
    final future = provider.loadDailySummary();
    repo.summaryCalls.last.result.complete(
      _summary('2026-10-19', '2026-10-19'),
    );
    await future;
    expect(provider.hasSummaryLoaded, isTrue);
    expect(provider.isTodayStatusKnown, isTrue);
    expect(provider.attendanceStatus, AttendanceStatus.none);
  });

  test(
    'poll recovery clears list error; command denial stays in separate channel',
    () async {
      final poll = repo.polls.last;
      poll.onUpdate(_page([_record('available')]));
      poll.onError(const NetworkError());
      expect(provider.isStale, isTrue);
      poll.onUpdate(_page([_record('recovered')]));
      expect(provider.lastError, isNull);
      expect(await provider.quickUnlock('door'), isFalse);
      expect(provider.commandError, isA<BusinessError>());
      expect(provider.listError, isNull);
      expect(provider.attendanceRecords.single.id, 'recovered');
    },
  );

  test(
    'legacy QR/quick unlock cannot manufacture attendance or physical success',
    () async {
      expect(await provider.quickUnlock('door'), isFalse);
      expect(await provider.recordAttendance('descriptive-label'), isFalse);
      expect(
        (provider.commandError as BusinessError).safeCode,
        'READER_REQUIRED',
      );
      expect(repo.commands, isEmpty);
      expect(provider.isCommandLoading, isFalse);
      auth.change('B');
      expect(provider.commandError, isNull);
    },
  );

  test('old live refresh cannot overwrite a newly selected filter', () async {
    final live = provider.refreshLiveData();
    final silent = repo.calls.single;
    final filtered = provider.setFilters(deviceId: 'new-door');
    repo.calls.last.result.complete(_page([_record('filtered')]));
    await filtered;
    silent.result.complete(_page([_record('stale-silent')]));
    await _flush();
    // The live refresh still owns the session, so it refreshes the separate
    // daily summary after ignoring its obsolete head result.
    repo.summaryCalls.last.result.complete(
      _summary('2026-10-19', '2026-10-19'),
    );
    await live;
    expect(provider.attendanceRecords.single.id, 'filtered');
  });

  test(
    'pause cancels polling, resume keeps fixed-size head, stale errors ignored',
    () async {
      await _flush();
      final old = repo.polls.last;
      provider.didChangeAppLifecycleState(AppLifecycleState.paused);
      expect(old.cancelled, isTrue);
      old.onError(const AuthExpiredError());
      provider.didChangeAppLifecycleState(AppLifecycleState.resumed);
      expect(repo.polls.last.numItems, 50);
      expect(auth.expiries, 0);
    },
  );

  test('dispose suppresses pending result and finally notifications', () async {
    final future = provider.loadAttendanceRecords();
    var notifications = 0;
    provider.addListener(() => notifications++);
    provider.dispose();
    repo.calls.single.result.complete(_page([_record('late')]));
    await future;
    expect(notifications, 0);
    // tearDown also disposes; replace with a fresh object for symmetric cleanup.
    provider = AttendanceProvider(repository: repo);
  });
}
