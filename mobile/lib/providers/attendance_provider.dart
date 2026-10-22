import 'dart:async';

import 'package:flutter/widgets.dart';

import '../config/convex_config.dart';
import '../core/attendance_date.dart';
import '../core/errors.dart';
import '../models/attendance.dart';
import '../models/attendance_page.dart';
import '../models/attendance_summary.dart';
import '../repositories/attendance_repository.dart';
import 'auth_provider.dart';

class AttendanceProvider extends ChangeNotifier with WidgetsBindingObserver {
  AttendanceProvider({
    required AttendanceRepository repository,
    DateTime Function()? clock,
  }) : _repo = repository,
       _clock = clock ?? DateTime.now {
    final lifecycle = WidgetsBinding.instance.lifecycleState;
    _isAppActive = lifecycle == null || lifecycle == AppLifecycleState.resumed;
    WidgetsBinding.instance.addObserver(this);
  }

  final AttendanceRepository _repo;
  final DateTime Function() _clock;
  static const int _pageSize = 50;
  AuthProvider? _authProvider;
  String? _userId;
  String? _sessionToken;
  int? _authEpoch;
  int _epoch = 0;
  int _headGeneration = 0;
  int _archiveRequest = 0;
  bool _disposed = false;
  bool _isAppActive = true;
  ConvexSubscriptionHandle? _subscription;

  List<Attendance> _head = [];
  final Map<String, Attendance> _archive = {};
  final Map<String, String> _deviceFacets = {};
  String? _cursor;
  bool _archiveStarted = false;
  bool _hasMore = false;
  bool _listLoaded = false;
  bool _isLoading = false;
  bool _isLoadingMore = false;
  bool _isCommandLoading = false;
  AppError? _listError;
  AppError? _loadMoreError;
  AppError? _commandError;
  String? _startDate;
  String? _endDate;
  String? _deviceId;
  final Map<String, AttendanceSummary> _summaries = {};
  final Map<String, int> _summaryRequests = {};
  final Set<String> _loadingSummaries = {};
  final Map<String, AppError> _summaryErrors = {};

  List<Attendance> get attendanceRecords {
    final merged = {..._archive, for (final record in _head) record.id: record};
    final records = merged.values.toList()
      ..sort((a, b) {
        final byTime = b.accessTime.compareTo(a.accessTime);
        return byTime == 0 ? b.id.compareTo(a.id) : byTime;
      });
    return List.unmodifiable(records);
  }

  Map<String, String> get deviceFacets => Map.unmodifiable(_deviceFacets);
  bool get isLoading => _isLoading;
  bool get isLoadingMore => _isLoadingMore;
  bool get isCommandLoading => _isCommandLoading;
  bool get hasMore => _hasMore;
  bool get listLoaded => _listLoaded;
  bool get isListFullyLoaded => _listLoaded && !_hasMore;
  bool get isStale => _listLoaded && listError != null;
  AppError? get listError => _listError ?? _loadMoreError;
  AppError? get loadMoreError => _loadMoreError;
  AppError? get lastError => listError;
  String? get errorMessage => listError?.userMessage;
  AppError? get commandError => _commandError;
  String? get commandErrorMessage => _commandError?.userMessage;
  String? get startDate => _startDate;
  String? get endDate => _endDate;
  String? get deviceId => _deviceId;

  String get _today => AttendanceDate.instantKey(_clock());
  String _rangeKey(String start, String end) => '$start/$end';
  AttendanceSummary? summaryFor({
    required String startDate,
    required String endDate,
  }) => _summaries[_rangeKey(startDate, endDate)];
  bool hasSummaryFor({required String startDate, required String endDate}) =>
      summaryFor(startDate: startDate, endDate: endDate) != null;
  bool isSummaryStaleFor({
    required String startDate,
    required String endDate,
  }) =>
      hasSummaryFor(startDate: startDate, endDate: endDate) &&
      summaryErrorFor(startDate: startDate, endDate: endDate) != null;
  bool isSummaryLoadingFor({
    required String startDate,
    required String endDate,
  }) => _loadingSummaries.contains(_rangeKey(startDate, endDate));
  AppError? summaryErrorFor({
    required String startDate,
    required String endDate,
  }) => _summaryErrors[_rangeKey(startDate, endDate)];
  AttendanceSummary? get dailySummary =>
      summaryFor(startDate: _today, endDate: _today);
  AttendanceDaySummary? get todaySummary => dailySummary?.day(_today);
  bool get todaySummaryLoaded => dailySummary != null;
  bool get hasSummaryLoaded => todaySummaryLoaded;
  bool get summaryLoaded => todaySummaryLoaded;
  bool get isSummaryLoading =>
      isSummaryLoadingFor(startDate: _today, endDate: _today);
  AppError? get summaryError =>
      summaryErrorFor(startDate: _today, endDate: _today);
  DateTime? get summaryUpdatedAt => dailySummary?.generatedAt;

  /// Compatibility alias; history should use range-keyed summaryFor.
  AttendanceSummary? get summary => dailySummary;
  bool get isFullPeriodLoaded => todaySummaryLoaded;
  bool get isTodayStatusKnown =>
      todaySummaryLoaded &&
      (todaySummary == null ||
          todaySummary?.lastDirection != AttendanceDirection.unknown ||
          ((todaySummary?.entryCount ?? 0) +
                  (todaySummary?.exitCount ?? 0) +
                  (todaySummary?.unknownCount ?? 0) ==
              0));
  DateTime? get firstEntryToday => todaySummary?.firstEntry;
  DateTime? get lastEntryToday => todaySummary?.lastEntry;
  DateTime? get lastExitToday => todaySummary?.lastExit;
  int _extra(int count) => count > 1 ? count - 1 : 0;
  int get extraEntryMovementsToday => _extra(todaySummary?.entryCount ?? 0);
  int get extraExitMovementsToday => _extra(todaySummary?.exitCount ?? 0);
  int get extraMovementsToday =>
      extraEntryMovementsToday + extraExitMovementsToday;
  bool get hasCheckedInToday => (todaySummary?.entryCount ?? 0) > 0;
  bool get hasCheckedOutToday =>
      todaySummary?.lastDirection == AttendanceDirection.exit;
  AttendanceStatus get attendanceStatus =>
      switch (todaySummary?.lastDirection) {
        AttendanceDirection.entry => AttendanceStatus.inside,
        AttendanceDirection.exit => AttendanceStatus.out,
        _ => AttendanceStatus.none,
      };
  Attendance? get todayAttendance {
    for (final record in attendanceRecords) {
      if (record.granted &&
          (record.isEntry || record.isExit) &&
          AttendanceDate.instantKey(record.accessTime) == _today) {
        return record;
      }
    }
    return null;
  }

  bool _owns(int epoch) =>
      !_disposed &&
      epoch == _epoch &&
      _userId != null &&
      _authProvider?.currentUser?.id == _userId &&
      _authProvider?.sessionToken == _sessionToken &&
      _authProvider?.sessionEpoch == _authEpoch;
  void _publish() {
    if (!_disposed) notifyListeners();
  }

  void setAuthProvider(AuthProvider authProvider) {
    if (_disposed) return;
    if (!identical(_authProvider, authProvider)) {
      _authProvider?.removeListener(_syncAuth);
      _authProvider = authProvider;
      _authEpoch = null;
      authProvider.addListener(_syncAuth);
    }
    _syncAuth();
  }

  void _syncAuth() {
    if (_disposed) return;
    final auth = _authProvider;
    final id = auth?.isAuthenticated == true ? auth?.currentUser?.id : null;
    final token = auth?.sessionToken;
    final authEpoch = auth?.sessionEpoch;
    if (id == _userId && token == _sessionToken && authEpoch == _authEpoch) {
      return;
    }
    _epoch++;
    _stopPolling();
    _userId = id;
    _sessionToken = token;
    _authEpoch = authEpoch;
    _head = [];
    _archive.clear();
    _deviceFacets.clear();
    _summaries.clear();
    _summaryRequests.clear();
    _loadingSummaries.clear();
    _summaryErrors.clear();
    _cursor = null;
    _archiveStarted = false;
    _hasMore = false;
    _listLoaded = false;
    _isLoading = false;
    _isLoadingMore = false;
    _isCommandLoading = false;
    _listError = null;
    _loadMoreError = null;
    _commandError = null;
    _startDate = null;
    _endDate = null;
    _deviceId = null;
    _publish();
    if (id != null && _isAppActive) {
      unawaited(_startPolling());
      unawaited(loadDailySummary());
    }
  }

  void _stopPolling() {
    _headGeneration++;
    final subscription = _subscription;
    _subscription = null;
    subscription?.cancel();
  }

  void _acceptHead(AttendancePage page) {
    // Once archiving begins, preserve the previous boundary snapshot so events
    // pushed out of the live head by inserts are not lost between pages.
    if (_archiveStarted) {
      for (final record in _head) {
        _archive[record.id] = record;
      }
    } else {
      _cursor = page.continueCursor;
      _hasMore = !page.isDone;
    }
    _head = page.page;
    _rememberDevices(page.page);
    _listLoaded = true;
    _isLoading = false;
    _listError = null;
  }

  void _rememberDevices(List<Attendance> records) {
    for (final record in records) {
      final id = record.deviceId;
      if (id != null) _deviceFacets[id] = record.doorName;
    }
  }

  Future<void> _startPolling() async {
    _stopPolling();
    final epoch = _epoch;
    final generation = _headGeneration;
    if (!_owns(epoch) || !_isAppActive) return;
    _isLoading = !_listLoaded;
    _publish();
    bool current() =>
        _owns(epoch) && generation == _headGeneration && _isAppActive;
    try {
      final handle = await _repo.subscribePage(
        numItems: _pageSize,
        startDate: _startDate,
        endDate: _endDate,
        deviceId: _deviceId,
        onUpdate: (page) {
          if (!current()) return;
          _acceptHead(page);
          _publish();
          // Fixed-size daily aggregate refresh is independent of archive size.
          unawaited(loadDailySummary());
        },
        onError: (error) {
          if (!current()) return;
          _isLoading = false;
          _listError = error;
          _handleExpiry(error, epoch);
          _publish();
        },
      );
      if (!current()) {
        handle.cancel();
        return;
      }
      _subscription = handle;
    } catch (error, stack) {
      if (!current()) return;
      final mapped = AppError.fromException(error, stack);
      _isLoading = false;
      _listError = mapped;
      _handleExpiry(mapped, epoch);
      _publish();
    }
  }

  Future<void> setFilters({
    String? startDate,
    String? endDate,
    String? deviceId,
  }) async {
    AttendanceDate.validateRange(startDate, endDate);
    if (_disposed) return;
    _stopPolling();
    _archiveRequest++;
    _startDate = startDate;
    _endDate = endDate;
    _deviceId = deviceId;
    _head = [];
    _archive.clear();
    _cursor = null;
    _archiveStarted = false;
    _hasMore = false;
    _listLoaded = false;
    _isLoadingMore = false;
    _listError = null;
    _loadMoreError = null;
    await loadAttendanceRecords();
  }

  Future<void> loadAttendanceRecords() => _refreshHead(resetArchive: true);

  /// Refresh the fixed live window without throwing away archived pages.
  /// Useful after an independently observed physical event, not command ACK.
  Future<void> refreshLiveData() async {
    final epoch = _epoch;
    await _refreshHead();
    if (_owns(epoch)) await loadDailySummary();
  }

  Future<void> _refreshHead({bool resetArchive = false}) async {
    final epoch = _epoch;
    if (!_owns(epoch)) return;
    _stopPolling();
    if (resetArchive) {
      _archiveRequest++;
      _isLoadingMore = false;
    }
    final generation = _headGeneration;
    bool current() => _owns(epoch) && generation == _headGeneration;
    _isLoading = true;
    _listError = null;
    _publish();
    try {
      final page = await _repo.listPage(
        numItems: _pageSize,
        startDate: _startDate,
        endDate: _endDate,
        deviceId: _deviceId,
      );
      if (!current()) return;
      if (resetArchive) {
        _archive.clear();
        _archiveStarted = false;
        _loadMoreError = null;
      }
      _acceptHead(page);
    } catch (error, stack) {
      if (!current()) return;
      final mapped = AppError.fromException(error, stack);
      _listError = mapped;
      _handleExpiry(mapped, epoch);
    } finally {
      if (current()) {
        _isLoading = false;
        _publish();
        if (_isAppActive) unawaited(_startPolling());
      }
    }
  }

  Future<void> loadMore() async {
    final epoch = _epoch;
    final cursor = _cursor;
    if (!_owns(epoch) ||
        _isLoading ||
        _isLoadingMore ||
        !_hasMore ||
        cursor == null) {
      return;
    }
    final request = ++_archiveRequest;
    bool current() => _owns(epoch) && request == _archiveRequest;
    _archiveStarted = true;
    _loadMoreError = null;
    _isLoadingMore = true;
    _publish();
    try {
      final page = await _repo.listPage(
        cursor: cursor,
        numItems: _pageSize,
        startDate: _startDate,
        endDate: _endDate,
        deviceId: _deviceId,
      );
      if (!current()) return;
      if (!page.isDone && page.continueCursor == cursor) {
        throw const ProtocolError();
      }
      for (final record in page.page) {
        _archive[record.id] = record;
      }
      _rememberDevices(page.page);
      _cursor = page.continueCursor;
      _hasMore = !page.isDone;
      _loadMoreError = null;
    } catch (error, stack) {
      if (!current()) return;
      final mapped = AppError.fromException(error, stack);
      _loadMoreError = mapped;
      _handleExpiry(mapped, epoch);
    } finally {
      if (current()) {
        _isLoadingMore = false;
        _publish();
      }
    }
  }

  Future<AttendanceSummary?> loadDailySummary() =>
      loadSummary(startDate: _today, endDate: _today);
  Future<AttendanceSummary?> loadSummary({
    required String startDate,
    required String endDate,
  }) async {
    AttendanceDate.validateRange(startDate, endDate);
    final epoch = _epoch;
    if (!_owns(epoch)) return null;
    final key = _rangeKey(startDate, endDate);
    final request = (_summaryRequests[key] ?? 0) + 1;
    _summaryRequests[key] = request;
    bool current() => _owns(epoch) && _summaryRequests[key] == request;
    _loadingSummaries.add(key);
    _summaryErrors.remove(key);
    _publish();
    try {
      final result = await _repo.summary(
        startDate: startDate,
        endDate: endDate,
      );
      if (!current()) return null;
      _summaries[key] = result;
      return result;
    } catch (error, stack) {
      if (!current()) return null;
      final mapped = AppError.fromException(error, stack);
      _summaryErrors[key] = mapped;
      _handleExpiry(mapped, epoch);
      return null;
    } finally {
      if (current()) {
        _loadingSummaries.remove(key);
        _publish();
      }
    }
  }

  void _handleExpiry(AppError error, int epoch) {
    if (error is AuthExpiredError && _owns(epoch)) {
      unawaited(
        _authProvider?.handleAuthExpiry(
              reason: error,
              sessionToken: _sessionToken,
              sessionEpoch: _authEpoch,
            ) ??
            Future<void>.value(),
      );
    }
  }

  /// Compatibility surface only: descriptive QR labels and device IDs cannot
  /// establish physical presence. New commands belong to DoorOperationProvider.
  Future<bool> recordAttendance(String qrData) async =>
      _rejectLegacyAttendance();
  Future<bool> quickUnlock(String deviceId) async => _rejectLegacyAttendance();
  bool _rejectLegacyAttendance() {
    if (!_owns(_epoch)) return false;
    _commandError = const BusinessError(message: '', code: 'READER_REQUIRED');
    _publish();
    return false;
  }

  int get totalDaysThisMonth {
    final now = AttendanceDate.businessTime(_clock());
    return DateTime.utc(now.year, now.month + 1, 0).day;
  }

  int get daysElapsedThisMonth => AttendanceDate.businessTime(_clock()).day;
  AttendanceSummary? get _monthSummary {
    final range = AttendanceDate.month(_clock());
    return summaryFor(startDate: range.startDate, endDate: range.endDate);
  }

  bool get monthSummaryLoaded => _monthSummary != null;
  int get daysPresent => _monthSummary?.totals.presentDays ?? 0;

  /// Legacy getters: no hard-coded lateness threshold is a verified shift rule.
  /// Consumers must not label these as authoritative payroll metrics.
  bool get hasShiftSummary => false;
  @Deprecated(
    'Lateness requires the server shift policy; not available in raw attendance',
  )
  int get daysLate => 0;
  @Deprecated('On-time attendance requires the server shift policy')
  int get daysOnTime => 0;

  void clearError() {
    _listError = null;
    _loadMoreError = null;
    _publish();
  }

  void clearCommandError() {
    _commandError = null;
    _publish();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_disposed) return;
    final active = state == AppLifecycleState.resumed;
    if (_isAppActive == active) return;
    _isAppActive = active;
    _stopPolling();
    _isLoading = false;
    if (active && _owns(_epoch)) {
      unawaited(_startPolling());
      unawaited(loadDailySummary());
    }
    _publish();
  }

  @override
  void dispose() {
    _disposed = true;
    _epoch++;
    _authProvider?.removeListener(_syncAuth);
    WidgetsBinding.instance.removeObserver(this);
    _stopPolling();
    super.dispose();
  }
}

enum AttendanceStatus { none, inside, out }
