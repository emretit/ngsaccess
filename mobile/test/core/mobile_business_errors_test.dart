import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/error_localizer.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/core/response_decoder.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';

const _messages = <String, List<String>>{
  "SUMMARY_TOO_LARGE": [
    "Bu dönem için özet oluşturulamıyor. Tarih aralığını küçültün.",
    "This period is too large to summarize. Select a shorter date range.",
  ],
  "INVALID_CURSOR": [
    "Geçmiş sayfası artık geçerli değil. Listeyi yenileyin.",
    "This history page is no longer valid. Refresh the list.",
  ],
  "DEVICE_NOT_FOUND": [
    "Cihaz bu projede bulunamadı. Cihaz seçimini yenileyin veya yöneticinize başvurun.",
    "The device could not be found in this project. Refresh your device selection or contact your administrator.",
  ],
  "SUMMARY_INVALID_DATA": [
    "Kayıt zamanları doğrulanamadı. Kayıtların kontrolü için yöneticinize başvurun.",
    "Record times could not be verified. Contact your administrator to check the records.",
  ],
  "VISITOR_INVALID": [
    "Ziyaretçi bilgileri veya liste sayfası geçersiz. Bilgileri ve tarihleri kontrol edin; gerekirse listeyi yenileyin.",
    "Visitor details or the list page are invalid. Check the details and dates; refresh the list if needed.",
  ],
  "VISITOR_LOCKED": [
    "Bu davet artık düzenlenemiyor. Daveti yenileyin veya operatöre başvurun.",
    "This invitation can no longer be edited. Refresh the invitation or contact the operator.",
  ],
  "VISITOR_NOTICE_CHANGED": [
    "Ziyaretçi aydınlatma metni değişti. Davet formunu yenileyip güncel metni okuyun ve tekrar onaylayın.",
    "The visitor privacy notice has changed. Refresh the invitation form, read the updated notice and confirm again.",
  ],
  "REQUEST_CONFLICT": [
    "Bu işlem farklı ziyaretçi bilgileriyle daha önce kaydedilmiş. Ziyaretçi listesini yenileyip mevcut daveti kontrol edin.",
    "This request was already saved with different visitor details. Refresh the visitor list and check the existing invitation.",
  ],
};

BusinessError _decode(String code, int status) {
  try {
    decodeConvexResponse(
      statusCode: status,
      body: jsonEncode({
        'status': 'error',
        'errorMessage': 'private-backend-marker',
        'errorData': {'code': code, 'message': 'private-backend-marker'},
      }),
    );
  } on BusinessError catch (error) {
    return error;
  }
  throw StateError('Expected a typed business error');
}

void main() {
  for (final entry in _messages.entries) {
    for (final status in [200, 560]) {
      test('$status preserves ${entry.key} and uses safe fallback text', () {
        final error = _decode(entry.key, status);
        expect(error.code, entry.key);
        expect(error.safeCode, entry.key);
        expect(error.message, isEmpty);
        expect(error.userMessage, entry.value[0]);
        expect(error.toString(), isNot(contains('private-backend-marker')));
      });
    }
  }
  test('unknown future codes retain generic safe failure', () {
    final error = _decode('PRIVATE_FUTURE_CODE', 560);
    expect(error.safeCode, 'BUSINESS_ERROR');
    expect(error.message, isEmpty);
    expect(error.userMessage, isNot(contains('private-backend-marker')));
  });
  for (final language in ['tr', 'en']) {
    testWidgets('$language localizes all attendance and visitor error codes', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: Locale(language),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: Builder(
              builder: (context) => SingleChildScrollView(
                child: Column(
                  children: [
                    for (final code in _messages.keys)
                      Text(localizeAppError(context, _decode(code, 560))),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      for (final message in _messages.values) {
        expect(find.text(message[language == 'tr' ? 0 : 1]), findsOneWidget);
      }
      expect(find.textContaining('private-backend-marker'), findsNothing);
      expect(tester.takeException(), isNull);
    });
  }
}
