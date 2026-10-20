import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Storage failures are codes; presentation supplies the localized explanation.
enum PreferenceError { storage, unavailableIdentity, invalidSelection }

typedef PreferencesLoader = Future<SharedPreferences> Function();

class ThemeProvider extends ChangeNotifier {
  ThemeProvider({PreferencesLoader? preferencesLoader})
    : _preferencesLoader = preferencesLoader ?? SharedPreferences.getInstance;

  static const _key = 'mobile_theme_mode';
  final PreferencesLoader _preferencesLoader;
  Future<void> _writes = Future<void>.value();
  ThemeMode _themeMode = ThemeMode.light;
  PreferenceError? _error;
  int _revision = 0;
  int _pending = 0;
  bool _disposed = false;

  ThemeMode get themeMode => _themeMode;
  PreferenceError? get error => _error;
  bool get isSaving => _pending > 0;

  Future<void> bootstrap() async {
    if (_disposed || _pending > 0) return;
    final revision = _revision;
    try {
      final prefs = await _preferencesLoader();
      if (_disposed || revision != _revision) return;
      _themeMode = switch (prefs.getString(_key)) {
        'dark' => ThemeMode.dark,
        'system' => ThemeMode.system,
        _ => ThemeMode.light,
      };
      _error = null;
    } catch (_) {
      if (_disposed || revision != _revision) return;
      _error = PreferenceError.storage;
    }
    _notify();
  }

  Future<bool> setThemeMode(ThemeMode mode) async {
    if (_disposed) return false;
    final revision = ++_revision;
    _pending++;
    _error = null;
    _notify();
    var saved = false;
    final operation = _writes.then((_) async {
      if (_disposed) return;
      try {
        final prefs = await _preferencesLoader();
        if (_disposed) return;
        if (!await prefs.setString(_key, mode.name)) {
          throw StateError('Preference write rejected');
        }
        saved = true;
        if (!_disposed) _themeMode = mode;
      } catch (_) {
        if (!_disposed && revision == _revision) {
          _error = PreferenceError.storage;
        }
      }
    });
    _writes = operation;
    await operation;
    if (_disposed) return false;
    _pending--;
    _notify();
    return saved && revision == _revision;
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _revision++;
    super.dispose();
  }
}
