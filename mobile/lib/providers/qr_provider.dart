import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/errors.dart';
import '../repositories/qr_repository.dart';

enum QrViewStatus { empty, loading, active, expired, consumed, refreshFailed }

/// Token ownership is scoped to the HTTP client's employee session. No employee
/// ID supplied by a widget participates in authorization.
class QrProvider extends ChangeNotifier {
  QrProvider({required QrRepository repository, DateTime Function()? now})
    : _repository = repository,
      _now = now ?? DateTime.now,
      _session = repository.sessionKey;

  final QrRepository _repository;
  final DateTime Function() _now;
  String? _session;
  int _generation = 0;
  bool _disposed = false;
  bool _visible = false;
  bool _checking = false;
  bool _needsVerification = false;
  bool isRefreshing = false;
  AppError? error;
  AppError? statusError;
  QrToken? token;
  DateTime? _deadline;
  Duration _lifetime = Duration.zero;
  Timer? _ticker;
  int _ticks = 0;

  Duration get remaining {
    final deadline = _deadline;
    if (deadline == null) return Duration.zero;
    final result = deadline.difference(_now());
    return result.isNegative ? Duration.zero : result;
  }

  double get progress => _lifetime.inMilliseconds <= 0
      ? 0
      : (remaining.inMilliseconds / _lifetime.inMilliseconds).clamp(0.0, 1.0);

  QrViewStatus get status {
    if (error != null) return QrViewStatus.refreshFailed;
    if (token?.status == QrTokenStatus.consumed) return QrViewStatus.consumed;
    if (token != null &&
        (remaining == Duration.zero ||
            token?.status == QrTokenStatus.expired)) {
      return QrViewStatus.expired;
    }
    if (isRefreshing) return QrViewStatus.loading;
    return token == null ? QrViewStatus.empty : QrViewStatus.active;
  }

  bool get isVerifying => _checking && _needsVerification;

  bool get canDisplay =>
      token != null &&
      remaining > Duration.zero &&
      token?.status == QrTokenStatus.active &&
      statusError == null &&
      !_needsVerification;

  void synchronizeSession() {
    final current = _repository.sessionKey;
    if (_session == current) return;
    _session = current;
    _generation++;
    token = null;
    _deadline = null;
    _lifetime = Duration.zero;
    isRefreshing = false;
    _checking = false;
    error = null;
    statusError = null;
    _emit();
  }

  bool _owns(int generation, String? session) =>
      !_disposed &&
      generation == _generation &&
      session == _repository.sessionKey;

  Future<void> refresh() async {
    if (_disposed) return;
    synchronizeSession();
    if (isRefreshing) return;
    final generation = ++_generation;
    final session = _session;
    final started = _now();
    isRefreshing = true;
    _checking = false;
    error = null;
    _emit();
    try {
      final result = await _repository.createToken();
      if (!_owns(generation, session)) return;
      token = result;
      _applyDeadline(result, started);
      statusError = null;
      _needsVerification = false;
    } catch (failure, stack) {
      if (!_owns(generation, session)) return;
      error = AppError.fromException(failure, stack);
    } finally {
      if (_owns(generation, session)) {
        isRefreshing = false;
        _emit();
      }
    }
  }

  void _applyDeadline(QrToken value, DateTime started) {
    final received = _now();
    final serverTime = value.serverTime;
    // Subtract the whole round trip conservatively. A server timestamp makes
    // the display independent of a phone clock that is several minutes off.
    final lifetime = serverTime == null
        ? value.expiresAt.difference(received)
        : value.expiresAt.difference(serverTime) - received.difference(started);
    final safe = lifetime.isNegative ? Duration.zero : lifetime;
    _deadline = received.add(safe);
    if (_lifetime == Duration.zero || isRefreshing) _lifetime = safe;
  }

  Future<void> checkStatus() async {
    if (_disposed) return;
    synchronizeSession();
    final current = token;
    if (_checking ||
        isRefreshing ||
        current == null ||
        current.status != QrTokenStatus.active ||
        remaining == Duration.zero) {
      return;
    }
    final generation = _generation;
    final session = _session;
    final started = _now();
    _checking = true;
    try {
      final result = await _repository.tokenStatus(current);
      if (!_owns(generation, session)) return;
      token = result;
      _applyDeadline(result, started);
      statusError = null;
      _needsVerification = false;
    } catch (failure, stack) {
      if (!_owns(generation, session)) return;
      // Do not keep recommending a credential whose consumption is unknown.
      statusError = AppError.fromException(failure, stack);
    } finally {
      if (_owns(generation, session)) {
        _checking = false;
        _emit();
      }
    }
  }

  void setVisible(bool visible) {
    if (_disposed || _visible == visible) return;
    _visible = visible;
    _ticker?.cancel();
    if (!visible) {
      _needsVerification = true;
      return;
    }
    synchronizeSession();
    if (token == null) {
      unawaited(refresh());
    } else {
      _needsVerification = true;
      unawaited(checkStatus());
    }
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_disposed) return;
      synchronizeSession();
      if (token == null && !isRefreshing && error == null) unawaited(refresh());
      _emit();
      if (++_ticks % 3 == 0) unawaited(checkStatus());
    });
  }

  void _emit() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    _ticker?.cancel();
    super.dispose();
  }
}

/// No timeout re-arms a code. It must disappear in a subsequent observation
/// (or be replaced by another code) after the result modal has closed.
class QrScanGate {
  bool resumed = true;
  bool routeVisible = true;
  bool scanSelected = false;
  bool busy = false;
  bool modalOpen = false;
  String? _blockedCode;

  bool get cameraAllowed =>
      resumed && routeVisible && scanSelected && !busy && !modalOpen;

  String? observe(Iterable<String> codes) {
    if (!cameraAllowed) return null;
    final present = codes.where((code) => code.trim().isNotEmpty).toSet();
    if (!present.contains(_blockedCode)) _blockedCode = null;
    for (final code in present) {
      if (code != _blockedCode) {
        _blockedCode = code;
        busy = true;
        return code;
      }
    }
    return null;
  }
}
