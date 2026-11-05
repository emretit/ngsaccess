import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/models/attendance.dart';
import 'package:ngsplusapp/models/attendance_summary.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/history/history_calendar.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';

AttendanceDaySummary summary(
  String date, {
  int denied = 0,
  AttendanceDirection direction = AttendanceDirection.entry,
}) => AttendanceDaySummary(
  date: date,
  entryCount: 1,
  exitCount: 0,
  deniedCount: denied,
  unknownCount: 0,
  firstEntry: null,
  lastEntry: null,
  lastExit: null,
  lastDirection: direction,
);

Finder day(String date) => find.byKey(ValueKey('history-day-$date'));
BoxDecoration decoration(WidgetTester tester, String date) =>
    tester
            .widget<DecoratedBox>(
              find.byKey(ValueKey('history-day-marker-$date')),
            )
            .decoration
        as BoxDecoration;

Future<void> pump(
  WidgetTester tester, {
  String locale = 'en',
  bool dark = false,
  double width = 390,
  double scale = 1,
  DateTime? month,
  DateTime? today,
  DateTime? selected,
  Map<String, AttendanceDaySummary>? days,
  ValueChanged<DateTime>? onSelected,
}) async {
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  tester.view.physicalSize = Size(width, 900);
  tester.view.devicePixelRatio = 1;
  await tester.pumpWidget(
    MaterialApp(
      theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
      locale: Locale(locale),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(
          context,
        ).copyWith(textScaler: TextScaler.linear(scale)),
        child: child ?? const SizedBox.shrink(),
      ),
      home: Scaffold(
        body: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: HistoryCalendar(
              month: month ?? DateTime(2026, 10),
              today: today ?? DateTime(2026, 10, 21),
              selectedDay: selected,
              days: days,
              onDaySelected: onSelected ?? (_) {},
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('tr');
    await initializeDateFormatting('en');
  });
  for (final locale in ['tr', 'en']) {
    testWidgets('status priority and full semantics $locale', (tester) async {
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final semantics = tester.ensureSemantics();
      await pump(
        tester,
        locale: locale,
        days: {
          '2026-10-18': summary('2026-10-18', denied: 2),
          '2026-10-19': summary('2026-10-19'),
          '2026-10-20': summary(
            '2026-10-20',
            direction: AttendanceDirection.exit,
          ),
          '2026-10-21': summary('2026-10-21'),
        },
      );
      final context = tester.element(day('2026-10-18'));
      final l = AppLocalizations.of(context);
      final tokens = AppUiTokens.of(context);
      expect(
        decoration(tester, '2026-10-18').color,
        tokens.status(AppStatusTone.danger).foreground,
      );
      expect(decoration(tester, '2026-10-18').shape, BoxShape.rectangle);
      expect(
        decoration(tester, '2026-10-18').borderRadius,
        BorderRadius.circular(1),
      );
      expect(decoration(tester, '2026-10-20').shape, BoxShape.circle);
      final legendMarkers = tester
          .widgetList<DecoratedBox>(
            find.descendant(
              of: find.byType(Wrap),
              matching: find.byType(DecoratedBox),
            ),
          )
          .map((widget) => widget.decoration)
          .whereType<BoxDecoration>()
          .toList();
      expect(legendMarkers.map((marker) => marker.shape), [
        BoxShape.circle,
        BoxShape.rectangle,
        BoxShape.circle,
      ]);
      expect(legendMarkers[1].borderRadius, BorderRadius.circular(1));
      expect(decoration(tester, '2026-10-19').color, isNull);
      expect(decoration(tester, '2026-10-19').border, isNotNull);
      expect(decoration(tester, '2026-10-20').color, tokens.accent);
      expect(decoration(tester, '2026-10-21').color, tokens.accent);
      expect(
        tester.getSemantics(day('2026-10-18')).label,
        contains(l.historyDayDenied(2)),
      );
      expect(
        tester.getSemantics(day('2026-10-19')).label,
        contains(l.historyDayMissingExit),
      );
      expect(
        tester.getSemantics(day('2026-10-21')).label,
        isNot(contains(l.historyDayMissingExit)),
      );
      expect(
        tester.getSemantics(day('2026-10-01')).label,
        contains(l.historyDayRecordCount(0)),
      );
      expect(find.text(l.historyLegendRecords), findsOneWidget);
      expect(find.text(l.historyLegendDenied), findsOneWidget);
      expect(find.text(l.historyLegendMissingExit), findsOneWidget);
      semantics.dispose();
    });
  }
  for (final (month, rows) in [
    (DateTime(2026, 10), 5),
    (DateTime(2026, 11), 6),
    (DateTime(2027, 2), 4),
  ]) {
    testWidgets('minimal week rows $month', (tester) async {
      await pump(tester, month: month, today: DateTime(2027, 3));
      final first = day(
        '${month.year}-${month.month.toString().padLeft(2, '0')}-01',
      );
      final lastNumber = DateTime(month.year, month.month + 1, 0).day;
      final last = day(
        '${month.year}-${month.month.toString().padLeft(2, '0')}-$lastNumber',
      );
      expect(
        tester.getTopLeft(last).dy - tester.getTopLeft(first).dy,
        (rows - 1) * 48,
      );
    });
  }
  for (final (width, scale) in [(320.0, 1.0), (390.0, 2.0)]) {
    testWidgets('list filters and sorts $width $scale', (tester) async {
      DateTime? selected;
      await pump(
        tester,
        width: width,
        scale: scale,
        days: {
          '2026-10-19': summary('2026-10-19'),
          '2026-10-12': summary('2026-10-12', denied: 1),
        },
        onSelected: (day) => selected = day,
      );
      final rows = tester
          .widgetList<AppListRow>(find.byType(AppListRow))
          .toList();
      expect(rows.map((row) => row.key), [
        const ValueKey('history-day-2026-10-21'),
        const ValueKey('history-day-2026-10-19'),
        const ValueKey('history-day-2026-10-12'),
      ]);
      expect(find.byType(Wrap), findsNothing);
      await tester.tap(day('2026-10-21'));
      expect(selected, DateTime(2026, 10, 21));
      expect(tester.takeException(), isNull);
      await pump(tester, width: width, scale: scale);
      expect(tester.widgetList<AppListRow>(find.byType(AppListRow)).length, 21);
      await pump(
        tester,
        width: width,
        scale: scale,
        days: {},
        month: DateTime(2026, 9),
      );
      expect(find.text('No access events in this period'), findsOneWidget);
    });
  }
  for (final dark in [false, true]) {
    testWidgets('selected contrast and today styling $dark', (tester) async {
      await pump(tester, dark: dark, selected: DateTime(2026, 10, 19));
      final button = tester.widget<TextButton>(
        find.descendant(
          of: day('2026-10-19'),
          matching: find.byType(TextButton),
        ),
      );
      final background = button.style?.backgroundColor?.resolve({});
      final foreground = button.style?.foregroundColor?.resolve({});
      expect(background, isNotNull);
      expect(foreground, isNotNull);
      if (background == null || foreground == null) return;
      final a = background.computeLuminance();
      final b = foreground.computeLuminance();
      expect(
        ((a > b ? a : b) + .05) / ((a < b ? a : b) + .05),
        greaterThanOrEqualTo(4.5),
      );
      final todayText = tester.widget<Text>(
        find.descendant(of: day('2026-10-21'), matching: find.text('21')),
      );
      expect(todayText.style?.fontWeight, FontWeight.w700);
      final tokens = AppUiTokens.of(tester.element(day('2026-10-21')));
      expect(todayText.style?.color, tokens.accent);
      final accentLuminance = tokens.accent.computeLuminance();
      final canvasLuminance = tokens.canvas.computeLuminance();
      expect(
        ((accentLuminance > canvasLuminance
                    ? accentLuminance
                    : canvasLuminance) +
                .05) /
            ((accentLuminance < canvasLuminance
                    ? accentLuminance
                    : canvasLuminance) +
                .05),
        greaterThanOrEqualTo(4.5),
      );
    });
    testWidgets('selected markers retain distinct shapes $dark', (
      tester,
    ) async {
      final summaries = {
        '2026-10-18': summary('2026-10-18', denied: 1),
        '2026-10-20': summary(
          '2026-10-20',
          direction: AttendanceDirection.exit,
        ),
      };
      await pump(
        tester,
        dark: dark,
        selected: DateTime(2026, 10, 18),
        days: summaries,
      );
      final denied = decoration(tester, '2026-10-18');
      expect(denied.shape, BoxShape.rectangle);
      expect(denied.borderRadius, BorderRadius.circular(1));
      expect(denied.color, isNotNull);
      expect(
        tester.getSize(
          find.byKey(const ValueKey('history-day-marker-2026-10-18')),
        ),
        const Size(6, 6),
      );
      await pump(
        tester,
        dark: dark,
        selected: DateTime(2026, 10, 20),
        days: summaries,
      );
      final records = decoration(tester, '2026-10-20');
      expect(records.shape, BoxShape.circle);
      expect(records.borderRadius, isNull);
      expect(records.color, denied.color);
      expect(
        tester.getSize(
          find.byKey(const ValueKey('history-day-marker-2026-10-20')),
        ),
        const Size(6, 6),
      );
    });
  }
}
