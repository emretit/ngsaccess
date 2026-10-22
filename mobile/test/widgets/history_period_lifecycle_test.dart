import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:ngsplusapp/core/branch_visibility.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/providers/attendance_provider.dart';
import 'package:ngsplusapp/screens/history/history_screen.dart';
import 'package:ngsplusapp/widgets/history/history_calendar.dart';
import 'package:ngsplusapp/widgets/history/history_filter_sheet.dart';
import 'package:provider/provider.dart';

import 'history_screen_test.dart' show HistoryTestProvider, summary;

Widget periodScreen(
  HistoryTestProvider provider,
  ValueNotifier<int> branch,
  DateTime Function() now,
) => ChangeNotifierProvider<AttendanceProvider>.value(
  value: provider,
  child: MaterialApp(
    locale: const Locale('en'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: ValueListenableBuilder<int>(
      valueListenable: branch,
      child: HistoryScreen(now: now),
      builder: (context, index, child) => BranchVisibility(
        activeIndex: index,
        child: Offstage(offstage: index != 1, child: child),
      ),
    ),
  ),
);

void main() {
  setUpAll(() async {
    await initializeDateFormatting('en');
  });

  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized()
        .handleAppLifecycleStateChanged(AppLifecycleState.resumed);
  });

  testWidgets(
    'AUD-03 resume rolls October into November at Istanbul midnight',
    (tester) async {
      var now = DateTime.utc(2026, 10, 31, 20, 59, 59);
      final provider = HistoryTestProvider()
        ..summaries['2026-10-01/2026-10-31'] = summary(
          '2026-10-01',
          '2026-10-31',
          150,
        )
        ..summaries['2026-11-01/2026-11-30'] = summary(
          '2026-11-01',
          '2026-11-30',
          2,
        );
      final branch = ValueNotifier(1);
      addTearDown(provider.dispose);
      addTearDown(branch.dispose);
      await tester.pumpWidget(periodScreen(provider, branch, () => now));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Calendar'));
      await tester.pumpAndSettle();
      expect(find.text('October 2026'), findsOneWidget);
      expect(provider.ranges, [
        '2026-10-01/2026-10-31',
        '2026-10-26/2026-11-01',
      ]);

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      // The UTC date has not changed; the Istanbul date is now November 1.
      now = DateTime.utc(2026, 10, 31, 21);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();

      expect(find.text('November 2026'), findsOneWidget);
      final calendar = tester.widget<HistoryCalendar>(
        find.byType(HistoryCalendar),
      );
      expect(calendar.month.month, 11);
      expect(calendar.today?.day, 1);
      expect(provider.ranges, [
        '2026-10-01/2026-10-31',
        '2026-10-26/2026-11-01',
        '2026-11-01/2026-11-30',
        '2026-10-26/2026-11-01',
      ]);
      expect(provider.filters, [
        (startDate: null, endDate: null, deviceId: null),
      ]);
      expect(provider.refreshCalls, 0);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('hidden retained month waits for visibility after resume', (
    tester,
  ) async {
    var now = DateTime.utc(2026, 10, 31, 20);
    final provider = HistoryTestProvider();
    final branch = ValueNotifier(1);
    addTearDown(provider.dispose);
    addTearDown(branch.dispose);
    await tester.pumpWidget(periodScreen(provider, branch, () => now));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Calendar'));
    await tester.pumpAndSettle();
    final retainedState = tester.state(find.byType(HistoryScreen));
    branch.value = 0;
    await tester.pumpAndSettle();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    now = DateTime.utc(2026, 11, 1, 6);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    provider.publish();
    await tester.pumpAndSettle();
    expect(provider.ranges.length, 2);

    branch.value = 1;
    await tester.pumpAndSettle();
    expect(tester.state(find.byType(HistoryScreen)), same(retainedState));
    expect(find.text('November 2026'), findsOneWidget);
    expect(provider.ranges.length, 4);
    expect(provider.ranges[2], '2026-11-01/2026-11-30');

    branch.value = 0;
    await tester.pumpAndSettle();
    branch.value = 1;
    await tester.pumpAndSettle();
    expect(provider.ranges.length, 4);
    expect(provider.filters.length, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Sunday to Monday updates the retained weekly overview', (
    tester,
  ) async {
    var now = DateTime.utc(2026, 11, 1, 20, 59, 59);
    final provider = HistoryTestProvider()
      ..summaries['2026-10-26/2026-11-01'] = summary(
        '2026-10-26',
        '2026-11-01',
        125,
      )
      ..summaries['2026-11-02/2026-11-08'] = summary(
        '2026-11-02',
        '2026-11-08',
        126,
      );
    final branch = ValueNotifier(1);
    addTearDown(provider.dispose);
    addTearDown(branch.dispose);
    await tester.pumpWidget(periodScreen(provider, branch, () => now));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Overview'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('This Week'));
    await tester.pumpAndSettle();
    expect(find.text('125'), findsOneWidget);

    branch.value = 0;
    await tester.pumpAndSettle();
    now = DateTime.utc(2026, 11, 1, 21);
    branch.value = 1;
    await tester.pumpAndSettle();

    expect(provider.ranges, [
      '2026-11-01/2026-11-30',
      '2026-10-26/2026-11-01',
      '2026-11-01/2026-11-30',
      '2026-11-02/2026-11-08',
    ]);
    expect(find.text('126'), findsOneWidget);
    expect(find.text('125'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('new day refreshes same week and month and calendar today', (
    tester,
  ) async {
    var now = DateTime.utc(2026, 10, 20, 20, 59, 59);
    final provider = HistoryTestProvider()
      ..summaries['2026-10-01/2026-10-31'] = summary(
        '2026-10-01',
        '2026-10-31',
        150,
      );
    final branch = ValueNotifier(1);
    addTearDown(provider.dispose);
    addTearDown(branch.dispose);
    await tester.pumpWidget(periodScreen(provider, branch, () => now));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Calendar'));
    await tester.pumpAndSettle();
    expect(
      tester.widget<HistoryCalendar>(find.byType(HistoryCalendar)).today?.day,
      20,
    );

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    now = DateTime.utc(2026, 10, 20, 21);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(
      tester.widget<HistoryCalendar>(find.byType(HistoryCalendar)).today?.day,
      21,
    );
    expect(provider.ranges, [
      '2026-10-01/2026-10-31',
      '2026-10-19/2026-10-25',
      '2026-10-01/2026-10-31',
      '2026-10-19/2026-10-25',
    ]);
    expect(tester.takeException(), isNull);
  });

  testWidgets('same Istanbul day has no extra queries across UTC midnight', (
    tester,
  ) async {
    var now = DateTime.utc(2026, 10, 21, 23, 59);
    final provider = HistoryTestProvider();
    final branch = ValueNotifier(1);
    addTearDown(provider.dispose);
    addTearDown(branch.dispose);
    await tester.pumpWidget(periodScreen(provider, branch, () => now));
    await tester.pumpAndSettle();
    final initialRanges = List<String>.of(provider.ranges);

    now = DateTime.utc(2026, 10, 22, 0, 1);
    for (var attempt = 0; attempt < 3; attempt++) {
      branch.value = 0;
      await tester.pumpAndSettle();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      branch.value = 1;
      provider.publish();
      await tester.pumpAndSettle();
    }
    expect(provider.ranges, initialRanges);
    expect(provider.filters.length, 1);
    expect(provider.refreshCalls, 0);
    expect(tester.takeException(), isNull);
  });

  testWidgets('month rollover preserves applied date and device filters', (
    tester,
  ) async {
    var now = DateTime.utc(2026, 10, 31, 20);
    final provider = HistoryTestProvider()..deviceFacets = {'door-a': 'Office'};
    final branch = ValueNotifier(1);
    addTearDown(provider.dispose);
    addTearDown(branch.dispose);
    await tester.pumpWidget(periodScreen(provider, branch, () => now));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Filter'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('history-device-door-a')));
    await tester.tap(find.text('Date'));
    await tester.pumpAndSettle();
    final day = find.descendant(
      of: find.byType(CalendarDatePicker),
      matching: find.text('19'),
    );
    await tester.ensureVisible(day);
    await tester.tap(day);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('history-apply-filters')));
    await tester.pumpAndSettle();
    final selectedFilters = List.of(provider.filters);
    expect(selectedFilters.last, (
      startDate: '2026-10-19',
      endDate: '2026-10-19',
      deviceId: 'door-a',
    ));

    // A root overlay hides the shell; returning while paused must not fetch.
    branch.value = -1;
    await tester.pumpAndSettle();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    now = DateTime.utc(2026, 11, 1, 6);
    branch.value = 1;
    await tester.pumpAndSettle();
    expect(provider.ranges.length, 2);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(provider.ranges.length, 4);
    expect(provider.filters, selectedFilters);
    expect(provider.refreshCalls, 0);

    await tester.tap(find.byTooltip('Filter'));
    await tester.pumpAndSettle();
    final sheet = tester.widget<HistoryFilterSheet>(
      find.byType(HistoryFilterSheet),
    );
    expect(sheet.initial.date, DateTime(2026, 10, 19));
    expect(sheet.initial.deviceId, 'door-a');
    expect(sheet.today, DateTime(2026, 11, 1));
    await tester.tap(find.byTooltip('Close'));
    await tester.pumpAndSettle();
    expect(provider.filters, selectedFilters);
    expect(tester.takeException(), isNull);
  });

  testWidgets('queued resume is harmless after history is disposed', (
    tester,
  ) async {
    var now = DateTime.utc(2026, 10, 31, 20);
    final provider = HistoryTestProvider();
    final branch = ValueNotifier(1);
    addTearDown(provider.dispose);
    addTearDown(branch.dispose);
    await tester.pumpWidget(periodScreen(provider, branch, () => now));
    await tester.pumpAndSettle();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    now = DateTime.utc(2026, 11, 1, 6);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(provider.ranges.length, 2);
    expect(tester.takeException(), isNull);
  });
}
