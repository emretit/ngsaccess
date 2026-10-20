import 'dart:async';

import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Deterministic storage with independently controlled failure and completion.
class TestPreferences extends Mock implements SharedPreferences {
  final Map<String, String> values = {};
  final List<String> writes = [];
  final Set<int> rejectedWrites = {};
  final writeStarted = Completer<void>();
  Completer<void>? writeGate;
  bool rejectRemovals = false;
  int _activeWrites = 0;
  int maxConcurrentWrites = 0;

  @override
  String? getString(String key) => values[key];

  @override
  bool containsKey(String key) => values.containsKey(key);

  @override
  Future<bool> setString(String key, String value) async {
    writes.add(value);
    final number = writes.length;
    _activeWrites++;
    if (_activeWrites > maxConcurrentWrites) {
      maxConcurrentWrites = _activeWrites;
    }
    if (!writeStarted.isCompleted) writeStarted.complete();
    await writeGate?.future;
    _activeWrites--;
    if (rejectedWrites.contains(number)) return false;
    values[key] = value;
    return true;
  }

  @override
  Future<bool> remove(String key) async {
    if (rejectRemovals) return false;
    values.remove(key);
    return true;
  }
}
