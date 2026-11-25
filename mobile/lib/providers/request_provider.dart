import 'dart:async';
import 'package:flutter/foundation.dart';
import '../core/errors.dart';
import '../models/employee_request.dart';
import '../models/request_attachment.dart';
import '../repositories/request_repository.dart';
import 'auth_provider.dart';

class RequestProvider extends ChangeNotifier {
  RequestProvider({required RequestRepository repository}) : _repo = repository;
  final RequestRepository _repo;
  AuthProvider? _auth;
  int _generation = 0, _load = 0;
  bool _disposed = false;
  ({String? token, int epoch})? _identity;
  Object? get sessionIdentity => _identity;
  List<LeaveRequest> leaves = [];
  List<AttendanceCorrectionRequest> corrections = [];
  bool loading = false, busy = false, uncertain = false;
  bool attachmentUploadFailed = false;
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
    attachmentUploadFailed = false;
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
    attachmentUploadFailed = false;
    _publish();
    var success = false;
    try {
      await action();
      success = true;
    } catch (e, stack) {
      if (!_current(generation)) return false;
      final mapped = AppError.fromException(e, stack);
      commandError = mapped;
      uncertain = !attachmentUploadFailed && _isUncertainResult(mapped);
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
    List<RequestAttachmentFile> attachments = const [],
  }) => _command(
    () => _withAttachments(
      attachments,
      (ids) => _repo.submitLeave(
        leaveType: leaveType,
        startDate: startDate,
        endDate: endDate,
        notes: notes,
        attachmentIds: ids,
      ),
    ),
  );
  Future<bool> submitCorrection({
    required String date,
    required String correctionType,
    required String reason,
    String? requestedCheckIn,
    String? requestedCheckOut,
    List<RequestAttachmentFile> attachments = const [],
  }) => _command(
    () => _withAttachments(
      attachments,
      (ids) => _repo.submitCorrection(
        date: date,
        correctionType: correctionType,
        reason: reason,
        requestedCheckIn: requestedCheckIn,
        requestedCheckOut: requestedCheckOut,
        attachmentIds: ids,
      ),
    ),
  );
  Future<String> _withAttachments(
    List<RequestAttachmentFile> files,
    Future<String> Function(List<String>) submit,
  ) async {
    if (files.length > 3) throw const ProtocolError();
    final identity = _identity;
    final ids = <String>[];
    var submitted = false;
    try {
      for (final file in files) {
        ids.add(await _repo.uploadAttachment(file));
        if (_disposed || identity != _identity) throw const AuthExpiredError();
      }
      if (_disposed || identity != _identity) throw const AuthExpiredError();
      submitted = true;
      return await submit(ids);
    } catch (_) {
      // The server refuses to discard already-linked files after an uncertain submit.
      if (identity == _identity) {
        attachmentUploadFailed = !submitted;
        for (final id in ids) {
          try {
            await _repo.discardAttachment(id);
          } catch (_) {
            /* Daily server cleanup retries abandoned slots. */
          }
        }
      }
      rethrow;
    }
  }

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
