import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import 'package:ngsplusapp/widgets/ui/app_date_field.dart' show AppPickerField;
import '../../theme/app_theme_test.dart' show contrast;

Future<void> mount(
  WidgetTester tester,
  Widget child, {
  bool dark = false,
  String locale = 'en',
  double scale = 1,
  double width = 390,
}) async {
  tester.view.physicalSize = Size(width, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
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
        child: child!,
      ),
      home: Scaffold(
        body: Align(alignment: Alignment.topLeft, child: child),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  for (final dark in [false, true]) {
    testWidgets(
      'RV1-01 52dp controls fill the row; focus ring does not affect layout $dark',
      (tester) async {
        final focus = FocusNode();
        addTearDown(focus.dispose);
        await mount(
          tester,
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppPrimaryButton(
                label: 'Send',
                onPressed: () {},
                focusNode: focus,
              ),
              AppSecondaryButton(
                label: 'Cancel',
                onPressed: () {},
                expanded: true,
              ),
            ],
          ),
          dark: dark,
        );
        for (final type in [FilledButton, OutlinedButton]) {
          expect(tester.getSize(find.byType(type)), const Size(390, 52));
        }
        expect(tester.getSize(find.byType(AppPrimaryButton)).height, 52);
        expect(tester.getSize(find.byType(AppSecondaryButton)).height, 52);
        focus.requestFocus();
        await tester.pumpAndSettle();
        expect(tester.getSize(find.byType(FilledButton)), const Size(390, 52));
        final ring = tester
            .widgetList<Positioned>(
              find.descendant(
                of: find.byType(AppPrimaryButton),
                matching: find.byType(Positioned),
              ),
            )
            .single;
        expect([
          ring.left,
          ring.right,
          ring.top,
          ring.bottom,
        ], everyElement(-5));
      },
    );
    testWidgets(
      'RV1-03 selected first and last rows cannot paint outside rounded group $dark',
      (tester) async {
        const capture = ValueKey('rounded-group');
        await mount(
          tester,
          const RepaintBoundary(
            key: capture,
            child: SizedBox(
              width: 240,
              child: AppListGroup(
                children: [
                  AppListRow(title: 'First', selected: true),
                  AppListRow(title: 'Last', selected: true),
                ],
              ),
            ),
          ),
          dark: dark,
        );
        final boundary = tester.renderObject<RenderRepaintBoundary>(
          find.byKey(capture),
        );
        await tester.runAsync(() async {
          final image = await boundary.toImage();
          try {
            final data = await image.toByteData(
              format: ui.ImageByteFormat.rawRgba,
            );
            expect(data, isNotNull);
            int alpha(int x, int y) =>
                data!.getUint8((y * image.width + x) * 4 + 3);
            expect(alpha(2, 2), 0);
            expect(alpha(2, image.height - 3), 0);
            expect(alpha(120, 8), 255);
          } finally {
            image.dispose();
          }
        });
      },
    );
    testWidgets(
      'RV1-06 disabled destructive uses the exact disabled foreground $dark',
      (tester) async {
        await mount(
          tester,
          const AppSecondaryButton(
            label: 'Delete',
            onPressed: null,
            destructive: true,
          ),
          dark: dark,
        );
        final t = AppUiTokens.of(
          tester.element(find.byType(AppSecondaryButton)),
        );
        final button = tester.widget<OutlinedButton>(
          find.byType(OutlinedButton),
        );
        expect(
          button.style?.foregroundColor?.resolve({WidgetState.disabled}),
          t.disabledForeground,
        );
        expect(
          contrast(t.disabledForeground, t.disabledBackground),
          greaterThanOrEqualTo(3),
        );
        expect(
          DefaultTextStyle.of(tester.element(find.text('Delete'))).style.color,
          t.disabledForeground,
        );
      },
    );
    for (final type in [FilledButton, OutlinedButton, TextButton, IconButton]) {
      testWidgets('RV1-07 SDK $type has a 2dp focused border $dark', (
        tester,
      ) async {
        final focus = FocusNode();
        addTearDown(focus.dispose);
        final Widget button;
        if (type == FilledButton) {
          button = FilledButton(
            focusNode: focus,
            onPressed: () {},
            child: const Text('SDK'),
          );
        } else if (type == OutlinedButton) {
          button = OutlinedButton(
            focusNode: focus,
            onPressed: () {},
            child: const Text('SDK'),
          );
        } else if (type == TextButton) {
          button = TextButton(
            focusNode: focus,
            onPressed: () {},
            child: const Text('SDK'),
          );
        } else {
          button = IconButton(
            focusNode: focus,
            onPressed: () {},
            icon: const Icon(Icons.add),
            tooltip: 'SDK',
          );
        }
        await mount(tester, button, dark: dark);
        focus.requestFocus();
        await tester.pumpAndSettle();
        final material = tester.widget<Material>(
          find
              .descendant(
                of: find.byType(type),
                matching: find.byType(Material),
              )
              .first,
        );
        final border = material.shape! as OutlinedBorder;
        expect(border.side.width, 2);
        expect(
          border.side.color,
          AppUiTokens.of(tester.element(find.byType(type))).focus,
        );
      });
    }
  }
  for (final locale in ['tr', 'en']) {
    testWidgets(
      'RV1-04 localized empty, missing metric, and field-specific clear $locale',
      (tester) async {
        final handle = tester.ensureSemantics();
        try {
          var clears = 0;
          await mount(
            tester,
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AppDateField(
                  label: 'Date',
                  value: DateTime.utc(2026, 11, 4),
                  firstDate: DateTime.utc(2020),
                  lastDate: DateTime.utc(2030),
                  allowClear: true,
                  onChanged: (value) {
                    if (value == null) clears++;
                  },
                ),
                const AppMetricRow(
                  metrics: [AppMetric(label: 'Entry', value: '—')],
                ),
                AppSelectField<int>(
                  label: 'Option',
                  value: null,
                  options: const [],
                  onChanged: (_) {},
                ),
              ],
            ),
            locale: locale,
          );
          final l = AppLocalizations.of(
            tester.element(find.byType(AppDateField)),
          );
          expect(
            find.bySemanticsLabel('Date, ${l.fieldClear}'),
            findsOneWidget,
          );
          expect(
            find.bySemanticsLabel('Entry ${l.metricNoRecord}'),
            findsOneWidget,
          );
          await tester.tap(find.text(l.fieldClear));
          expect(clears, 1);
          await tester.tap(find.text(l.fieldSelectOption));
          await tester.pumpAndSettle();
          expect(find.text(l.fieldNoOptions), findsOneWidget);
        } finally {
          handle.dispose();
        }
      },
    );
  }
  testWidgets('RV1-05 metric semantic override is a single accessible value', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    try {
      await mount(
        tester,
        const AppMetricRow(
          metrics: [
            AppMetric(
              label: 'Visible label',
              value: '08:52',
              detail: 'Visible detail',
              semanticLabel: 'First entry at eight fifty two',
            ),
          ],
        ),
      );
      final node = tester.getSemantics(
        find.bySemanticsLabel('First entry at eight fifty two'),
      );
      expect(node.getSemanticsData().label, 'First entry at eight fifty two');
      expect(
        node.debugListChildrenInOrder(DebugSemanticsDumpOrder.traversalOrder),
        isEmpty,
      );
      expect(find.bySemanticsLabel(RegExp('Visible|08:52')), findsNothing);
    } finally {
      handle.dispose();
    }
  });
  for (final scale in [1.0, 1.3, 2.0]) {
    testWidgets(
      'RV1-08 short actions share a phone row until large-text reflow $scale',
      (tester) async {
        await mount(
          tester,
          AppFormActionBar(
            primaryAction: AppPrimaryButton(label: 'Yes', onPressed: () {}),
            secondaryAction: AppSecondaryButton(label: 'No', onPressed: () {}),
          ),
          scale: scale,
        );
        final primary = tester.getRect(find.byType(FilledButton));
        final secondary = tester.getRect(find.byType(OutlinedButton));
        if (scale <= 1.3) {
          expect(primary.top, secondary.top);
          expect(primary.left, greaterThan(secondary.right));
        } else {
          expect(primary.top, greaterThan(secondary.bottom));
        }
      },
    );
  }
  testWidgets('RV1-08 long action labels stack even on a wide phone', (
    tester,
  ) async {
    await mount(
      tester,
      AppFormActionBar(
        primaryAction: AppPrimaryButton(
          label: 'Send the complete correction request',
          onPressed: () {},
        ),
        secondaryAction: AppSecondaryButton(
          label: 'Keep editing this request',
          onPressed: () {},
        ),
      ),
      width: 480,
    );
    expect(
      tester.getTopLeft(find.byType(FilledButton)).dy,
      greaterThan(tester.getBottomLeft(find.byType(OutlinedButton)).dy),
    );
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'RV1-10 large-text time retains tabular figures, tone, and spacing',
    (tester) async {
      await mount(
        tester,
        const AppListRow(
          title: 'Denied',
          leadingText: '13:20',
          leadingIcon: Icons.block,
          tone: AppStatusTone.danger,
        ),
        scale: 2,
      );
      final text = tester.widget<Text>(find.text('13:20'));
      final tokens = AppUiTokens.of(tester.element(find.byType(AppListRow)));
      expect(text.style?.color, tokens.danger.foreground);
      expect(
        text.style?.fontFeatures,
        contains(const FontFeature.tabularFigures()),
      );
      expect(
        tester.getTopLeft(find.byIcon(Icons.block)).dy -
            tester.getBottomLeft(find.text('13:20')).dy,
        4,
      );
    },
  );
  testWidgets(
    'RV1-11 arrows do not re-emit selected value when alternatives disabled',
    (tester) async {
      var calls = 0;
      await mount(
        tester,
        AppSegmentControl<int>(
          segments: const [
            AppSegment(value: 0, label: 'A'),
            AppSegment(value: 1, label: 'B', enabled: false),
          ],
          selected: 0,
          onChanged: (_) => calls++,
        ),
      );
      tester
          .widget<TextButton>(find.widgetWithText(TextButton, 'A'))
          .focusNode
          ?.requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft);
      expect(calls, 0);
    },
  );
  testWidgets(
    'RV1-11 unbounded parent uses finite widths and removed nodes are disposed',
    (tester) async {
      var alternate = false;
      late StateSetter update;
      await mount(
        tester,
        StatefulBuilder(
          builder: (context, setState) {
            update = setState;
            return Row(
              children: [
                AppSegmentControl<int>(
                  segments: [
                    const AppSegment(value: 0, label: 'A'),
                    AppSegment(
                      value: alternate ? 2 : 1,
                      label: alternate ? 'C' : 'B',
                    ),
                  ],
                  selected: 0,
                  onChanged: (_) {},
                ),
              ],
            );
          },
        ),
      );
      expect(
        tester.getSize(find.byType(AppSegmentControl<int>)).width.isFinite,
        isTrue,
      );
      expect(tester.takeException(), isNull);
      final removed = tester
          .widget<TextButton>(find.widgetWithText(TextButton, 'B'))
          .focusNode!;
      update(() => alternate = true);
      await tester.pumpAndSettle();
      expect(() => removed.addListener(() {}), throwsFlutterError);
      expect(find.text('C'), findsOneWidget);
    },
  );
  testWidgets('RV1-12 sheet announces its route name and scope', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    try {
      await mount(
        tester,
        const SizedBox(
          height: 500,
          child: AppSheet(title: 'Details', body: Text('Body')),
        ),
      );
      final nodes = find.byWidgetPredicate(
        (w) =>
            w is Semantics &&
            w.properties.scopesRoute == true &&
            w.properties.label == 'Details',
      );
      expect(nodes, findsOneWidget);
      final flags = tester
          .getSemantics(nodes)
          .getSemanticsData()
          .flagsCollection;
      expect(flags.scopesRoute, isTrue);
      expect(flags.namesRoute, isTrue);
    } finally {
      handle.dispose();
    }
  });
  test(
    'RV1-13 invalid draft ranges are absent while validated API stays strict',
    () {
      final format = AppDateFormat(
        locale: const Locale('en'),
        now: DateTime.utc(2026, 11, 4),
      );
      expect(
        format.tryDateRange(
          startDay: DateTime.utc(2026, 11, 8),
          endDay: DateTime.utc(2026, 11, 4),
        ),
        isNull,
      );
      expect(
        format.tryDateRange(
          startDay: DateTime.utc(2026, 11, 4),
          endDay: DateTime.utc(2026, 11, 8),
        ),
        '4–8 Nov',
      );
      expect(
        () => format.dateRange(
          startDay: DateTime.utc(2026, 11, 8),
          endDay: DateTime.utc(2026, 11, 4),
        ),
        throwsArgumentError,
      );
    },
  );
  test(
    'RV1-13 empty picker starts on Turkey day and clamps to allowed days',
    () {
      final first = DateTime.utc(2026, 11, 1);
      final last = DateTime.utc(2026, 11, 30);
      DateTime day(String instant) => AppDateFormat.initialPickerDay(
        now: DateTime.parse(instant),
        firstDate: first,
        lastDate: last,
      );
      expect(day('2026-11-03T20:59:00Z'), DateTime.utc(2026, 11, 3));
      expect(day('2026-11-03T21:00:00Z'), DateTime.utc(2026, 11, 4));
      expect(day('2025-01-01T00:00:00Z'), first);
      expect(day('2027-01-01T00:00:00Z'), last);
      expect(
        AppDateFormat.initialPickerDay(
          now: DateTime.utc(2026),
          value: DateTime.utc(2026, 11, 9),
          firstDate: first,
          lastDate: last,
        ),
        DateTime.utc(2026, 11, 9),
      );
    },
  );
  testWidgets(
    'RV1-13 date field passes explicit initial and current Turkey dates',
    (tester) async {
      await mount(
        tester,
        AppDateField(
          label: 'Date',
          value: null,
          firstDate: DateTime.utc(2030),
          lastDate: DateTime.utc(2031),
          onChanged: (_) {},
        ),
      );
      await tester.tap(find.text('Choose a date'));
      await tester.pumpAndSettle();
      final picker = tester.widget<DatePickerDialog>(
        find.byType(DatePickerDialog),
      );
      expect(picker.initialDate, DateTime(2030));
      final today = AppDateFormat.calendarDayFromInstant(DateTime.now());
      expect(picker.currentDate, DateTime(today.year, today.month, today.day));
    },
  );
  testWidgets(
    'RV1-15 shared large-text policy preserves 130 percent boundary',
    (tester) async {
      await mount(
        tester,
        Builder(
          builder: (context) => Text(isLargeText(context) ? 'large' : 'normal'),
        ),
        scale: 1.3,
      );
      expect(find.text('normal'), findsOneWidget);
      await mount(
        tester,
        Builder(
          builder: (context) => Text(isLargeText(context) ? 'large' : 'normal'),
        ),
        scale: 2,
      );
      expect(find.text('large'), findsOneWidget);
    },
  );
  testWidgets(
    'RV1-16 nav uses Ink, picker has one surface, and notice action has 12dp gap',
    (tester) async {
      await mount(
        tester,
        Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppBottomNavigation(
              selectedIndex: 0,
              onDestinationSelected: (_) {},
            ),
            AppTimeField(label: 'Time', value: null, onChanged: (_) {}),
            AppDataNotice(
              message: 'Message',
              actionLabel: 'Retry',
              onAction: () {},
            ),
          ],
        ),
      );
      expect(
        find.descendant(
          of: find.byType(AppBottomNavigation),
          matching: find.byType(Ink),
        ),
        findsNWidgets(5),
      );
      expect(
        find.descendant(
          of: find.byType(AppPickerField),
          matching: find.byType(Material),
        ),
        findsNothing,
      );
      expect(
        tester.getTopLeft(find.byType(AppSecondaryButton)).dy -
            tester.getBottomLeft(find.text('Message')).dy,
        greaterThanOrEqualTo(12),
      );
    },
  );
  testWidgets(
    'RV1-17 EN QR Actions keeps selected semantics and full-cell 48dp target',
    (tester) async {
      final handle = tester.ensureSemantics();
      try {
        var selected = 2;
        await mount(
          tester,
          StatefulBuilder(
            builder: (context, setState) => AppBottomNavigation(
              selectedIndex: selected,
              onDestinationSelected: (value) =>
                  setState(() => selected = value),
            ),
          ),
          width: 320,
          scale: 2,
        );
        final node = tester.getSemantics(find.bySemanticsLabel('QR Actions'));
        expect(
          node.getSemanticsData().flagsCollection.isSelected.toBoolOrNull(),
          isTrue,
        );
        for (var index = 0; index < 5; index++) {
          final target = find.byKey(ValueKey('app_nav_button_$index'));
          final size = tester.getSize(target);
          expect(
            size.width,
            54,
          ); // 320 minus floating insets, five cells and gaps.
          expect(size.height, greaterThanOrEqualTo(48));
        }
        await tester.tap(find.byKey(const ValueKey('app_nav_button_0')));
        await tester.pumpAndSettle();
        expect(
          tester
              .getSemantics(find.bySemanticsLabel('QR Actions'))
              .getSemanticsData()
              .flagsCollection
              .isSelected
              .toBoolOrNull(),
          isFalse,
        );
      } finally {
        handle.dispose();
      }
    },
  );
}
