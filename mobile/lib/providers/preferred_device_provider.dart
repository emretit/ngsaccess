import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/device.dart';
import 'theme_provider.dart' show PreferenceError, PreferencesLoader;

/// A convenience preference, never an authorization source. The backend must
/// independently authorize the selected operation on every request.
class PreferredDeviceProvider extends ChangeNotifier {
  PreferredDeviceProvider({PreferencesLoader? preferencesLoader})
    : _preferencesLoader = preferencesLoader ?? SharedPreferences.getInstance;

  static const storageKey = 'mobile_preferred_device_v1';
  final PreferencesLoader _preferencesLoader;
  Future<void> _operations = Future<void>.value();
  ({String employeeId, String projectId, String deployment})? _identity;
  String? _deviceId;
  String? _deviceName;
  String? _doorId;
  String? _targetId;
  PreferenceError? _error;
  int _generation = 0;
  int _pending = 0;
  bool _disposed = false;
  bool _wasInvalidated = false;

  String? get deviceId => _deviceId;
  String? get deviceName => _deviceName;
  String? get doorId => _doorId;
  String? get targetId => _targetId;
  bool get hasDevice => _deviceId != null;
  bool get hasIdentity => _identity != null;
  bool get isSaving => _pending > 0;
  PreferenceError? get error => _error;
  bool get wasInvalidated => _wasInvalidated;
  int get identityGeneration => _generation;

  /// Resets memory synchronously before starting scoped persistence reads.
  /// A missing project/deployment fails closed rather than adopting old data.
  Future<void> setIdentity(
    String? employeeId, {
    String? projectId,
    String? deployment,
  }) async {
    final next =
        employeeId == null ||
            employeeId.trim().isEmpty ||
            projectId == null ||
            projectId.trim().isEmpty ||
            deployment == null ||
            deployment.trim().isEmpty
        ? null
        : (
            employeeId: employeeId,
            projectId: projectId,
            deployment: deployment,
          );
    if (_disposed || next == _identity) return;
    _identity = next;
    _generation++;
    _deviceId = null;
    _deviceName = null;
    _doorId = null;
    _targetId = null;
    _error = null;
    _wasInvalidated = false;
    _pending = 0;
    _notify();
    await bootstrap();
  }

  Future<void> bootstrap() async {
    final generation = _generation;
    final identity = _identity;
    final operation = _operations.then((_) async {
      if (!_owns(generation)) return;
      try {
        final prefs = await _preferencesLoader();
        if (!_owns(generation)) return;
        // Unscoped legacy records must never be attributed to a new account.
        for (final key in [
          'mobile_preferred_device_id',
          'mobile_preferred_device_name',
        ]) {
          if (prefs.containsKey(key) && !await prefs.remove(key)) {
            throw StateError('Legacy preference cleanup rejected');
          }
        }
        if (!_owns(generation) || identity == null) return;
        final raw = prefs.getString(storageKey);
        if (raw == null) return;
        final Object? record = jsonDecode(raw);
        if (record is! Map<String, Object?> ||
            record['version'] != 1 ||
            record['employeeId'] != identity.employeeId ||
            record['projectId'] != identity.projectId ||
            record['deployment'] != identity.deployment) {
          return;
        }
        final device = record['device'];
        if (device == null) return;
        if (device is! Map<String, Object?>) {
          throw const FormatException('Invalid preferred device');
        }
        final decoded = Device.fromConvex(device);
        if (!_owns(generation)) return;
        _deviceId = decoded.id;
        _deviceName = decoded.name;
        _doorId = decoded.doorId;
        _targetId = decoded.targetId;
        _error = null;
      } catch (_) {
        if (_owns(generation)) _error = PreferenceError.storage;
      }
      if (_owns(generation)) _notify();
    });
    _operations = operation;
    await operation;
  }

  Future<bool> setDevice({
    required String id,
    required String? name,
    String? doorId,
    String? targetId,
  }) {
    if (id.isEmpty ||
        id.trim() != id ||
        id == 'null' ||
        (doorId != null &&
            (doorId.isEmpty || doorId.trim() != doorId || doorId == 'null')) ||
        (targetId != null &&
            (targetId.isEmpty ||
                targetId.trim() != targetId ||
                targetId == 'null'))) {
      _error = PreferenceError.invalidSelection;
      _notify();
      return Future.value(false);
    }
    return _save(id: id, name: name, doorId: doorId, targetId: targetId);
  }

  Future<bool> clear() => _save();

  /// Only call after a successful, complete employee-scoped device list. A
  /// transport failure is not evidence that the employee lost access.
  Future<bool> revalidate(List<Device> devices) async {
    final generation = _generation;
    // The server list may arrive before scoped restoration finishes. Validate
    // the restored value rather than treating the temporary empty memory as final.
    await _operations;
    if (!_owns(generation)) return false;
    final id = _deviceId;
    if (id == null) return true;
    Device? match;
    for (final device in devices) {
      if (device.id == id &&
          device.doorId == _doorId &&
          (device.targetId == _targetId ||
              (_targetId == null && device.doorId == null))) {
        match = device;
        break;
      }
    }
    if (match == null ||
        const [
          'DEVICE_INACTIVE',
          'DOOR_INACTIVE',
          'ACCESS_EPOCH_DENIED',
        ].contains(match.reason)) {
      // Revoke the in-memory hint immediately, even if disk is unavailable.
      _deviceId = null;
      _deviceName = null;
      _doorId = null;
      _targetId = null;
      _wasInvalidated = true;
      _notify();
      return _save(invalidated: true);
    }
    final label = match.doorName ?? match.name;
    if (label != _deviceName || match.targetId != _targetId) {
      return _save(
        id: id,
        name: label,
        doorId: match.doorId,
        targetId: match.targetId,
      );
    }
    return true;
  }

  Future<bool> _save({
    String? id,
    String? name,
    String? doorId,
    String? targetId,
    bool invalidated = false,
  }) async {
    final identity = _identity;
    if (_disposed) return false;
    if (identity == null) {
      _error = PreferenceError.unavailableIdentity;
      _notify();
      return false;
    }
    final generation = _generation;
    final record = jsonEncode({
      'version': 1,
      'employeeId': identity.employeeId,
      'projectId': identity.projectId,
      'deployment': identity.deployment,
      'device': id == null
          ? null
          : {'id': id, 'name': name, 'doorId': doorId, 'targetId': targetId},
    });
    _pending++;
    _error = null;
    _notify();
    var saved = false;
    final operation = _operations.then((_) async {
      if (!_owns(generation)) return;
      try {
        final prefs = await _preferencesLoader();
        if (!_owns(generation)) return;
        if (!await prefs.setString(storageKey, record)) {
          throw StateError('Preference write rejected');
        }
        if (!_owns(generation)) return;
        _deviceId = id;
        _deviceName = name;
        _doorId = doorId;
        _targetId = targetId;
        _wasInvalidated = invalidated;
        _error = null;
        saved = true;
      } catch (_) {
        if (_owns(generation)) _error = PreferenceError.storage;
      }
    });
    _operations = operation;
    await operation;
    if (!_owns(generation)) return false;
    _pending--;
    _notify();
    return saved;
  }

  bool _owns(int generation) => !_disposed && generation == _generation;

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    super.dispose();
  }
}
