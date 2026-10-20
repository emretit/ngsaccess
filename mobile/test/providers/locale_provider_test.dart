import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/providers/locale_provider.dart';
import 'package:ngsplusapp/providers/theme_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../helpers/preference_store.dart';

void main() {
  test('missing and unsupported saved locale follow the system', () async {
    for (final value in [null, 'system', 'de', 'corrupt']) {
      final prefs = TestPreferences();
      if (value != null) prefs.values['mobile_locale'] = value;
      final provider = LocaleProvider(preferencesLoader: () async => prefs);
      await provider.bootstrap();
      expect(provider.locale, isNull);
      provider.dispose();
    }
  });

  test('TR to EN to system survives a new provider instance', () async {
    final prefs = TestPreferences();
    final provider = LocaleProvider(preferencesLoader: () async => prefs);
    addTearDown(provider.dispose);
    for (final locale in [const Locale('tr'), const Locale('en'), null]) {
      expect(await provider.setLocale(locale), isTrue);
      final restored = LocaleProvider(preferencesLoader: () async => prefs);
      await restored.bootstrap();
      expect(restored.locale, locale);
      restored.dispose();
    }
  });

  test('late saved TR cannot replace a new EN selection', () async {
    final stale = TestPreferences()..values['mobile_locale'] = 'tr';
    final prefs = TestPreferences();
    final read = Completer<SharedPreferences>();
    var loads = 0;
    final provider = LocaleProvider(
      preferencesLoader: () => ++loads == 1 ? read.future : Future.value(prefs),
    );
    addTearDown(provider.dispose);
    final bootstrap = provider.bootstrap();
    await provider.setLocale(const Locale('en'));
    read.complete(stale);
    await bootstrap;
    expect(provider.locale, const Locale('en'));
  });

  test(
    'serialized locale failure retains the prior successfully saved choice',
    () async {
      final prefs = TestPreferences()..writeGate = Completer<void>();
      final provider = LocaleProvider(preferencesLoader: () async => prefs);
      addTearDown(provider.dispose);
      final first = provider.setLocale(const Locale('en'));
      await prefs.writeStarted.future;
      final second = provider.setLocale(const Locale('tr'));
      prefs.rejectedWrites.add(2);
      prefs.writeGate?.complete();
      await Future.wait([first, second]);
      expect(provider.locale, const Locale('en'));
      expect(prefs.values['mobile_locale'], 'en');
      expect(prefs.maxConcurrentWrites, 1);
      expect(provider.error, PreferenceError.storage);
      expect(provider.isSaving, isFalse);
    },
  );

  test('unsupported user choice is rejected without writing', () async {
    final prefs = TestPreferences();
    final provider = LocaleProvider(preferencesLoader: () async => prefs);
    addTearDown(provider.dispose);
    expect(await provider.setLocale(const Locale('de')), isFalse);
    expect(provider.locale, isNull);
    expect(provider.error, PreferenceError.invalidSelection);
    expect(prefs.writes, isEmpty);
  });

  test('disposed provider ignores a late bootstrap', () async {
    final read = Completer<SharedPreferences>();
    final provider = LocaleProvider(preferencesLoader: () => read.future);
    final bootstrap = provider.bootstrap();
    provider.dispose();
    read.complete(TestPreferences()..values['mobile_locale'] = 'en');
    await bootstrap;
    expect(provider.locale, isNull);
  });
}
