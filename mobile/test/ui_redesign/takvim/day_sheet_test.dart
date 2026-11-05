import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/models/attendance.dart';
import 'package:ngsplusapp/models/attendance_summary.dart';
import 'package:ngsplusapp/widgets/history/history_calendar.dart';
import 'package:ngsplusapp/widgets/history/history_day_sheet.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';

import '../../helpers/history_fakes.dart';

AttendanceSummary month({
  int denied = 0,
  int unknown = 0,
  bool empty = false,
}) => AttendanceSummary(
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  generatedAt: DateTime.utc(2026, 10, 21),
  days: [
    if (!empty)
      AttendanceDaySummary(
        date: '2026-10-19',
        entryCount: 1,
        exitCount: 1,
        deniedCount: denied,
        unknownCount: unknown,
        firstEntry: DateTime.utc(2026, 10, 19, 6),
        lastEntry: DateTime.utc(2026, 10, 19, 6),
        lastExit: DateTime.utc(2026, 10, 19, 15),
        lastDirection: AttendanceDirection.exit,
      ),
  ],
  totals: AttendanceTotals(
    entryCount: empty ? 0 : 1,
    exitCount: empty ? 0 : 1,
    deniedCount: denied,
    unknownCount: unknown,
    presentDays: empty ? 0 : 1,
  ),
);

class StatusProvider extends HistoryTestProvider {
  bool loading = false;
  AppError? error;
  @override
  bool isSummaryLoadingFor({
    required String startDate,
    required String endDate,
  }) => loading;
  @override
  AppError? summaryErrorFor({
    required String startDate,
    required String endDate,
  }) => error;
}

Future<void> calendar(
  WidgetTester tester,
  HistoryTestProvider provider, {
  double scale = 1,
}) async {
  await tester.pumpWidget(screen(provider, textScale: scale));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Calendar'));
  await tester.pumpAndSettle();
}

Future<void> openDay(WidgetTester tester) async {
  final day = find.byKey(const ValueKey('history-day-2026-10-19'));
  await tester.ensureVisible(day);
  await tester.pumpAndSettle();
  await tester.tap(day);
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() => initializeDateFormatting('en'));

  testWidgets(
    'day sheet keeps calendar and uses full summary with Istanbul clocks',
    (tester) async {
      final provider = HistoryTestProvider()
        ..summaries['2026-10-01/2026-10-31'] = month(denied: 2, unknown: 3);
      addTearDown(provider.dispose);
      await calendar(tester, provider);
      final filtersBeforeTap = List.of(provider.filters);
      await openDay(tester);
      expect(find.byType(HistoryDaySheet), findsOneWidget);
      expect(find.text('Monday, October 19, 2026'), findsOneWidget);
      expect(find.text('09:00'), findsOneWidget);
      expect(find.text('18:00'), findsOneWidget);
      final badges = find.descendant(
        of: find.byType(HistoryDaySheet),
        matching: find.byType(AppStatusBadge),
      );
      expect(badges, findsNWidgets(2));
      expect(provider.filters, filtersBeforeTap);
      await tester.tap(find.byTooltip('Close'));
      await tester.pumpAndSettle();
      expect(find.byType(HistoryCalendar), findsOneWidget);
      await openDay(tester);
      await tester.ensureVisible(find.text('View records'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('View records'));
      await tester.pumpAndSettle();
      expect(find.byType(HistoryDaySheet), findsNothing);
      expect(find.byType(HistoryCalendar), findsNothing);
      expect(provider.filters.last, (
        startDate: '2026-10-19',
        endDate: '2026-10-19',
        deviceId: null,
      ));
    },
  );

  for (final available in [true, false]) {
    testWidgets('empty and unavailable day differ: available=$available', (
      tester,
    ) async {
      final provider = StatusProvider();
      if (!available) {
        provider.error = const NetworkError();
      }
      if (available) {
        provider.summaries['2026-10-01/2026-10-31'] = month(empty: true);
      }
      addTearDown(provider.dispose);
      await calendar(tester, provider);
      await openDay(tester);
      expect(
        find.text(
          available
              ? 'No records on this day'
              : 'This day’s summary is unavailable.',
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byType(HistoryDaySheet),
          matching: find.byType(AppMetricRow),
        ),
        findsNothing,
      );
    });
  }

  testWidgets('zero badges hidden and missing exit clock uses placeholder', (
    tester,
  ) async {
    final provider = HistoryTestProvider()
      ..summaries['2026-10-01/2026-10-31'] = summary(
        '2026-10-01',
        '2026-10-31',
        2,
      );
    addTearDown(provider.dispose);
    await calendar(tester, provider);
    await openDay(tester);
    expect(
      find.descendant(
        of: find.byType(HistoryDaySheet),
        matching: find.byType(AppStatusBadge),
      ),
      findsOneWidget,
    );
    expect(find.text('—'), findsNWidgets(2));
    await tester.tap(find.byTooltip('Close'));
    await tester.pumpAndSettle();
    provider.summaries['2026-10-01/2026-10-31'] = month();
    provider.publish();
    await tester.pumpAndSettle();
    await openDay(tester);
    expect(
      find.descendant(
        of: find.byType(HistoryDaySheet),
        matching: find.byType(AppStatusBadge),
      ),
      findsNothing,
    );
  });

  testWidgets(
    'horizontal calendar flings change month and Today restores current month',
    (tester) async {
      final provider = HistoryTestProvider();
      addTearDown(provider.dispose);
      await calendar(tester, provider);
      expect(find.text('Today'), findsNothing);
      await tester.fling(
        find.byType(HistoryCalendar),
        const Offset(-400, 0),
        1000,
      );
      await tester.pumpAndSettle();
      expect(provider.ranges.length, 1); // Future month is blocked.
      await tester.fling(
        find.byType(HistoryCalendar),
        const Offset(400, 0),
        1000,
      );
      await tester.pumpAndSettle();
      expect(provider.ranges.last, '2026-09-01/2026-09-30');
      expect(find.text('Today'), findsOneWidget);
      await tester.fling(
        find.byType(HistoryCalendar),
        const Offset(-400, 0),
        1000,
      );
      await tester.pumpAndSettle();
      expect(provider.ranges.last, '2026-10-01/2026-10-31');
      await tester.tap(find.byTooltip('Previous month'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Today'));
      await tester.pumpAndSettle();
      expect(find.text('October 2026'), findsOneWidget);
      expect(provider.ranges.last, '2026-10-01/2026-10-31');
      expect(find.text('Today'), findsNothing);
      expect(find.byType(HistoryCalendar), findsOneWidget);
      expect(
        tester.widget<TabBarView>(find.byType(TabBarView)).physics,
        isA<NeverScrollableScrollPhysics>(),
      );
    },
  );

  testWidgets(
    'month loading and retry sit directly under heading at 320dp 200%',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final provider = StatusProvider()..error = const NetworkError();
      addTearDown(provider.dispose);
      await calendar(tester, provider, scale: 2);
      expect(find.text('Period summary unavailable.'), findsOneWidget);
      await tester.ensureVisible(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(find.text('Try again').hitTestable(), findsOneWidget);
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(provider.ranges.length, 2);
      provider.error = null;
      provider.loading = true;
      provider.publish();
      await tester.pump();
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
      expect(
        tester.getTopLeft(find.byType(LinearProgressIndicator)).dy,
        greaterThanOrEqualTo(
          tester.getBottomLeft(find.text('October 2026')).dy,
        ),
      );
      provider.loading = false;
      provider.error = const NetworkError();
      provider.publish();
      await tester.pumpAndSettle();
      await openDay(tester);
      await tester.ensureVisible(find.text('View records'));
      await tester.pumpAndSettle();
      expect(find.text('View records').hitTestable(), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'loading day updates live to summary and then error without filtering',
    (tester) async {
      final provider = StatusProvider();
      addTearDown(provider.dispose);
      await calendar(tester, provider);
      final filtersBeforeTap = List.of(provider.filters);
      final day = find.byKey(const ValueKey('history-day-2026-10-19'));
      await tester.ensureVisible(day);
      await tester.pumpAndSettle();
      provider.loading = true;
      provider.publish();
      await tester.pump();
      await tester.tap(day);
      await tester.pump(const Duration(milliseconds: 500));
      final sheet = find.byType(HistoryDaySheet);
      final skeleton = find.descendant(
        of: sheet,
        matching: find.byType(AppSkeleton),
      );
      expect(skeleton, findsOneWidget);
      expect(
        tester.widget<AppSkeleton>(skeleton).semanticLabel,
        'Loading records',
      );
      expect(find.text('This day’s summary is unavailable.'), findsNothing);
      expect(
        find.descendant(of: sheet, matching: find.byType(AppMetricRow)),
        findsNothing,
      );
      expect(provider.filters, filtersBeforeTap);
      provider.summaries['2026-10-01/2026-10-31'] = month();
      provider.loading = false;
      provider.publish();
      await tester.pumpAndSettle();
      expect(skeleton, findsNothing);
      expect(find.text('09:00'), findsOneWidget);
      expect(find.text('18:00'), findsOneWidget);
      provider.summaries.clear();
      provider.error = const NetworkError();
      provider.publish();
      await tester.pumpAndSettle();
      expect(find.text('This day’s summary is unavailable.'), findsOneWidget);
      expect(find.text('09:00'), findsNothing);
      expect(provider.filters, filtersBeforeTap);
    },
  );

  testWidgets(
    'cached summary remains visible with live stale warning and retry',
    (tester) async {
      final provider = StatusProvider()
        ..summaries['2026-10-01/2026-10-31'] = month();
      addTearDown(provider.dispose);
      await calendar(tester, provider);
      await openDay(tester);
      provider.error = const NetworkError();
      provider.publish();
      await tester.pumpAndSettle();
      final sheet = find.byType(HistoryDaySheet);
      final stale = find.descendant(
        of: sheet,
        matching: find.text('Showing previous data; refresh failed.'),
      );
      expect(stale, findsOneWidget);
      expect(find.text('09:00'), findsOneWidget);
      expect(find.text('This day’s summary is unavailable.'), findsNothing);
      final retry = find.descendant(
        of: sheet,
        matching: find.text('Try again'),
      );
      await tester.ensureVisible(retry);
      await tester.pumpAndSettle();
      final beforeRetry = provider.ranges.length;
      await tester.tap(retry);
      await tester.pumpAndSettle();
      expect(provider.ranges.length, beforeRetry + 1);
      expect(provider.ranges.last, '2026-10-01/2026-10-31');
      provider.error = null;
      provider.summaries['2026-10-01/2026-10-31'] = month(denied: 3);
      provider.publish();
      await tester.pumpAndSettle();
      expect(stale, findsNothing);
      expect(
        find.descendant(of: sheet, matching: find.text('Denied: 3')),
        findsOneWidget,
      );
      await tester.tap(find.byTooltip('Close'));
      await tester.pumpAndSettle();
      provider.error = const NetworkError();
      provider.publish();
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Showing previous data; refresh failed.'),
        -200,
        scrollable: find
            .ancestor(
              of: find.byType(HistoryCalendar),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.pumpAndSettle();
      expect(
        find.text('Showing previous data; refresh failed.'),
        findsOneWidget,
      );
      final beforeMonthRetry = provider.ranges.length;
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(provider.ranges.length, beforeMonthRetry + 1);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'selected day survives month changes and compact centered Today',
    (tester) async {
      final provider = HistoryTestProvider()
        ..summaries['2026-10-01/2026-10-31'] = month();
      addTearDown(provider.dispose);
      await calendar(tester, provider);
      await openDay(tester);
      await tester.tap(find.byTooltip('Close'));
      await tester.pumpAndSettle();
      DateTime? selection() => tester
          .widget<HistoryCalendar>(find.byType(HistoryCalendar))
          .selectedDay;
      expect(selection(), DateTime(2026, 10, 19));
      await tester.tap(find.byTooltip('Previous month'));
      await tester.pumpAndSettle();
      expect(selection(), DateTime(2026, 10, 19));
      final today = find.widgetWithText(TextButton, 'Today');
      final rect = tester.getRect(today);
      expect(
        rect.width,
        lessThan(tester.view.physicalSize.width / tester.view.devicePixelRatio),
      );
      expect(
        rect.center.dx,
        closeTo(tester.getRect(find.byType(TabBarView)).center.dx, 1),
      );
      expect(
        rect.top,
        greaterThanOrEqualTo(
          tester.getBottomLeft(find.text('September 2026')).dy,
        ),
      );
      await tester.tap(today);
      await tester.pumpAndSettle();
      expect(selection(), DateTime(2026, 10, 19));
      expect(find.text('October 2026'), findsOneWidget);
    },
  );

  testWidgets('vertical calendar drag preserves month and pulls to refresh', (
    tester,
  ) async {
    final provider = HistoryTestProvider()
      ..summaries['2026-10-01/2026-10-31'] = month();
    addTearDown(provider.dispose);
    await calendar(tester, provider);
    final beforeRefresh = provider.refreshCalls;
    final beforeFilters = List.of(provider.filters);
    await tester.drag(
      find.byKey(const ValueKey('history-day-2026-10-12')),
      const Offset(0, 350),
    );
    await tester.pumpAndSettle();
    expect(provider.refreshCalls, beforeRefresh + 1);
    expect(
      provider.ranges.every((range) => range == '2026-10-01/2026-10-31'),
      isTrue,
    );
    expect(find.text('October 2026'), findsOneWidget);
    expect(provider.filters, beforeFilters);
    expect(tester.takeException(), isNull);
  });
}
