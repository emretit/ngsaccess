import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/providers/theme_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../helpers/preference_store.dart';

void main() {
  test('late bootstrap cannot undo an explicit user selection', () async {
    final stale = TestPreferences()..values['mobile_theme_mode'] = 'dark';
    final prefs = TestPreferences();
    final read = Completer<SharedPreferences>();
    var loads = 0;
    final provider = ThemeProvider(
      preferencesLoader: () => ++loads == 1 ? read.future : Future.value(prefs),
    );
    addTearDown(provider.dispose);
    final bootstrap = provider.bootstrap();
    expect(await provider.setThemeMode(ThemeMode.system), isTrue);
    read.complete(stale);
    await bootstrap;
    expect(provider.themeMode, ThemeMode.system);
    expect(prefs.values['mobile_theme_mode'], 'system');
  });

  test(
    'rapid choices serialize writes and retain the last verified success',
    () async {
      final prefs = TestPreferences()..writeGate = Completer<void>();
      final provider = ThemeProvider(preferencesLoader: () async => prefs);
      addTearDown(provider.dispose);
      final first = provider.setThemeMode(ThemeMode.dark);
      await prefs.writeStarted.future;
      prefs.rejectedWrites.add(2);
      final second = provider.setThemeMode(ThemeMode.system);
      expect(provider.isSaving, isTrue);
      prefs.writeGate?.complete();
      await Future.wait([first, second]);
      expect(prefs.maxConcurrentWrites, 1);
      expect(provider.themeMode, ThemeMode.dark);
      expect(prefs.values['mobile_theme_mode'], 'dark');
      expect(provider.error, PreferenceError.storage);
      expect(provider.isSaving, isFalse);
    },
  );

  test('a rejected write does not pretend the new choice was saved', () async {
    final prefs = TestPreferences()..rejectedWrites.add(1);
    final provider = ThemeProvider(preferencesLoader: () async => prefs);
    addTearDown(provider.dispose);
    expect(await provider.setThemeMode(ThemeMode.dark), isFalse);
    expect(provider.themeMode, ThemeMode.light);
    expect(provider.error, PreferenceError.storage);
    expect(provider.isSaving, isFalse);
  });

  test('bootstrap storage failure and disposal are safe', () async {
    final provider = ThemeProvider(
      preferencesLoader: () async => throw StateError('fixture'),
    );
    await provider.bootstrap();
    expect(provider.error, PreferenceError.storage);
    provider.dispose();
    expect(await provider.setThemeMode(ThemeMode.dark), isFalse);
  });

  test('pending write never notifies after disposal', () async {
    final prefs = TestPreferences()..writeGate = Completer<void>();
    final provider = ThemeProvider(preferencesLoader: () async => prefs);
    var notifications = 0;
    provider.addListener(() => notifications++);
    final save = provider.setThemeMode(ThemeMode.dark);
    await prefs.writeStarted.future;
    provider.dispose();
    final before = notifications;
    prefs.writeGate?.complete();
    expect(await save, isFalse);
    expect(notifications, before);
  });
}
