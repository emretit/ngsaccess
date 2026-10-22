import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';

import '../core/errors.dart';
import '../models/door_operation.dart';
import '../repositories/door_operation_repository.dart';
import '../services/door_operation_store.dart';
import 'auth_provider.dart';

/// Independent command state. It never writes attendance or infers passage.
/// There are no automatic command retries or unbounded status timers.
class DoorOperationProvider extends ChangeNotifier {
  DoorOperationProvider({
    required DoorOperationRepository repository,
    DoorOperationStore? store,
  }) : _repository = repository,
       _store = store ?? FileDoorOperationStore();

  final DoorOperationRepository _repository;
  final DoorOperationStore _store;
  AuthProvider? _auth;
  DoorOperationScope? _scope;
  int? _sessionEpoch;
  int _generation = 0;
  bool _disposed = false;
  bool _isLoading = false;
  bool _restoreFailed = false;
  bool _intentPersisted = false;
  DoorOperationIntent? _intent;
  DoorOperation? _operation;
  AppError? _error;
  Future<void>? _restoreFuture;
  Future<void> _storageEffects = Future<void>.value();

  static const _storageError = BusinessError(
    message: '',
    code: 'OPERATION_STORAGE_FAILED',
  );
  static const _unresolvedError = BusinessError(
    message: '',
    code: 'OPERATION_UNRESOLVED',
  );

  DoorOperation? get operation => _operation;
  bool get isLoading => _isLoading;
  AppError? get error => _error;
  bool get hasUnresolvedOperation =>
      _isLoading || _restoreFailed || _intent != null;
  String? get requestId => _intent?.requestId;
  String? get pendingDeviceId => _intent?.deviceId;
  String? get pendingDoorId => _intent?.doorId;
  bool get canRetrySameRequest =>
      _intent != null && !_isLoading && !_restoreFailed;
  DateTime? get pendingExpiresAt => _operation?.pendingExpiresAt;

  /// Called by the composition root's auth proxy. No listener is installed here.
  /// Ownership/busy change before any await, including while restore is pending.
  Future<void> synchronizeSession(
    AuthProvider auth, {
    required String deployment,
  }) {
    if (_disposed) return Future<void>.value();
    final user = auth.currentUser;
    final projectId = user?.projectId;
    final scope =
        auth.isAuthenticated &&
            user != null &&
            projectId != null &&
            projectId.isNotEmpty &&
            deployment.trim().isNotEmpty
        ? DoorOperationScope(
            userId: user.id,
            projectId: projectId,
            deployment: deployment.trim().replaceFirst(RegExp(r'/+$'), ''),
          )
        : null;
    if (identical(_auth, auth) &&
        _scope == scope &&
        _sessionEpoch == auth.sessionEpoch) {
      return _restoreFuture ?? Future<void>.value();
    }
    _auth = auth;
    _scope = scope;
    _sessionEpoch = auth.sessionEpoch;
    final generation = ++_generation;
    _intent = null;
    _intentPersisted = false;
    _operation = null;
    _error = null;
    _restoreFailed = false;
    _isLoading = scope != null;
    // A proxy's update may run during build. Its dependants rebuild from proxy
    // changes; defer our own notification and avoid notify-during-build errors.
    scheduleMicrotask(() {
      if (!_disposed && _generation == generation) _notify();
    });
    if (scope == null) {
      _restoreFuture = null;
      return Future<void>.value();
    }
    final future = _restore(scope, generation);
    _restoreFuture = future;
    return future;
  }

  bool _owns(DoorOperationScope scope, int generation) {
    final auth = _auth;
    final user = auth?.currentUser;
    return !_disposed &&
        _generation == generation &&
        _scope == scope &&
        auth != null &&
        auth.isAuthenticated &&
        auth.sessionEpoch == _sessionEpoch &&
        user?.id == scope.userId &&
        user?.projectId == scope.projectId;
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  Future<void> _handleError(
    DoorOperationScope scope,
    int generation,
    Object error,
    StackTrace stack,
  ) async {
    if (!_owns(scope, generation)) return;
    final mapped = AppError.fromException(error, stack);
    _error = mapped;
    if (mapped is AuthExpiredError) {
      final auth = _auth;
      final epoch = _sessionEpoch;
      final token = auth?.sessionToken;
      // Capture before any await. A late expiry cannot close a newer session.
      if (auth != null && epoch != null && _owns(scope, generation)) {
        await auth.handleAuthExpiry(
          sessionEpoch: epoch,
          sessionToken: token,
          reason: mapped,
        );
        if (!_disposed &&
            _generation == generation &&
            identical(_auth, auth) &&
            !auth.isAuthenticated) {
          await synchronizeSession(auth, deployment: scope.deployment);
        }
      }
    }
  }

  Future<T> _serializeStorage<T>(Future<T> Function() effect) {
    final result = _storageEffects.then((_) => effect());
    _storageEffects = result.then<void>(
      (_) {},
      onError: (Object error, StackTrace stack) {},
    );
    return result;
  }

  Future<void> _restore(DoorOperationScope scope, int generation) async {
    try {
      final intent = await _serializeStorage(() async {
        if (!_owns(scope, generation)) return null;
        return _store.read(scope);
      });
      if (!_owns(scope, generation)) return;
      _intent = intent;
      _intentPersisted = intent != null;
      _restoreFailed = false;
      if (intent != null) await _query(scope, generation, intent);
    } catch (error, stack) {
      if (!_owns(scope, generation)) return;
      // A failed read cannot establish that no previous intent exists.
      if (_intent == null) {
        _restoreFailed = true;
        _error = _storageError;
      } else {
        await _handleError(scope, generation, error, stack);
      }
    } finally {
      if (_owns(scope, generation)) {
        _isLoading = false;
        _notify();
      }
    }
  }

  /// A new user intention is accepted only after all previous uncertainty ends.
  Future<void> open({required String deviceId, String? doorId}) async {
    final scope = _scope;
    final generation = _generation;
    if (scope == null || !_owns(scope, generation) || _isLoading) return;
    if (_restoreFailed || _intent != null) {
      _error = _unresolvedError;
      _notify();
      return;
    }
    try {
      doorOperationId(deviceId);
      if (doorId != null) doorOperationId(doorId);
    } on AppError catch (error) {
      _error = error;
      _notify();
      return;
    }
    _isLoading = true;
    _error = null;
    _operation = null;
    var requestStarted = false;
    var responseReceived = false;
    // Random.secure is deliberately instantiated before any network effect.
    // If entropy is unavailable, no intention/command is created.
    try {
      final random = Random.secure();
      final id = List<int>.generate(
        16,
        (_) => random.nextInt(256),
      ).map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
      final intent = DoorOperationIntent(
        requestId: id,
        deviceId: deviceId,
        doorId: doorId,
      );
      _intent = intent;
      _intentPersisted = false;
      _notify();
      await _persist(scope, generation, intent);
      if (!_owns(scope, generation)) return;
      // No auto retry: response loss leaves the persisted intention unresolved.
      requestStarted = true;
      final result = await _repository.requestOpen(
        requestId: id,
        deviceId: deviceId,
        doorId: doorId,
      );
      responseReceived = true;
      if (!_owns(scope, generation)) return;
      await _accept(scope, generation, intent, result);
    } catch (error, stack) {
      // A structured rejection of the FIRST mutation proves that transaction
      // did not create a command. Uncertain retries never take this shortcut.
      if (requestStarted &&
          !responseReceived &&
          _isDefiniteRejection(error) &&
          _owns(scope, generation)) {
        try {
          await _serializeStorage(() async {
            if (_owns(scope, generation)) await _store.remove(scope);
          });
          if (_owns(scope, generation)) {
            _intent = null;
            _intentPersisted = false;
          }
        } catch (_) {
          await _handleError(scope, generation, _storageError, stack);
          return;
        }
      }
      await _handleError(scope, generation, error, stack);
    } finally {
      if (_owns(scope, generation)) {
        _isLoading = false;
        _notify();
      }
    }
  }

  bool _isDefiniteRejection(Object error) =>
      error is BusinessError &&
      const {
        'ACCESS_DENIED',
        'TARGET_NOT_ALLOWED',
        'DOOR_REQUIRED',
        'DEVICE_INACTIVE',
        'DOOR_INACTIVE',
        'ACCESS_EPOCH_DENIED',
        'SCHEDULE_DENIED',
        'TARGET_UNSUPPORTED',
        'TRANSPORT_UNSUPPORTED',
        'ACCESS_GRAPH_LIMIT',
        'INVALID_REQUEST_ID',
      }.contains(error.code);

  Future<void> _persist(
    DoorOperationScope scope,
    int generation,
    DoorOperationIntent intent,
  ) async {
    try {
      await _serializeStorage(() async {
        if (_owns(scope, generation)) await _store.write(scope, intent);
      });
      if (_owns(scope, generation)) _intentPersisted = true;
    } catch (_) {
      throw _storageError;
    }
  }

  /// Read-only reconciliation, including when no operationId was received.
  Future<void> checkStatus() async {
    final scope = _scope;
    final generation = _generation;
    if (scope == null || !_owns(scope, generation) || _isLoading) return;
    _isLoading = true;
    _error = null;
    _notify();
    if (_restoreFailed) {
      await _restore(scope, generation);
      return;
    }
    try {
      final intent = _intent;
      if (intent != null) await _query(scope, generation, intent);
    } catch (error, stack) {
      await _handleError(scope, generation, error, stack);
    } finally {
      if (_owns(scope, generation)) {
        _isLoading = false;
        _notify();
      }
    }
  }

  Future<void> _query(
    DoorOperationScope scope,
    int generation,
    DoorOperationIntent intent,
  ) async {
    final operationId = intent.operationId;
    final result = operationId == null
        ? await _repository.getRequestOperation(requestId: intent.requestId)
        : await _repository.getOperation(operationId: operationId);
    if (!_owns(scope, generation)) return;
    if (result == null) {
      // Absence after response loss is not proof that the command never ran.
      _error = _unresolvedError;
      return;
    }
    await _accept(scope, generation, intent, result);
  }

  /// Explicit user retry. Query before resend; an existing snapshot is never
  /// requeued. Null may resend only this exact persisted request and target.
  Future<void> retrySameRequest() async {
    final scope = _scope;
    final generation = _generation;
    final intent = _intent;
    if (scope == null ||
        !_owns(scope, generation) ||
        _isLoading ||
        intent == null) {
      return;
    }
    _isLoading = true;
    _error = null;
    _notify();
    try {
      final known = await _repository.getRequestOperation(
        requestId: intent.requestId,
      );
      if (!_owns(scope, generation)) return;
      if (known != null) {
        await _accept(scope, generation, intent, known);
        return;
      }
      // If a receipt was previously observed, absence is a protocol/scope
      // inconsistency; do not risk recreating an already executed operation.
      if (intent.operationId != null) throw const ProtocolError();
      if (!_intentPersisted) await _persist(scope, generation, intent);
      if (!_owns(scope, generation)) return;
      final result = await _repository.requestOpen(
        requestId: intent.requestId,
        deviceId: intent.deviceId,
        doorId: intent.doorId,
      );
      if (!_owns(scope, generation)) return;
      await _accept(scope, generation, intent, result);
    } catch (error, stack) {
      await _handleError(scope, generation, error, stack);
    } finally {
      if (_owns(scope, generation)) {
        _isLoading = false;
        _notify();
      }
    }
  }

  Future<void> _accept(
    DoorOperationScope scope,
    int generation,
    DoorOperationIntent intent,
    DoorOperation result,
  ) async {
    if (!_owns(scope, generation)) return;
    if (result.deviceId != intent.deviceId ||
        result.doorId != intent.doorId ||
        (intent.operationId != null &&
            result.operationId != intent.operationId)) {
      throw const ProtocolError();
    }
    _operation = result;
    final receipt = intent.withOperation(result.operationId);
    _intent = receipt;
    if (result.isUnresolved) {
      await _persist(scope, generation, receipt);
    } else {
      // Keep the intention blocked if terminal cleanup fails. Relaunch queries
      // its receipt again instead of silently creating a second intention.
      try {
        await _serializeStorage(() async {
          if (_owns(scope, generation)) await _store.remove(scope);
        });
      } catch (_) {
        throw _storageError;
      }
      if (!_owns(scope, generation)) return;
      _intent = null;
      _intentPersisted = false;
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    // Do not delete a server command's local receipt or claim cancellation.
    // Its scoped record remains available for this user's next launch.
    super.dispose();
  }
}
