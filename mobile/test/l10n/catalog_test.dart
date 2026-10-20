import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/l10n/app_localizations_en.dart';
import 'package:ngsplusapp/l10n/app_localizations_tr.dart';

Map<String, Object?> _catalog(String locale) {
  final Object? decoded = jsonDecode(
    File('lib/l10n/app_$locale.arb').readAsStringSync(),
  );
  if (decoded is! Map<String, Object?>) throw StateError('Invalid catalog');
  return decoded;
}

void main() {
  test(
    'TR/EN preserve the release key inventory and placeholder contracts',
    () {
      final tr = _catalog('tr');
      final en = _catalog('en');
      final Object? inventory = jsonDecode(
        File('test/l10n/expected_keys.json').readAsStringSync(),
      );
      final trKeys = tr.keys.where((key) => !key.startsWith('@')).toList()
        ..sort();
      final enKeys = en.keys.where((key) => !key.startsWith('@')).toList()
        ..sort();
      expect(trKeys, inventory);
      expect(enKeys, inventory);
      for (final key in trKeys) {
        expect(tr[key], isA<String>());
        expect(en[key], isA<String>());
        final trMetadata = tr['@$key'];
        final enMetadata = en['@$key'];
        final trParams = trMetadata is Map<String, Object?>
            ? trMetadata['placeholders']
            : null;
        final enParams = enMetadata is Map<String, Object?>
            ? enMetadata['placeholders']
            : null;
        expect(enParams, trParams, reason: '$key placeholder contract');
      }
    },
  );

  test(
    'record count translations preserve zero/singular/plural and Turkish numbers',
    () {
      final en = AppLocalizationsEn();
      final tr = AppLocalizationsTr();
      expect(en.homeExtraMovements(1), '+1 movement');
      expect(en.historyWeeklyTotalRecords(1), '1 record this week');
      expect(en.historyDayRecordCount(1), '1 record');
      for (final count in [0, 2, 1000]) {
        expect(en.homeExtraMovements(count), '+$count movements');
        expect(en.historyDayRecordCount(count), '$count records');
        expect(tr.historyDayRecordCount(count), contains('$count'));
      }
    },
  );
}
