import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/providers/visitor_provider.dart';
import 'package:ngsplusapp/screens/visitor/visitor_form_screen.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import 'package:ngsplusapp/widgets/visitor/visitor_labels.dart';
import 'package:provider/provider.dart';

import '../../helpers/recording_visitors.dart' show RecordingVisitors;

// A Turkey-local host must exercise foreign device zones during plain flutter test.
void main() {
  final turkeyHost =
      DateTime.utc(2030, 1, 2).toLocal().timeZoneOffset ==
      const Duration(hours: 3);
  if (Platform.environment['NGS_VISITOR_TZ_CHILD'] != '1' && turkeyHost) {
    test(
      'Turkey host runs New York and Tokyo regression subprocesses',
      () async {
        for (final zone in ['America/New_York', 'Asia/Tokyo']) {
          final result = await Process.run(
            'flutter',
            [
              'test',
              '--no-pub',
              '--concurrency=1',
              'test/ui_redesign/d3b/turkey_time_test.dart',
            ],
            environment: {'TZ': zone, 'NGS_VISITOR_TZ_CHILD': '1'},
          ).timeout(const Duration(seconds: 120));
          expect(
            result.exitCode,
            0,
            reason: '$zone\n${result.stdout}\n${result.stderr}',
          );
        }
      },
      timeout: const Timeout(Duration(seconds: 120)),
    );
  }
  test(
    'Turkey picker/label boundary is independent of device ${Platform.environment['TZ']}',
    () {
      final instant = DateTime.utc(2030, 1, 2, 6);
      final deviceLocal = instant.toLocal();
      if (Platform.environment['TZ'] == 'UTC') {
        expect(deviceLocal.timeZoneOffset, Duration.zero);
        expect(deviceLocal.hour, 6);
      } else if (Platform.environment['TZ'] == 'America/New_York') {
        expect(deviceLocal.timeZoneOffset, const Duration(hours: -5));
        expect(deviceLocal.hour, 1);
      } else if (Platform.environment['TZ'] == 'Asia/Tokyo') {
        expect(deviceLocal.timeZoneOffset, const Duration(hours: 9));
        expect(deviceLocal.hour, 15);
      }
      expect(
        VisitorTime.time(deviceLocal),
        const TimeOfDay(hour: 9, minute: 0),
      );
      expect(VisitorTime.day(deviceLocal), DateTime.utc(2030, 1, 2));
      expect(
        VisitorTime.instant(
          DateTime.utc(2030, 1, 2),
          const TimeOfDay(hour: 9, minute: 0),
        ),
        instant,
      );
      expect(
        AppDateFormat(
          locale: const Locale('tr'),
          now: instant,
        ).clock(deviceLocal),
        '09:00',
      );
      expect(
        VisitorTime.instant(
          DateTime.utc(2030, 1, 2),
          const TimeOfDay(hour: 0, minute: 15),
        ),
        DateTime.utc(2030, 1, 1, 21, 15),
      );
      for (final (instant, day, time) in [
        (
          DateTime.utc(2030, 1, 2, 20, 30),
          DateTime.utc(2030, 1, 2),
          const TimeOfDay(hour: 23, minute: 30),
        ),
        (
          DateTime.utc(2030, 12, 31, 21, 30),
          DateTime.utc(2031, 1, 1),
          const TimeOfDay(hour: 0, minute: 30),
        ),
      ]) {
        expect(VisitorTime.day(instant.toLocal()), day);
        expect(VisitorTime.time(instant.toLocal()), time);
        expect(VisitorTime.instant(day, time), instant);
      }
    },
  );

  testWidgets(
    '09:00 Turkey picker selection submits 06:00Z on ${Platform.environment['TZ']}',
    (tester) async {
      final repo = RecordingVisitors();
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      final now = DateTime.utc(2030, 1, 1, 4);
      await tester.pumpWidget(
        ChangeNotifierProvider.value(
          value: state,
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            locale: const Locale('tr'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Builder(
              builder: (context) => Scaffold(
                body: TextButton(
                  onPressed: () => Navigator.of(context).push<void>(
                    MaterialPageRoute(
                      builder: (_) =>
                          VisitorFormScreen(now: () => now.toLocal()),
                    ),
                  ),
                  child: const Text('Open'),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).at(0), 'İpek');
      await tester.enterText(find.byType(TextFormField).at(1), 'Şahin');
      final scroll = find
          .descendant(of: find.byType(Form), matching: find.byType(Scrollable))
          .first;
      final purpose = find.widgetWithText(TextFormField, 'Ziyaret Amacı *');
      await tester.scrollUntilVisible(purpose, 200, scrollable: scroll);
      await tester.enterText(purpose, 'Görüşme');
      tester.testTextInput.hide();
      await tester.pumpAndSettle();
      final date = find.byKey(const Key('visitor-start-date'));
      await tester.scrollUntilVisible(date, 200, scrollable: scroll);
      // Exercise the public picker result boundary (calendar day and wall time).
      tester
          .widget<AppDateField>(date)
          .onChanged
          ?.call(DateTime.utc(2030, 1, 2));
      await tester.pump();
      tester
          .widget<AppTimeField>(find.byKey(const Key('visitor-start-time')))
          .onChanged
          ?.call(const TimeOfDay(hour: 9, minute: 0));
      await tester.pump();
      tester
          .widget<AppDateField>(find.byKey(const Key('visitor-end-date')))
          .onChanged
          ?.call(DateTime.utc(2030, 1, 2));
      await tester.pump();
      tester
          .widget<AppTimeField>(find.byKey(const Key('visitor-end-time')))
          .onChanged
          ?.call(const TimeOfDay(hour: 10, minute: 0));
      await tester.pump();
      final context = tester.element(find.byType(VisitorFormScreen));
      expect(
        visitorDate(context, DateTime.utc(2030, 1, 2, 6).toLocal()),
        '2 Oca 2030 Çar 09:00',
      );
      expect(
        visitorDate(context, DateTime.utc(2030, 1, 2, 20, 30).toLocal()),
        '2 Oca 2030 Çar 23:30',
      );
      expect(
        visitorDate(context, DateTime.utc(2030, 12, 31, 21, 30).toLocal()),
        '1 Oca 2031 Çar 00:30',
      );
      expect(
        visitorPeriod(
          context,
          DateTime.utc(2030, 12, 31, 20, 30).toLocal(),
          DateTime.utc(2030, 12, 31, 21, 30).toLocal(),
        ),
        '31 Ara 2030 Sal 23:30 – 1 Oca 2031 Çar 00:30',
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Daveti kaydet'));
      await tester.pumpAndSettle();
      expect(repo.drafts, hasLength(1));
      expect(repo.drafts.single.start, DateTime.utc(2030, 1, 2, 6));
      expect(repo.drafts.single.end, DateTime.utc(2030, 1, 2, 7));
      expect(
        repo.drafts.single.toJson()['visitStart'],
        '2030-01-02T06:00:00.000Z',
      );
      expect(
        find.text('Davet kaydedildi. Yetkili onayı bekleniyor.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );
}
