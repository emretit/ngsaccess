import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'theme_provider.dart' show PreferenceError, PreferencesLoader;

/// Device-wide preference, retained on logout. Null follows the operating system.
class LocaleProvider extends ChangeNotifier {
  LocaleProvider({PreferencesLoader? preferencesLoader})
    : _preferencesLoader = preferencesLoader ?? SharedPreferences.getInstance;

  static const _key = 'mobile_locale';
  final PreferencesLoader _preferencesLoader;
  Future<void> _writes = Future<void>.value();
  Locale? _locale;
  PreferenceError? _error;
  int _revision = 0;
  int _pending = 0;
  bool _disposed = false;

  Locale? get locale => _locale;
  PreferenceError? get error => _error;
  bool get isSaving => _pending > 0;

  Future<void> bootstrap() async {
    if (_disposed || _pending > 0) return;
    final revision = _revision;
    try {
      final prefs = await _preferencesLoader();
      if (_disposed || revision != _revision) return;
      _locale = switch (prefs.getString(_key)) {
        'tr' => const Locale('tr'),
        'en' => const Locale('en'),
        _ => null,
      };
      _error = null;
    } catch (_) {
      if (_disposed || revision != _revision) return;
      _error = PreferenceError.storage;
    }
    _notify();
  }

  Future<bool> setLocale(Locale? locale) async {
    if (_disposed) return false;
    if (locale != null && !const ['tr', 'en'].contains(locale.languageCode)) {
      _error = PreferenceError.invalidSelection;
      _notify();
      return false;
    }
    final revision = ++_revision;
    final selection = locale == null ? null : Locale(locale.languageCode);
    _pending++;
    _error = null;
    _notify();
    var saved = false;
    final operation = _writes.then((_) async {
      if (_disposed) return;
      try {
        final prefs = await _preferencesLoader();
        if (_disposed) return;
        if (!await prefs.setString(_key, selection?.languageCode ?? 'system')) {
          throw StateError('Preference write rejected');
        }
        saved = true;
        if (!_disposed) _locale = selection;
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
