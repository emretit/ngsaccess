import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/models/attendance.dart';
import 'package:ngsplusapp/widgets/history/history_calendar.dart';
import 'package:ngsplusapp/widgets/history/history_record_tile.dart';
import 'package:ngsplusapp/widgets/history/history_records_list.dart';
import 'package:table_calendar/table_calendar.dart';

Widget host(Widget child, {double textScale = 1}) => MaterialApp(
  locale: const Locale('en'),
  supportedLocales: AppLocalizations.supportedLocales,
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  builder: (context, child) => MediaQuery(
    data: MediaQuery.of(
      context,
    ).copyWith(textScaler: TextScaler.linear(textScale)),
    child: child ?? const SizedBox.shrink(),
  ),
  home: Scaffold(body: child),
);

Attendance reading({required bool granted, String? direction}) => Attendance(
  id: 'fixture-reading',
  employeeId: 'fixture-employee',
  deviceId: 'fixture-device',
  cardNo: '',
  employeeName: null,
  accessTime: DateTime(2026, 10, 19, 9),
  granted: granted,
  direction: direction,
  deviceInfo: {'name': 'Office entrance'},
);

void main() {
  setUpAll(() async {
    await initializeDateFormatting('en');
  });

  testWidgets('UTC calendar callbacks find component day and open that day', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    try {
      DateTime? selected;
      await tester.pumpWidget(
        host(
          SingleChildScrollView(
            child: HistoryCalendar(
              month: DateTime(2026, 10),
              dayCounts: const {'2026-10-12': 3},
              onDaySelected: (day) => selected = day,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final calendar = tester.widget<TableCalendar<int>>(
        find.byType(TableCalendar<int>),
      );
      // TableCalendar emits UTC midnight, while domain calendar components can
      // originate in Istanbul or in a local DateTime.
      expect(calendar.eventLoader?.call(DateTime.utc(2026, 10, 12)), [3]);
      expect(calendar.eventLoader?.call(DateTime(2026, 10, 12)), [3]);
      expect(calendar.eventLoader?.call(DateTime.utc(2026, 9, 30)), isEmpty);
      expect(
        find.bySemanticsLabel(RegExp(r'October 12, 2026[\s\S]*3 records')),
        findsOneWidget,
      );
      await tester.tap(find.byKey(const ValueKey('history-day-2026-10-12')));
      await tester.pump();
      expect(selected, DateTime(2026, 10, 12));
      expect(tester.takeException(), isNull);
    } finally {
      // Widget-test end verification runs before addTearDown callbacks.
      semantics.dispose();
    }
  });

  testWidgets('denied entry is explicit and unknown direction is not an exit', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        Column(
          children: [
            HistoryRecordTile(
              record: reading(granted: false, direction: 'entry'),
              accessState: HistoryAccessState.denied,
              onTap: () {},
            ),
            HistoryRecordTile(
              record: reading(granted: true),
              accessState: HistoryAccessState.granted,
              onTap: () {},
            ),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Access denied · In'), findsOneWidget);
    expect(find.byIcon(Icons.block_rounded), findsOneWidget);
    expect(find.text('Unknown direction'), findsOneWidget);
    expect(find.text('Checked In'), findsNothing);
    expect(find.text('Out'), findsNothing);
    expect(find.byIcon(Icons.logout_rounded), findsNothing);
  });

  testWidgets('empty filtered page retains load more and pull to refresh', (
    tester,
  ) async {
    final controller = ScrollController();
    addTearDown(controller.dispose);
    var refreshes = 0;
    var pages = 0;
    await tester.pumpWidget(
      host(
        HistoryRecordsList(
          controller: controller,
          recordCount: 0,
          itemBuilder: (context, index) => const SizedBox.shrink(),
          hasMore: true,
          isLoading: false,
          isLoadingMore: false,
          onRefresh: () async {
            refreshes++;
          },
          onLoadMore: () {
            pages++;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('history-load-more')));
    expect(pages, 1);
    // A bounded empty page with another cursor is not a definitive no-results
    // answer. The user can keep searching the server history explicitly.
    expect(find.text('No records found'), findsNothing);
    await tester.drag(find.byType(CustomScrollView), const Offset(0, 400));
    await tester.pumpAndSettle();
    expect(refreshes, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'refresh error preserves previous data and shows a stale notice',
    (tester) async {
      final controller = ScrollController();
      addTearDown(controller.dispose);
      await tester.pumpWidget(
        host(
          HistoryRecordsList(
            controller: controller,
            recordCount: 1,
            itemBuilder: (context, index) => const Text('Previous event'),
            hasMore: false,
            isLoading: false,
            isLoadingMore: false,
            hasPreviousData: true,
            errorMessage: 'Connection unavailable',
            onRefresh: () async {},
            onLoadMore: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Previous event'), findsOneWidget);
      expect(
        find.text('Showing previous data; refresh failed.'),
        findsOneWidget,
      );
      expect(find.text('Connection unavailable'), findsOneWidget);
      expect(find.text('No records found'), findsNothing);
      expect(find.text('Try Again'), findsOneWidget);
    },
  );

  testWidgets('initial error is distinct from an empty successful result', (
    tester,
  ) async {
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      host(
        HistoryRecordsList(
          controller: controller,
          recordCount: 0,
          itemBuilder: (context, index) => const SizedBox.shrink(),
          hasMore: false,
          isLoading: false,
          isLoadingMore: false,
          errorMessage: 'Connection unavailable',
          onRefresh: () async {},
          onLoadMore: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Connection unavailable'), findsOneWidget);
    expect(find.text('No records found'), findsNothing);
    expect(find.text('Showing previous data; refresh failed.'), findsNothing);
  });

  testWidgets('record content reflows at 320px and 200 percent text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    var opened = false;
    await tester.pumpWidget(
      host(
        SingleChildScrollView(
          child: HistoryRecordTile(
            record: reading(granted: false, direction: 'entry'),
            accessState: HistoryAccessState.denied,
            onTap: () => opened = true,
          ),
        ),
        textScale: 2,
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Office entrance'));

    expect(opened, isTrue);
    expect(tester.takeException(), isNull);
  });
}
