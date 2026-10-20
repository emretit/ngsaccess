import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/errors.dart';
import '../models/visitor.dart';
import '../repositories/visitor_repository.dart';
import 'auth_provider.dart';

class VisitorProvider extends ChangeNotifier {
  VisitorProvider({required VisitorRepository repository})
    : _repository = repository,
      _session = repository.sessionKey;
  final VisitorRepository _repository;
  String? _session;
  AuthProvider? _auth;
  int? _authEpoch;
  int _epoch = 0, _listRequest = 0, _detailRequest = 0, _summaryRequest = 0;
  bool _disposed = false, _visible = false;
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

  void synchronizeSession([AuthProvider? auth]) {
    if (_disposed) return;
    if (auth != null) _auth = auth;
    final current = _effectiveSession;
    final authEpoch = _auth?.sessionEpoch;
    if (_session == current && _authEpoch == authEpoch) return;
    _session = current;
    _authEpoch = authEpoch;
    _epoch++;
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
    notice = null;
    pendingCreate = null;
    _cursor = null;
    hasMore = loaded = loading = detailLoading = busy = false;
    error = detailError = mutationError = null;
    _poll?.cancel();
    if (_visible && _session != null) {
      _startPolling();
      scheduleMicrotask(() {
        if (!_disposed && _visible && _session != null && !loading) {
          unawaited(refresh());
        }
      });
    }
    _emit();
  }

  void setVisible(bool visible) {
    if (_disposed || _visible == visible) return;
    _visible = visible;
    _poll?.cancel();
    if (!visible) return;
    synchronizeSession();
    if (_session != null) unawaited(refresh());
    if (_session != null) _startPolling();
  }

  void _startPolling() {
    _poll?.cancel();
    _poll = Timer.periodic(const Duration(seconds: 30), (_) {
      if (!_visible || _disposed) return;
      synchronizeSession();
      if (_session == null) return;
      if (!loading && !busy) unawaited(refresh());
      final id = selected?.id;
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
    if (_session == null) return;
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
    if (_session == null || (more && (!hasMore || loading))) return;
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

  void closeDetail() {
    _detailRequest++;
    selected = null;
    detailLoading = false;
    detailError = null;
  }

  Future<VisitorNotice?> loadNotice() async {
    if (_disposed) return null;
    synchronizeSession();
    final epoch = _epoch;
    final session = _session;
    mutationError = null;
    try {
      final value = await _repository.notice();
      if (!_owns(epoch, session)) return null;
      notice = value;
      return value;
    } catch (failure, stack) {
      if (_owns(epoch, session)) {
        mutationError = AppError.fromException(failure, stack);
      }
      return null;
    } finally {
      if (_owns(epoch, session)) _emit();
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
        final pending =
            pendingCreate ??
            PendingVisitorCreate(
              draft: draft,
              requestId: requestId,
              notice: notice,
              noticeReviewed: noticeReviewed,
            );
        pendingCreate = pending;
        await _repository.create(
          pending.draft,
          requestId: pending.requestId,
          notice: pending.notice,
          noticeReviewed: pending.noticeReviewed,
        );
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
    _poll?.cancel();
    super.dispose();
  }
}
