import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/models/attendance.dart';
import 'package:ngsplusapp/models/attendance_summary.dart';
import 'package:ngsplusapp/providers/attendance_provider.dart';
import 'package:ngsplusapp/screens/history/history_screen.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/history/history_calendar.dart';
import 'package:provider/provider.dart';

import '../helpers/mocks.dart';

typedef FilterRequest = ({
  String? startDate,
  String? endDate,
  String? deviceId,
});

class HistoryTestProvider extends AttendanceProvider {
  HistoryTestProvider() : super(repository: MockAttendanceRepository());

  @override
  List<Attendance> attendanceRecords = [];
  @override
  Map<String, String> deviceFacets = {};
  @override
  bool hasMore = false;
  @override
  bool isLoading = false;
  @override
  bool isLoadingMore = false;
  @override
  bool listLoaded = true;
  @override
  bool isStale = false;
  @override
  AppError? listError;
  @override
  AppError? loadMoreError;

  int moreCalls = 0;
  int refreshCalls = 0;
  final filters = <FilterRequest>[];
  final ranges = <String>[];
  final summaries = <String, AttendanceSummary>{};
  Completer<void>? refresh;

  @override
  Future<void> setFilters({
    String? startDate,
    String? endDate,
    String? deviceId,
  }) async {
    filters.add((startDate: startDate, endDate: endDate, deviceId: deviceId));
  }

  @override
  Future<void> loadMore() async {
    moreCalls++;
  }

  @override
  Future<void> loadAttendanceRecords() async {
    refreshCalls++;
    await refresh?.future;
  }

  @override
  AttendanceSummary? summaryFor({
    required String startDate,
    required String endDate,
  }) => summaries['$startDate/$endDate'];

  @override
  bool isSummaryLoadingFor({
    required String startDate,
    required String endDate,
  }) => false;

  @override
  AppError? summaryErrorFor({
    required String startDate,
    required String endDate,
  }) => null;

  @override
  Future<AttendanceSummary?> loadSummary({
    required String startDate,
    required String endDate,
  }) async {
    ranges.add('$startDate/$endDate');
    return summaryFor(startDate: startDate, endDate: endDate);
  }

  void publish() => notifyListeners();
}

Attendance event(int index) => Attendance(
  id: 'event-$index',
  employeeId: 'employee',
  deviceId: 'device-$index',
  cardNo: '',
  employeeName: null,
  accessTime: DateTime.utc(2026, 10, 19, 6),
  granted: true,
  direction: 'entry',
  deviceInfo: {'name': 'Entrance $index'},
);

AttendanceSummary summary(String start, String end, int entries) =>
    AttendanceSummary(
      startDate: start,
      endDate: end,
      generatedAt: DateTime.utc(2026, 10, 21, 12),
      days: const [
        AttendanceDaySummary(
          date: '2026-10-19',
          entryCount: 2,
          exitCount: 1,
          deniedCount: 5,
          unknownCount: 0,
          firstEntry: null,
          lastEntry: null,
          lastExit: null,
          lastDirection: AttendanceDirection.exit,
        ),
      ],
      totals: AttendanceTotals(
        entryCount: entries,
        exitCount: 70,
        deniedCount: 12,
        unknownCount: 3,
        presentDays: 18,
      ),
    );

Widget screen(
  HistoryTestProvider provider, {
  double textScale = 1,
  Locale locale = const Locale('en'),
  ThemeMode themeMode = ThemeMode.light,
}) => ChangeNotifierProvider<AttendanceProvider>.value(
  value: provider,
  child: MaterialApp(
    locale: locale,
    theme: AppTheme.lightTheme,
    darkTheme: AppTheme.darkTheme,
    themeMode: themeMode,
    supportedLocales: AppLocalizations.supportedLocales,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(
        context,
      ).copyWith(textScaler: TextScaler.linear(textScale)),
      child: child ?? const SizedBox.shrink(),
    ),
    home: HistoryScreen(now: () => DateTime.utc(2026, 10, 21, 12)),
  ),
);

void main() {
  setUpAll(() async {
    await initializeDateFormatting('en');
    await initializeDateFormatting('tr');
  });

  testWidgets('month and Monday week totals use independent server summaries', (
    tester,
  ) async {
    final provider = HistoryTestProvider()
      ..attendanceRecords = [event(1)]
      ..summaries['2026-10-01/2026-10-31'] = summary(
        '2026-10-01',
        '2026-10-31',
        150,
      )
      ..summaries['2026-10-19/2026-10-25'] = summary(
        '2026-10-19',
        '2026-10-25',
        25,
      );
    addTearDown(provider.dispose);
    await tester.pumpWidget(screen(provider));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Overview'));
    await tester.pumpAndSettle();

    expect(
      provider.ranges,
      containsAll(['2026-10-01/2026-10-31', '2026-10-19/2026-10-25']),
    );
    expect(find.text('150'), findsOneWidget);
    expect(find.text('25'), findsNothing);
    await tester.tap(find.text('This Week'));
    await tester.pumpAndSettle();
    expect(find.text('25'), findsOneWidget);
    expect(find.text('150'), findsNothing);
    await tester.tap(find.text('This month'));
    await tester.pumpAndSettle();
    expect(find.text('150'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'calendar day opens server day filter instead of a partial dialog',
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
      final calendar = tester.widget<HistoryCalendar>(
        find.byType(HistoryCalendar),
      );
      // Three granted movements plus five denied attempts are eight records.
      expect(calendar.dayCounts['2026-10-19'], 8);
      final day = find.byKey(const ValueKey('history-day-2026-10-19'));
      await tester.ensureVisible(day);
      await tester.tap(day);
      await tester.pumpAndSettle();

      expect(provider.filters.last, (
        startDate: '2026-10-19',
        endDate: '2026-10-19',
        deviceId: null,
      ));
      expect(find.byType(AlertDialog), findsNothing);
      expect(find.byType(CustomScrollView), findsOneWidget);
    },
  );

  testWidgets(
    'same-name device facets use IDs and update while dialog is open',
    (tester) async {
      final provider = HistoryTestProvider()
        ..deviceFacets = {'door-a': 'Office'};
      addTearDown(provider.dispose);
      await tester.pumpWidget(screen(provider));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Filter'));
      await tester.pumpAndSettle();
      provider.deviceFacets = {'door-a': 'Office', 'door-b': 'Office'};
      provider.publish();
      await tester.pumpAndSettle();

      expect(
        find.byKey(const ValueKey('history-device-door-a')),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey('history-device-door-b')),
        findsOneWidget,
      );
      await tester.tap(find.byKey(const ValueKey('history-device-door-b')));
      await tester.pumpAndSettle();
      expect(provider.filters.last.deviceId, isNull);
      await tester.tap(find.byKey(const Key('history-apply-filters')));
      await tester.pumpAndSettle();
      expect(provider.filters.last.deviceId, 'door-b');
      expect(provider.filters.last.startDate, isNull);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('scroll pagination uses a non-listening provider read', (
    tester,
  ) async {
    final provider = HistoryTestProvider()
      ..attendanceRecords = List.generate(35, event)
      ..hasMore = true;
    addTearDown(provider.dispose);
    await tester.pumpWidget(screen(provider));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(CustomScrollView), const Offset(0, -12000));
    await tester.pumpAndSettle();

    expect(provider.moreCalls, greaterThan(0));
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'refresh completion after screen removal writes no widget state',
    (tester) async {
      final provider = HistoryTestProvider()..refresh = Completer<void>();
      addTearDown(provider.dispose);
      await tester.pumpWidget(screen(provider));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Refresh'));
      await tester.pump();
      expect(provider.refreshCalls, 1);
      await tester.pumpWidget(const MaterialApp(home: SizedBox.shrink()));
      provider.refresh?.complete();
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('removing the screen while the date picker is open is safe', (
    tester,
  ) async {
    final provider = HistoryTestProvider();
    addTearDown(provider.dispose);
    await tester.pumpWidget(screen(provider));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Filter'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Date').first);
    await tester.pumpAndSettle();
    expect(find.byType(CalendarDatePicker), findsOneWidget);
    await tester.pumpWidget(const MaterialApp(home: SizedBox.shrink()));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('small screen with 200 percent text retains filter and refresh', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final provider = HistoryTestProvider();
    addTearDown(provider.dispose);
    await tester.pumpWidget(screen(provider, textScale: 2));
    await tester.pumpAndSettle();
    expect(find.byTooltip('Refresh'), findsOneWidget);
    await tester.tap(find.byTooltip('Filter'));
    await tester.pumpAndSettle();
    expect(find.text('Clear Filters'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('dismissing filter drafts preserves the applied server filter', (
    tester,
  ) async {
    final provider = HistoryTestProvider()..deviceFacets = {'door-a': 'Office'};
    addTearDown(provider.dispose);
    await tester.pumpWidget(screen(provider));
    await tester.pumpAndSettle();
    final originalRequests = provider.filters.length;
    await tester.tap(find.byTooltip('Filter'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('history-device-door-a')));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Close'));
    await tester.pumpAndSettle();
    expect(provider.filters.length, originalRequests);
    expect(find.byTooltip('Filter'), findsOneWidget);
    expect(find.text('All devices'), findsNothing);
    expect(find.text('All dates'), findsNothing);
  });

  testWidgets('filter sheet covers the outer navigation of a retained branch', (
    tester,
  ) async {
    final provider = HistoryTestProvider();
    addTearDown(provider.dispose);
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          bottomNavigationBar: const SizedBox(
            key: Key('outer-navigation'),
            height: 80,
          ),
          body: Navigator(
            onGenerateRoute: (_) => MaterialPageRoute<void>(
              builder: (_) => ChangeNotifierProvider<AttendanceProvider>.value(
                value: provider,
                child: HistoryScreen(now: () => DateTime.utc(2026, 10, 21)),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final navTop = tester
        .getTopLeft(find.byKey(const Key('outer-navigation')))
        .dy;
    await tester.tap(find.byTooltip('Filter'));
    await tester.pumpAndSettle();
    expect(
      tester.getRect(find.byType(BottomSheet)).bottom,
      greaterThan(navTop),
    );
    await tester.tap(find.byTooltip('Close'));
    await tester.pumpAndSettle();
  });

  testWidgets(
    'one sheet applies date and device together, empty result can clear both',
    (tester) async {
      final provider = HistoryTestProvider()
        ..deviceFacets = {'door-a': 'Office'};
      addTearDown(provider.dispose);
      await tester.pumpWidget(screen(provider));
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
      expect(provider.filters.last.deviceId, isNull);
      await tester.tap(find.byKey(const Key('history-apply-filters')));
      await tester.pumpAndSettle();
      expect(provider.filters.last, (
        startDate: '2026-10-19',
        endDate: '2026-10-19',
        deviceId: 'door-a',
      ));
      await tester.tap(find.text('Show all records'));
      await tester.pumpAndSettle();
      expect(provider.filters.last, (
        startDate: null,
        endDate: null,
        deviceId: null,
      ));
    },
  );

  for (final locale in [const Locale('en'), const Locale('tr')]) {
    for (final mode in [ThemeMode.light, ThemeMode.dark]) {
      testWidgets(
        'history tabs and filter reflow at 320px / 200% ${locale.languageCode} $mode',
        (tester) async {
          tester.view.physicalSize = const Size(320, 700);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          final provider = HistoryTestProvider()
            ..attendanceRecords = [event(1)]
            ..deviceFacets = {'door-a': 'A long entrance name'}
            ..summaries['2026-10-01/2026-10-31'] = summary(
              '2026-10-01',
              '2026-10-31',
              150,
            );
          addTearDown(provider.dispose);
          await tester.pumpWidget(
            screen(provider, textScale: 2, locale: locale, themeMode: mode),
          );
          await tester.pumpAndSettle();
          final l10n = AppLocalizations.of(
            tester.element(find.byType(HistoryScreen)),
          );
          await tester.ensureVisible(find.text(l10n.historyTabThisMonth));
          await tester.tap(find.text(l10n.historyTabThisMonth));
          await tester.pumpAndSettle();
          expect(find.byTooltip(l10n.historyFilterTitle), findsNothing);
          await tester.ensureVisible(find.text(l10n.historyTabStats));
          await tester.tap(find.text(l10n.historyTabStats));
          await tester.pumpAndSettle();
          expect(find.text('150'), findsOneWidget);
          await tester.ensureVisible(find.text(l10n.historyTabAll));
          await tester.tap(find.text(l10n.historyTabAll));
          await tester.pumpAndSettle();
          await tester.tap(find.byTooltip(l10n.historyFilterTitle));
          await tester.pumpAndSettle();
          await tester.tap(find.text(l10n.historyFilterDate).first);
          await tester.pumpAndSettle();
          expect(
            find.byKey(const Key('history-apply-filters')).hitTestable(),
            findsOneWidget,
          );
          expect(tester.takeException(), isNull);
          await tester.tap(find.byTooltip(l10n.commonClose));
          await tester.pumpAndSettle();
        },
      );
    }
  }
}
