import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/errors.dart';
import '../models/visitor.dart';
import '../repositories/visitor_repository.dart';
import '../services/visitor_create_intent_store.dart';
import 'auth_provider.dart';

class VisitorProvider extends ChangeNotifier {
  VisitorProvider({
    required VisitorRepository repository,
    VisitorCreateIntentStore? createIntentStore,
  }) : _repository = repository,
       _createStore = createIntentStore,
       _session = repository.sessionKey;
  final VisitorRepository _repository;
  final VisitorCreateIntentStore? _createStore;
  String? _persistedRequestId;
  Future<String?>? _recoveryFuture;
  bool createRecoveryLoading = false, createRecoveryStorageFailed = false;
  AppError? createRecoveryError;
  bool get hasUnresolvedCreate =>
      _persistedRequestId != null || pendingCreate != null;
  String? get recoveryRequestId =>
      _persistedRequestId ?? pendingCreate?.requestId;

  static const _createStorageError = BusinessError(
    message: '',
    code: 'VISITOR_INTENT_STORAGE_FAILED',
  );

  VisitorCreateScope? get _createScope {
    final user = _auth?.isAuthenticated == true ? _auth?.currentUser : null;
    final project = user?.projectId;
    if (user == null || project == null || project.isEmpty) return null;
    return VisitorCreateScope(
      employeeId: user.id,
      projectId: project,
      deployment: _repository.deploymentUrl,
    );
  }

  String? _session;
  AuthProvider? _auth;
  int? _authEpoch;
  int _epoch = 0, _listRequest = 0, _detailRequest = 0, _summaryRequest = 0;
  bool _disposed = false, _visible = false, _foreground = true;
  Completer<void>? _foregroundWaiter;
  String? _detailId;
  int _detailOwner = 0;
  Timer? _poll;
  List<Visitor> visitors = const [];
  Visitor? selected;
  String search = '';
  VisitorAccessStatus? status;
  VisitorSummary? summary;
  AppError? summaryError;
  bool summaryLoading = false;
  VisitorNotice? notice;
  PendingVisitorCreate? pendingCreate;
  String? _cursor;
  bool hasMore = false,
      loaded = false,
      loading = false,
      detailLoading = false,
      busy = false;
  AppError? error, detailError, mutationError;

  int get sessionEpoch => _epoch;

  String? get _effectiveSession {
    final auth = _auth;
    return auth == null
        ? _repository.sessionKey
        : auth.isAuthenticated
        ? auth.sessionToken
        : null;
  }

  bool _owns(int epoch, String? session) =>
      !_disposed &&
      epoch == _epoch &&
      session == _repository.sessionKey &&
      session == _effectiveSession &&
      (_auth == null || _authEpoch == _auth?.sessionEpoch);
  void _emit() {
    if (!_disposed) notifyListeners();
  }

  Future<bool> _waitForForeground(int epoch, String? session) async {
    while (_owns(epoch, session) && !_foreground) {
      final waiter = _foregroundWaiter ??= Completer<void>();
      await waiter.future;
    }
    return _owns(epoch, session) && _foreground;
  }

  void _wakeForegroundWaiters() {
    final waiter = _foregroundWaiter;
    _foregroundWaiter = null;
    if (waiter != null && !waiter.isCompleted) waiter.complete();
  }

  void synchronizeSession([AuthProvider? auth]) {
    if (_disposed) return;
    if (auth != null) _auth = auth;
    final current = _effectiveSession;
    final authEpoch = _auth?.sessionEpoch;
    if (_session == current && _authEpoch == authEpoch) return;
    _session = current;
    _authEpoch = authEpoch;
    _epoch++;
    _wakeForegroundWaiters();
    _listRequest++;
    _detailRequest++;
    _summaryRequest++;
    search = '';
    status = null;
    summary = null;
    summaryError = null;
    summaryLoading = false;
    visitors = const [];
    selected = null;
    _detailId = null;
    _detailOwner++;
    notice = null;
    pendingCreate = null;
    // Drop PII and visible recovery state on logout/account change. Outstanding
    // metadata stays scoped on disk so relogin cannot silently use a new ID.
    _persistedRequestId = null;
    _recoveryFuture = null;
    createRecoveryLoading = createRecoveryStorageFailed = false;
    createRecoveryError = null;
    _cursor = null;
    hasMore = loaded = loading = detailLoading = busy = false;
    error = detailError = mutationError = null;
    _syncPolling();
    if (_foreground && _visible && _session != null) {
      scheduleMicrotask(() {
        if (!_disposed &&
            _foreground &&
            _visible &&
            _session != null &&
            !loading) {
          unawaited(refresh());
        }
      });
    }
    _emit();
  }

  void setVisible(bool visible) {
    if (_disposed || _visible == visible) return;
    _visible = visible;
    synchronizeSession();
    if (visible && _foreground && _session != null) unawaited(refresh());
    _syncPolling();
  }

  /// Root detail routes cover the list but retain their own polling ownership.
  /// Foreground ownership is independent of either route's visibility.
  void setForeground(bool foreground) {
    if (_disposed || _foreground == foreground) return;
    _foreground = foreground;
    if (foreground) _wakeForegroundWaiters();
    if (!foreground) {
      // Ignore reads that complete after backgrounding; resume starts fresh reads.
      _listRequest++;
      _summaryRequest++;
      _detailRequest++;
      loading = summaryLoading = detailLoading = false;
    }
    synchronizeSession();
    _syncPolling();
    if (!foreground || _session == null) return;
    if (_visible && !loading && !busy) unawaited(refresh());
    final id = _detailId;
    if (id != null && !detailLoading && !busy) unawaited(openDetail(id));
  }

  void _syncPolling() {
    if (_disposed ||
        !_foreground ||
        _session == null ||
        (!_visible && _detailId == null)) {
      _poll?.cancel();
      _poll = null;
      return;
    }
    // List and detail share one timer, including while their owners overlap.
    _poll ??= Timer.periodic(const Duration(seconds: 30), (_) {
      synchronizeSession();
      if (_disposed || !_foreground || _session == null) return;
      if (_visible && !loading && !busy) unawaited(refresh());
      final id = _detailId;
      if (id != null && !detailLoading && !busy) unawaited(openDetail(id));
    });
  }

  void setFilters({
    String? search,
    VisitorAccessStatus? status,
    bool resetStatus = false,
  }) {
    if (_disposed) return;
    synchronizeSession();
    final nextSearch = search ?? this.search;
    final nextStatus = resetStatus ? null : status ?? this.status;
    if (nextSearch == this.search && nextStatus == this.status) return;
    this.search = nextSearch;
    this.status = nextStatus;
    _listRequest++;
    _cursor = null;
    hasMore = loaded = loading = false;
    visitors = const [];
    error = null;
    unawaited(refresh());
  }

  Future<void> refreshSummary() async {
    if (_disposed) return;
    synchronizeSession();
    if (_session == null || !_foreground) return;
    final epoch = _epoch, request = ++_summaryRequest;
    final session = _session;
    summaryLoading = true;
    summaryError = null;
    try {
      final value = await _repository.summary();
      if (!_owns(epoch, session) || request != _summaryRequest) return;
      summary = value;
    } catch (failure, stack) {
      if (_owns(epoch, session) && request == _summaryRequest) {
        summaryError = AppError.fromException(failure, stack);
      }
    } finally {
      if (_owns(epoch, session) && request == _summaryRequest) {
        summaryLoading = false;
        _emit();
      }
    }
  }

  Future<void> refresh({bool more = false}) async {
    if (_disposed) return;
    synchronizeSession();
    if (_session == null || !_foreground || (more && (!hasMore || loading))) {
      return;
    }
    final epoch = _epoch, request = ++_listRequest;
    final session = _session;
    loading = true;
    error = null;
    if (!more) unawaited(refreshSummary());
    _emit();
    try {
      final page = await _repository.list(
        cursor: more ? _cursor : null,
        search: search,
        status: status,
      );
      if (!_owns(epoch, session) || request != _listRequest) return;
      final rows = more ? [...visitors, ...page.visitors] : page.visitors;
      visitors = {
        for (final row in rows) row.id: row,
      }.values.toList(growable: false);
      _cursor = page.cursor;
      hasMore = !page.isDone;
      loaded = true;
    } catch (failure, stack) {
      if (!_owns(epoch, session) || request != _listRequest) return;
      error = AppError.fromException(failure, stack);
    } finally {
      if (_owns(epoch, session) && request == _listRequest) {
        loading = false;
        _emit();
      }
    }
  }

  Future<void> openDetail(String id) async {
    if (_disposed) return;
    synchronizeSession();
    if (_session == null || !_foreground) return;
    final epoch = _epoch, request = ++_detailRequest;
    final session = _session;
    if (selected?.id != id) selected = null;
    detailLoading = true;
    detailError = mutationError = null;
    _emit();
    try {
      final result = await _repository.detail(id);
      if (!_owns(epoch, session) || request != _detailRequest) return;
      selected = result;
    } catch (failure, stack) {
      if (!_owns(epoch, session) || request != _detailRequest) return;
      selected = null; // A revoked ownership response must never retain PII.
      detailError = AppError.fromException(failure, stack);
    } finally {
      if (_owns(epoch, session) && request == _detailRequest) {
        detailLoading = false;
        _emit();
      }
    }
  }

  /// The mounted root detail owns this lease; a detail read alone owns no timer.
  int retainDetail(String id) {
    final owner = ++_detailOwner;
    if (_disposed) return owner;
    _detailId = id;
    _syncPolling();
    return owner;
  }

  void releaseDetail(int owner) {
    if (owner == _detailOwner) closeDetail();
  }

  void closeDetail() {
    if (_disposed) return;
    _detailOwner++;
    _detailRequest++;
    _detailId = null;
    selected = null;
    detailLoading = false;
    detailError = null;
    _syncPolling();
  }

  Future<VisitorNotice?> loadNotice() async {
    if (_disposed) return null;
    synchronizeSession();
    final epoch = _epoch;
    final session = _session;
    if (session == null) return null;
    mutationError = null;
    try {
      if (!await _waitForForeground(epoch, session)) return null;
      final value = await _repository.notice();
      if (!await _waitForForeground(epoch, session)) return null;
      notice = value;
      return value;
    } catch (failure, stack) {
      if (await _waitForForeground(epoch, session)) {
        mutationError = AppError.fromException(failure, stack);
      }
      return null;
    } finally {
      if (_owns(epoch, session)) _emit();
    }
  }

  /// Read the durable intent before permitting a create and query its receipt.
  /// A null receipt never frees the slot: an earlier request may still commit.
  Future<String?> reconcileCreate() {
    if (_disposed) return Future.value(null);
    synchronizeSession();
    if (_createStore == null) return Future.value(null);
    final running = _recoveryFuture;
    if (running != null) return running;
    createRecoveryLoading = true;
    createRecoveryStorageFailed = false;
    createRecoveryError = null;
    final future = _reconcileCreate(_epoch, _session, _createScope);
    _recoveryFuture = future;
    _emit();
    return future;
  }

  Future<String?> _reconcileCreate(
    int epoch,
    String? session,
    VisitorCreateScope? scope,
  ) async {
    var storageEffect = true;
    try {
      final store = _createStore;
      if (store == null || scope == null || session == null) {
        throw _createStorageError;
      }
      final requestId = await store.read(scope);
      if (!await _waitForForeground(epoch, session)) return null;
      _persistedRequestId = requestId;
      if (requestId == null) return null;
      storageEffect = false;
      final receipt = await _repository.getCreateReceipt(requestId);
      if (!await _waitForForeground(epoch, session) || receipt == null) {
        return null;
      }
      storageEffect = true;
      await store.remove(scope, requestId);
      if (!await _waitForForeground(epoch, session)) return null;
      _persistedRequestId = null;
      pendingCreate = null;
      unawaited(refresh());
      return receipt;
    } catch (failure, stack) {
      if (await _waitForForeground(epoch, session)) {
        createRecoveryStorageFailed = storageEffect;
        createRecoveryError = storageEffect
            ? _createStorageError
            : AppError.fromException(failure, stack);
      }
      return null;
    } finally {
      if (_owns(epoch, session)) {
        createRecoveryLoading = false;
        _recoveryFuture = null;
        _emit();
      }
    }
  }

  Future<bool> save(
    VisitorDraft draft, {
    String? id,
    required String requestId,
    required VisitorNotice notice,
    required bool noticeReviewed,
  }) async {
    if (_disposed) return false;
    synchronizeSession();
    if (busy || _session == null) return false;
    final epoch = _epoch;
    final session = _session;
    busy = true;
    mutationError = null;
    _emit();
    try {
      if (id == null) {
        if (_createStore != null) {
          final receipt = await reconcileCreate();
          if (!_owns(epoch, session)) return false;
          if (receipt != null) return true;
          if (createRecoveryError != null) return false;
          final store = _createStore;
          final scope = _createScope;
          if (scope == null) return false;
          try {
            // Claim is atomic across replacement providers. It never overwrites
            // a request discovered after the reconciliation read.
            final claimed = await store.claim(
              scope,
              _persistedRequestId ?? requestId,
            );
            if (!_owns(epoch, session)) return false;
            _persistedRequestId = claimed;
          } catch (_) {
            if (_owns(epoch, session)) {
              createRecoveryStorageFailed = true;
              createRecoveryError = _createStorageError;
            }
            return false;
          }
          if (!_owns(epoch, session)) return false;
        }
        final previous = pendingCreate;
        final pending =
            (previous != null &&
                    (_createStore == null ||
                        previous.requestId == _persistedRequestId)
                ? previous
                : null) ??
            PendingVisitorCreate(
              draft: draft,
              requestId: _persistedRequestId ?? requestId,
              notice: notice,
              noticeReviewed: noticeReviewed,
            );
        pendingCreate = pending;
        if (!await _waitForForeground(epoch, session)) return false;
        await _repository.create(
          pending.draft,
          requestId: pending.requestId,
          notice: pending.notice,
          noticeReviewed: pending.noticeReviewed,
        );
        if (!_owns(epoch, session)) return false;
        final scope = _createScope;
        final store = _createStore;
        if (store != null && scope != null) {
          try {
            await store.remove(scope, pending.requestId);
          } catch (_) {
            if (_owns(epoch, session)) {
              createRecoveryStorageFailed = true;
              createRecoveryError = _createStorageError;
            }
            return false;
          }
          if (!_owns(epoch, session)) return false;
          _persistedRequestId = null;
        }
      } else {
        await _repository.update(id, draft);
      }
      if (!_owns(epoch, session)) return false;
      if (id == null) pendingCreate = null;
      unawaited(refresh());
      return true;
    } catch (failure, stack) {
      if (_owns(epoch, session)) {
        mutationError = AppError.fromException(failure, stack);
        if (id == null &&
            failure is BusinessError &&
            failure is! ProtocolError) {
          pendingCreate = null;
        }
      }
      return false;
    } finally {
      if (_owns(epoch, session)) {
        busy = false;
        _emit();
      }
    }
  }

  Future<bool?> cancel(String id) async {
    if (_disposed) return null;
    synchronizeSession();
    if (busy || _session == null) return null;
    final epoch = _epoch;
    final session = _session;
    busy = true;
    mutationError = null;
    _emit();
    try {
      final cancelled = await _repository.cancel(id);
      if (!_owns(epoch, session)) return null;
      if (cancelled) {
        selected = null;
        unawaited(refresh());
      }
      return cancelled;
    } catch (failure, stack) {
      if (_owns(epoch, session)) {
        mutationError = AppError.fromException(failure, stack);
      }
      return null;
    } finally {
      if (_owns(epoch, session)) {
        busy = false;
        _emit();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _epoch++;
    _wakeForegroundWaiters();
    _poll?.cancel();
    super.dispose();
  }
}
