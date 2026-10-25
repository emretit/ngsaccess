import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/core/error_localizer.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/l10n/app_localizations_tr.dart';
import 'package:ngsplusapp/l10n/app_localizations_en.dart';

void main() {
  testWidgets(
    'all 16 request codes map to dedicated TR and EN keys and safe fallback',
    (tester) async {
      for (final locale in [const Locale('tr'), const Locale('en')]) {
        final l = locale.languageCode == 'tr'
            ? AppLocalizationsTr()
            : AppLocalizationsEn();
        final messages = <String, String>{
          'REQUEST_PROJECT_MISSING': l.errorRequestProjectMissing,
          'REQUEST_NOTE_TOO_LONG': l.errorRequestNoteTooLong,
          'REQUEST_DATE_INVALID': l.errorRequestDateInvalid,
          'REQUEST_RANGE_INVALID': l.errorRequestRangeInvalid,
          'REQUEST_START_TOO_OLD': l.errorRequestStartTooOld,
          'REQUEST_RANGE_TOO_LONG': l.errorRequestRangeTooLong,
          'REQUEST_PENDING_LIMIT': l.errorRequestPendingLimit,
          'REQUEST_OVERLAP_PENDING': l.errorRequestOverlapPending,
          'REQUEST_OVERLAP_APPROVED': l.errorRequestOverlapApproved,
          'REQUEST_NOT_FOUND': l.errorRequestNotFound,
          'REQUEST_NOT_PENDING': l.errorRequestNotPending,
          'CORRECTION_DATE_OUT_OF_RANGE': l.errorCorrectionDateOutOfRange,
          'CORRECTION_REASON_LENGTH': l.errorCorrectionReasonLength,
          'CORRECTION_TIMES_MISMATCH': l.errorCorrectionTimesMismatch,
          'CORRECTION_TIME_INVALID': l.errorCorrectionTimeInvalid,
          'CORRECTION_PENDING_EXISTS': l.errorCorrectionPendingExists,
        };
        await tester.pumpWidget(
          MaterialApp(
            locale: locale,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Builder(
              builder: (context) {
                for (final entry in messages.entries) {
                  final error = BusinessError(
                    message: 'UNTRUSTED SERVER TEXT',
                    code: entry.key,
                  );
                  expect(normalizeBusinessCode(entry.key), entry.key);
                  expect(localizeAppError(context, error), entry.value);
                  expect(error.userMessage, isNot(contains('UNTRUSTED')));
                  if (locale.languageCode == 'tr') {
                    expect(error.userMessage, entry.value);
                  }
                }
                return const SizedBox();
              },
            ),
          ),
        );
        await tester.pumpAndSettle();
      }
    },
  );
}
