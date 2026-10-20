import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/error_localizer.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';

void main() {
  for (final language in ['tr', 'en']) {
    testWidgets(
      '$language never displays arbitrary backend body or exception text',
      (tester) async {
        const marker = 'password-token-card-email-marker';
        const errors = <AppError>[
          BusinessError(message: marker, code: marker),
          ServerError(statusCode: 503, body: marker),
          NetworkError(marker),
          AuthExpiredError(marker),
          UnknownError(marker),
          ProtocolError(),
          BusinessError(message: marker, code: 'RATE_LIMITED'),
          BusinessError(message: marker, code: 'SESSION_STORAGE_FAILED'),
        ];
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
                      for (final error in errors)
                        Text(localizeAppError(context, error)),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.textContaining(marker), findsNothing);
        for (final text in tester.widgetList<Text>(find.byType(Text))) {
          expect(text.data, isNotEmpty);
          expect(text.data, isNot(contains('BusinessError')));
          expect(text.data, isNot(contains('ProtocolError')));
        }
      },
    );

    testWidgets('$language maps stable credentials code to localized text', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: Locale(language),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: Builder(
              builder: (context) => Text(
                localizeAppError(
                  context,
                  const BusinessError(
                    message: 'hidden-marker',
                    code: 'INVALID_CREDENTIALS',
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text(
          language == 'tr'
              ? 'E-posta veya şifre hatalı'
              : 'Invalid email or password',
        ),
        findsOneWidget,
      );
      expect(find.textContaining('hidden-marker'), findsNothing);
    });

    testWidgets(
      '$language localizes operation denials while recovery stays generic',
      (tester) async {
        const denialCodes = [
          'TARGET_NOT_ALLOWED',
          'DOOR_REQUIRED',
          'DEVICE_INACTIVE',
          'DOOR_INACTIVE',
          'ACCESS_EPOCH_DENIED',
          'SCHEDULE_DENIED',
          'TARGET_UNSUPPORTED',
          'TRANSPORT_UNSUPPORTED',
          'ACCESS_GRAPH_LIMIT',
          'REQUEST_TARGET_MISMATCH',
          'READER_REQUIRED',
        ];
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
                      for (final code in [
                        ...denialCodes,
                        'OPERATION_UNRESOLVED',
                        'OPERATION_STORAGE_FAILED',
                        'private-code-marker',
                      ])
                        Text(
                          localizeAppError(
                            context,
                            BusinessError(
                              message: 'private-message-marker',
                              code: code,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(
          find.text(language == 'tr' ? 'Erişim reddedildi' : 'Access denied'),
          findsNWidgets(denialCodes.length),
        );
        expect(
          find.text(
            language == 'tr'
                ? 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.'
                : 'An unexpected error occurred. Please try again.',
          ),
          findsNWidgets(3),
        );
        expect(find.textContaining('private-'), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
