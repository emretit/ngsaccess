import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:ngsplusapp/core/attendance_date.dart';
import 'package:ngsplusapp/providers/attendance_provider.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/request_provider.dart';
import 'package:ngsplusapp/screens/history/history_screen.dart';
import 'package:ngsplusapp/screens/requests/requests_screen.dart';
import 'package:ngsplusapp/widgets/history/history_calendar.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import 'package:provider/provider.dart';

import '../../auth_fakes.dart';
import '../../helpers/request_fakes.dart' show RequestFakeRepository;
import '../../helpers/history_fakes.dart'
    show HistoryTestProvider, event, screen, summary;
import '../../helpers/history_request_app.dart' show app;

Finder day(String date) => find.byKey(ValueKey('history-day-$date'));
Finder marker(String date) => find.byKey(ValueKey('history-day-marker-$date'));
void viewport(WidgetTester tester, double width) {
  tester.view.physicalSize = Size(width, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

Widget calendar({
  Map<String, int>? counts,
  double scale = 1,
  DateTime? month,
}) => app(
  Scaffold(
    body: SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: HistoryCalendar(
          month: month ?? DateTime(2026, 10),
          today: DateTime(2026, 10, 21),
          dayCounts: counts,
          onDaySelected: (_) {},
        ),
      ),
    ),
  ),
  dark: false,
  scale: scale,
);

Future<void> withSemantics(
  WidgetTester tester,
  Future<void> Function() action,
) async {
  final handle = tester.ensureSemantics();
  try {
    await action();
  } finally {
    handle.dispose();
  }
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('tr');
    await initializeDateFormatting('en');
  });
  for (final (width, scale, list) in [
    (360.0, 1.0, false),
    (375.0, 1.0, false),
    (320.0, 1.0, true),
    (390.0, 2.0, true),
  ]) {
    testWidgets('calendar $width / $scale uses ${list ? 'list' : 'grid'}', (
      tester,
    ) async {
      viewport(tester, width);
      await tester.pumpWidget(calendar(counts: const {}, scale: scale));
      await tester.pumpAndSettle();
      expect(
        tester.widget(day('2026-10-01')),
        list ? isA<AppListRow>() : isA<Semantics>(),
      );
      expect(
        tester.getSize(day('2026-10-01')).height,
        greaterThanOrEqualTo(48),
      );
      if (!list) {
        expect(
          tester.getSize(day('2026-10-01')).width,
          greaterThanOrEqualTo(44),
        );
      }
      expect(tester.takeException(), isNull);
    });
  }
  for (final utc in [false, true]) {
    testWidgets(
      'calendar normalizes ${utc ? 'UTC' : 'local'} days into counts dots and date semantics',
      (tester) async {
        viewport(tester, 390);
        await withSemantics(tester, () async {
          final twelve = utc
              ? DateTime.utc(2026, 10, 12)
              : DateTime(2026, 10, 12);
          final thirteen = utc
              ? DateTime.utc(2026, 10, 13)
              : DateTime(2026, 10, 13);
          await tester.pumpWidget(
            calendar(
              month: utc ? DateTime.utc(2026, 10) : DateTime(2026, 10),
              counts: {
                AttendanceDate.calendarKey(twelve): 3,
                AttendanceDate.calendarKey(thirteen): 0,
                AttendanceDate.calendarKey(DateTime.utc(2026, 9, 30)): 7,
                '2026-10-22': 9,
              },
            ),
          );
          await tester.pumpAndSettle();
          expect(marker('2026-10-12'), findsOneWidget);
          expect(marker('2026-10-13'), findsNothing);
          expect(
            tester.getSemantics(day('2026-10-12')).label,
            '12 Ekim 2026, 3 kayıt',
          );
          expect(
            tester.getSemantics(day('2026-10-13')).label,
            '13 Ekim 2026, 0 kayıt',
          );
          expect(day('2026-09-30'), findsNothing);
          expect(marker('2026-10-22'), findsNothing);
          expect(tester.getSemantics(day('2026-10-22')).label, '22 Ekim 2026');
          expect(find.bySemanticsLabel('Pzt'), findsNothing);
        });
      },
    );
  }
  for (final width in [320.0, 390.0]) {
    testWidgets(
      'unknown calendar counts stay unknown at $width and future list days are absent',
      (tester) async {
        viewport(tester, width);
        await withSemantics(tester, () async {
          await tester.pumpWidget(calendar());
          await tester.pumpAndSettle();
          expect(tester.getSemantics(day('2026-10-01')).label, '1 Ekim 2026');
          expect(find.text('0 kayıt'), findsNothing);
          expect(marker('2026-10-01'), findsNothing);
          if (width == 320) {
            expect(day('2026-10-22'), findsNothing);
            expect(
              tester.widget<AppListRow>(day('2026-10-01')).subtitle,
              isNull,
            );
          }
        });
      },
    );
  }
  testWidgets(
    'clearing a calendar day filter never leaves a false empty day group',
    (tester) async {
      final provider = HistoryTestProvider()
        ..summaries['2026-10-01/2026-10-31'] = summary(
          '2026-10-01',
          '2026-10-31',
          150,
        );
      addTearDown(provider.dispose);
      await tester.pumpWidget(screen(provider));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Calendar'));
      await tester.pumpAndSettle();
      final monthHeading = tester.widget<Semantics>(
        find
            .ancestor(
              of: find.text('October 2026'),
              matching: find.byType(Semantics),
            )
            .first,
      );
      expect(monthHeading.properties.liveRegion, isTrue);
      expect(monthHeading.properties.header, isTrue);
      await tester.tap(day('2026-10-19'));
      await tester.pumpAndSettle();
      expect(provider.filters.last.startDate, '2026-10-19');
      await tester.tap(find.text('Clear filters'));
      await tester.pumpAndSettle();
      expect(provider.filters.last.startDate, isNull);
      await tester.tap(find.text('Calendar'));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<HistoryCalendar>(find.byType(HistoryCalendar))
            .selectedDay,
        isNull,
      );
      expect(find.text('No access events in this period'), findsNothing);
      expect(find.byType(AppListGroup), findsNothing);
    },
  );
  testWidgets(
    'local record sheet uses labeled values and localized Turkey time without fetching',
    (tester) async {
      final provider = HistoryTestProvider()..attendanceRecords = [event(1)];
      addTearDown(provider.dispose);
      await tester.pumpWidget(screen(provider));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('event-1')));
      await tester.pumpAndSettle();
      final rows = tester
          .widgetList<AppListRow>(
            find.descendant(
              of: find.byType(AppSheet),
              matching: find.byType(AppListRow),
            ),
          )
          .toList();
      expect(rows.map((row) => row.subtitle), [
        'Date',
        'Time',
        'Type',
        'Door',
        'Location',
      ]);
      expect(rows.map((row) => row.title), contains('Entrance 1'));
      expect(find.text('Türkiye time · UTC+3'), findsOneWidget);
      expect(find.text('Europe/Istanbul'), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(provider.refreshCalls, 0);
    },
  );
  for (final dark in [false, true]) {
    testWidgets(
      'filter loading selected missing door radio and keyboard footer $dark',
      (tester) async {
        viewport(tester, 390);
        await withSemantics(tester, () async {
          final provider = HistoryTestProvider()..isLoading = true;
          addTearDown(provider.dispose);
          await tester.pumpWidget(
            ChangeNotifierProvider<AttendanceProvider>.value(
              value: provider,
              child: app(
                HistoryScreen(now: () => DateTime.utc(2026, 10, 21)),
                dark: dark,
                scale: 1,
              ),
            ),
          );
          await tester.pumpAndSettle();
          await tester.tap(find.byTooltip('Filtrele'));
          await tester.pumpAndSettle();
          expect(
            find.descendant(
              of: find.byType(AppSheet),
              matching: find.byType(AppSkeleton),
            ),
            findsOneWidget,
          );
          expect(
            find.text('Bu kayıtlar için kapı seçeneği yok.'),
            findsNothing,
          );
          provider.isLoading = false;
          provider.deviceFacets = {'door-a': 'Ana Giriş'};
          provider.publish();
          await tester.pumpAndSettle();
          await tester.tap(find.byKey(const ValueKey('history-device-door-a')));
          await tester.tap(find.byKey(const Key('history-apply-filters')));
          await tester.pumpAndSettle();
          provider.deviceFacets = {};
          provider.publish();
          await tester.pumpAndSettle();
          await tester.tap(find.byTooltip('Filtrele'));
          await tester.pumpAndSettle();
          final selected = find.byKey(const ValueKey('history-device-door-a'));
          expect(tester.widget<AppListRow>(selected).selected, isTrue);
          expect(tester.widget<AppListRow>(selected).radio, isTrue);
          expect(
            tester.getSemantics(selected),
            isSemantics(isChecked: true, isInMutuallyExclusiveGroup: true),
          );
          final search = find.byType(TextField);
          await tester.ensureVisible(search);
          await tester.tap(search);
          tester.view.viewInsets = const FakeViewPadding(bottom: 280);
          addTearDown(tester.view.resetViewInsets);
          await tester.pumpAndSettle();
          final apply = find.byKey(const Key('history-apply-filters'));
          expect(apply.hitTestable(), findsOneWidget);
          expect(tester.getRect(apply).bottom, lessThanOrEqualTo(844 - 280));
          expect(tester.takeException(), isNull);
        });
      },
    );
    testWidgets('correction keyboard leaves sticky submit reachable $dark', (
      tester,
    ) async {
      viewport(tester, 390);
      final auth = AuthProvider(
        repository: FakeAuthRepository(),
        sessionStore: FakeSessionStore(),
      );
      await auth.bootstrap();
      await auth.signIn('fixture', 'password');
      final provider = RequestProvider(repository: RequestFakeRepository())
        ..synchronizeSession(auth);
      addTearDown(provider.dispose);
      addTearDown(auth.dispose);
      await tester.pumpWidget(
        ChangeNotifierProvider<RequestProvider>.value(
          value: provider,
          child: app(
            const RequestFormScreen(isLeave: false),
            dark: dark,
            scale: 1,
          ),
        ),
      );
      await tester.pumpAndSettle();
      final reason = find.byType(TextField);
      await tester.ensureVisible(reason);
      await tester.tap(reason);
      tester.view.viewInsets = const FakeViewPadding(bottom: 280);
      addTearDown(tester.view.resetViewInsets);
      await tester.pumpAndSettle();
      final submit = find.byKey(const Key('request-submit'));
      expect(submit.hitTestable(), findsOneWidget);
      expect(tester.getRect(submit).bottom, lessThanOrEqualTo(844 - 280));
      expect(tester.takeException(), isNull);
    });
  }
}
