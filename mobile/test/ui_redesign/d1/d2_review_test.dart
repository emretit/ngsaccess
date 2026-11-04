import 'dart:ui' show CheckedState;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import 'fix1_test.dart' show mount;

void main() {
  for (final ownsScroll in [false, true]) {
    testWidgets(
      'RV2-03 busy blocks drag, barrier, back; idle restores drag ($ownsScroll)',
      (tester) async {
        final busy = ValueNotifier(false);
        addTearDown(busy.dispose);
        await mount(
          tester,
          Builder(
            builder: (context) => TextButton(
              onPressed: () => showAppSheet<void>(
                context: context,
                builder: (_) => ValueListenableBuilder<bool>(
                  valueListenable: busy,
                  builder: (_, saving, _) => AppSheet(
                    title: 'Preferences',
                    busy: saving,
                    bodyOwnsScroll: ownsScroll,
                    body: const SizedBox(
                      height: 220,
                      child: Center(child: Text('Options')),
                    ),
                  ),
                ),
              ),
              child: const Text('Open'),
            ),
          ),
        );
        await tester.tap(find.text('Open'));
        await tester.pumpAndSettle();
        busy.value = true;
        await tester.pump();
        final before = tester.getTopLeft(find.byType(AppSheet));
        // Exercise the handle, title, and body rather than only the close button.
        for (final offset in [
          const Offset(195, 10),
          const Offset(35, 40),
          const Offset(195, 150),
        ]) {
          await tester.flingFrom(before + offset, const Offset(0, 400), 1800);
          await tester.pump(const Duration(milliseconds: 500));
          expect(find.byType(AppSheet), findsOneWidget);
          expect(tester.getTopLeft(find.byType(AppSheet)), before);
        }
        await tester.tapAt(const Offset(20, 80));
        await tester.pump(const Duration(milliseconds: 500));
        expect(find.byType(AppSheet), findsOneWidget);
        await tester.binding.handlePopRoute();
        await tester.pump(const Duration(milliseconds: 500));
        expect(find.byType(AppSheet), findsOneWidget);
        expect(
          tester.widget<IconButton>(find.byType(IconButton)).onPressed,
          isNull,
        );
        busy.value = false;
        await tester.pumpAndSettle();
        await tester.flingFrom(
          tester.getTopLeft(find.byType(AppSheet)) + const Offset(195, 10),
          const Offset(0, 400),
          1800,
        );
        await tester.pumpAndSettle();
        expect(find.byType(AppSheet), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets('RV2-03 idle sheet remains barrier-dismissible', (tester) async {
    await mount(
      tester,
      Builder(
        builder: (context) => TextButton(
          onPressed: () => showAppSheet<void>(
            context: context,
            builder: (_) => const AppSheet(title: 'Sheet', body: Text('Body')),
          ),
          child: const Text('Open'),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.tapAt(const Offset(20, 80));
    await tester.pumpAndSettle();
    expect(find.byType(AppSheet), findsNothing);
  });
  testWidgets('RV2-08 close-only dialog uses one secondary and dismisses', (
    tester,
  ) async {
    await mount(
      tester,
      Builder(
        builder: (context) => TextButton(
          onPressed: () => showDialog<void>(
            context: context,
            builder: (_) => const AppDialog(
              title: 'Result',
              body: Text('Done'),
              cancelLabel: 'Close',
            ),
          ),
          child: const Text('Open'),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.byType(AppSecondaryButton), findsOneWidget);
    expect(find.byType(AppPrimaryButton), findsNothing);
    await tester.tap(find.text('Close'));
    await tester.pumpAndSettle();
    expect(find.byType(AppDialog), findsNothing);
  });
  testWidgets(
    'RV2-08 confirm and destructive callbacks retain their behavior',
    (tester) async {
      var confirms = 0;
      var cancels = 0;
      for (final destructive in [false, true]) {
        await mount(
          tester,
          AppDialog(
            title: 'Confirm',
            body: const Text('Details'),
            confirmLabel: 'Continue',
            cancelLabel: 'Cancel',
            destructive: destructive,
            onConfirm: () => confirms++,
            onCancel: () => cancels++,
          ),
        );
        expect(
          find.byType(AppPrimaryButton),
          destructive ? findsNothing : findsOneWidget,
        );
        expect(
          find.byType(AppSecondaryButton),
          findsNWidgets(destructive ? 2 : 1),
        );
        await tester.tap(find.text('Continue'));
        await tester.tap(find.text('Cancel'));
      }
      expect(confirms, 2);
      expect(cancels, 2);
    },
  );
  testWidgets('RV2-08 busy close-only dialog disables its secondary', (
    tester,
  ) async {
    var closes = 0;
    await mount(
      tester,
      AppDialog(
        title: 'Busy',
        body: const Text('Saving'),
        cancelLabel: 'Close',
        busy: true,
        onCancel: () => closes++,
      ),
    );
    await tester.tap(find.text('Close'));
    expect(closes, 0);
    expect(
      tester
          .widget<AppSecondaryButton>(find.byType(AppSecondaryButton))
          .onPressed,
      isNull,
    );
    expect(find.byType(AppPrimaryButton), findsNothing);
  });
  for (final selected in [false, true]) {
    testWidgets(
      'RV2-10 radio row exposes mutually exclusive checked=$selected',
      (tester) async {
        final semantics = tester.ensureSemantics();
        try {
          await mount(
            tester,
            AppListRow(
              title: 'Choice',
              radio: true,
              selected: selected,
              onTap: () {},
            ),
          );
          final flags = tester
              .getSemantics(find.bySemanticsLabel('Choice'))
              .getSemanticsData()
              .flagsCollection;
          expect(flags.isInMutuallyExclusiveGroup, isTrue);
          expect(
            flags.isChecked,
            selected ? CheckedState.isTrue : CheckedState.isFalse,
          );
        } finally {
          semantics.dispose();
        }
      },
    );
  }
  testWidgets('RV2-10 ordinary row does not acquire a radio role', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    try {
      await mount(
        tester,
        AppListRow(title: 'Item', selected: true, onTap: () {}),
      );
      final flags = tester
          .getSemantics(find.bySemanticsLabel('Item'))
          .getSemanticsData()
          .flagsCollection;
      expect(flags.isInMutuallyExclusiveGroup, isFalse);
      expect(flags.isChecked, CheckedState.none);
    } finally {
      semantics.dispose();
    }
  });
  for (final scale in [1.0, 2.0]) {
    testWidgets(
      'RV2-15 metrics announce label value detail once at scale $scale',
      (tester) async {
        final semantics = tester.ensureSemantics();
        try {
          await mount(
            tester,
            const AppMetricRow(
              metrics: [
                AppMetric(
                  label: 'First entry',
                  value: '08:52',
                  detail: 'Main door',
                ),
                AppMetric(label: 'Last exit', value: '—'),
              ],
            ),
            scale: scale,
          );
          for (final label in [
            'First entry 08:52 Main door',
            'Last exit No record',
          ]) {
            final node = tester.getSemantics(find.bySemanticsLabel(label));
            expect(node.getSemanticsData().label, label);
            expect(
              node.debugListChildrenInOrder(
                DebugSemanticsDumpOrder.traversalOrder,
              ),
              isEmpty,
            );
          }
          expect(
            tester.getTopLeft(find.text('First entry')).dy,
            lessThan(tester.getTopLeft(find.text('08:52')).dy),
          );
          expect(tester.takeException(), isNull);
        } finally {
          semantics.dispose();
        }
      },
    );
  }
}
