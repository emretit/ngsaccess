import 'dart:async';
import 'package:flutter/foundation.dart';
import '../core/errors.dart';
import '../models/employee_request.dart';
import '../repositories/request_repository.dart';
import 'auth_provider.dart';

class RequestProvider extends ChangeNotifier {
  RequestProvider({required RequestRepository repository}) : _repo = repository;
  final RequestRepository _repo;
  AuthProvider? _auth;
  int _generation = 0, _load = 0;
  bool _disposed = false;
  ({String? token, int epoch})? _identity;
  List<LeaveRequest> leaves = [];
  List<AttendanceCorrectionRequest> corrections = [];
  bool loading = false, busy = false, uncertain = false;
  AppError? error, commandError;
  void synchronizeSession(AuthProvider auth) {
    final identity = (
      token: auth.isAuthenticated ? auth.sessionToken : null,
      epoch: auth.sessionEpoch,
    );
    _auth = auth;
    if (identity == _identity) return;
    _identity = identity;
    _generation++;
    _load++;
    leaves = [];
    corrections = [];
    loading = false;
    busy = false;
    uncertain = false;
    error = null;
    commandError = null;
    _publish();
  }

  bool _current(int generation) =>
      !_disposed && generation == _generation && _identity?.token != null;
  void _publish() {
    if (!_disposed) notifyListeners();
  }

  void _expiry(AppError error) {
    if (error is AuthExpiredError) {
      unawaited(
        _auth?.handleAuthExpiry(
              reason: error,
              sessionToken: _identity?.token,
              sessionEpoch: _identity?.epoch,
            ) ??
            Future<void>.value(),
      );
    }
  }

  Future<void> refresh() async {
    final generation = _generation, load = ++_load;
    if (!_current(generation)) return;
    loading = true;
    error = null;
    _publish();
    try {
      // Read both once; no subscriptions or timers.
      final rows = await Future.wait<Object>([
        _repo.listLeaves(),
        _repo.listCorrections(),
      ]);
      if (!_current(generation) || load != _load) return;
      leaves = rows[0] as List<LeaveRequest>;
      corrections = rows[1] as List<AttendanceCorrectionRequest>;
    } catch (e, stack) {
      if (!_current(generation) || load != _load) return;
      error = AppError.fromException(e, stack);
      _expiry(error ?? const ProtocolError());
    } finally {
      if (_current(generation) && load == _load) {
        loading = false;
        _publish();
      }
    }
  }

  bool _isUncertainResult(AppError error) =>
      error is NetworkError ||
      error is TimeoutError ||
      error is ProtocolError ||
      (error is ServerError &&
          error.statusCode >= 500 &&
          error.statusCode < 600 &&
          error.statusCode != 560);

  Future<bool> _command(Future<Object?> Function() action) async {
    final generation = _generation;
    if (busy || !_current(generation)) {
      commandError = null;
      return false;
    }
    busy = true;
    commandError = null;
    uncertain = false;
    _publish();
    var success = false;
    try {
      await action();
      success = true;
    } catch (e, stack) {
      if (!_current(generation)) return false;
      final mapped = AppError.fromException(e, stack);
      commandError = mapped;
      uncertain = _isUncertainResult(mapped);
      _expiry(mapped);
    }
    if (!_current(generation)) return false;
    if (success || uncertain) await refresh();
    if (!_current(generation)) return false;
    busy = false;
    _publish();
    return success;
  }

  Future<bool> submitLeave({
    required String leaveType,
    required String startDate,
    required String endDate,
    String? notes,
  }) => _command(
    () => _repo.submitLeave(
      leaveType: leaveType,
      startDate: startDate,
      endDate: endDate,
      notes: notes,
    ),
  );
  Future<bool> submitCorrection({
    required String date,
    required String correctionType,
    required String reason,
    String? requestedCheckIn,
    String? requestedCheckOut,
  }) => _command(
    () => _repo.submitCorrection(
      date: date,
      correctionType: correctionType,
      reason: reason,
      requestedCheckIn: requestedCheckIn,
      requestedCheckOut: requestedCheckOut,
    ),
  );
  Future<bool> withdrawLeave(LeaveRequest row) async =>
      row.canWithdraw ? _command(() => _repo.withdrawLeave(row.id)) : false;
  Future<bool> withdrawCorrection(AttendanceCorrectionRequest row) async =>
      row.canWithdraw
      ? _command(() => _repo.withdrawCorrection(row.id))
      : false;
  @override
  void dispose() {
    _disposed = true;
    _generation++;
    super.dispose();
  }
}
