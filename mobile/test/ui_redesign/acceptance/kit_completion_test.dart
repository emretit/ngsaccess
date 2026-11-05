import 'dart:ui' show Tristate, CheckedState;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/widgets/door_operation_recovery_dialog.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';

import '../../../screenshot_test/_harness.dart';
import '../../helpers/ui_mount.dart' show mount;

class _ReadOnlyCommands extends AuditCommands {
  int queries = 0;
  @override
  Future<void> checkStatus() async => queries++;
}

void semanticsTest(
  String description,
  Future<void> Function(WidgetTester) body,
) {
  testWidgets(description, (tester) async {
    final semantics = tester.ensureSemantics();
    try {
      await body(tester);
    } finally {
      semantics.dispose();
    }
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(loadAuditFonts);
  test(
    'QR tolerance rejects outside pixels, broad changes and wrong sizes',
    () {
      final expected = Uint8List(40 * 20 * 4);
      final actual = Uint8List.fromList(expected);
      const bounds = Rect.fromLTWH(4, 4, 32, 4);
      bool allowed() => auditProgressDiffAllowed(
        actual,
        expected,
        width: 40,
        height: 20,
        bounds: bounds,
      );
      for (var x = 4; x < 20; x++) {
        actual[(4 * 40 + x) * 4] = 255;
      }
      expect(allowed(), isTrue); // A 16px progress endpoint variation.
      actual[0] = 1;
      expect(allowed(), isFalse); // Even one outside pixel is a regression.
      actual[0] = 0;
      for (var x = 4; x < 36; x++) {
        actual[(5 * 40 + x) * 4] = 255;
      }
      expect(allowed(), isFalse); // No broad progress/style changes accepted.
      expect(
        auditProgressDiffAllowed(
          Uint8List(1),
          expected,
          width: 40,
          height: 20,
          bounds: bounds,
        ),
        isFalse,
      );
    },
  );

  for (final dark in [false, true]) {
    semanticsTest(
      'checkbox is one named checked target with inline error $dark',
      (tester) async {
        final focus = FocusNode();
        addTearDown(focus.dispose);
        var checked = false;
        var calls = 0;
        await mount(
          tester,
          StatefulBuilder(
            builder: (context, update) => AppCheckboxRow(
              label: 'Accept privacy notice',
              value: checked,
              focusNode: focus,
              errorText: checked ? null : 'Consent required',
              onChanged: (value) => update(() {
                checked = value ?? false;
                calls++;
              }),
            ),
          ),
          dark: dark,
          width: 320,
          scale: 2,
        );
        final row = find.byType(AppCheckboxRow);
        expect(tester.getSize(row).height, greaterThanOrEqualTo(48));
        final check = tester.getRect(find.byType(Checkbox));
        final label = tester.getRect(find.text('Accept privacy notice'));
        expect(check.left, tester.getRect(row).left);
        expect(label.left - check.right, 8);
        final node = tester.getSemantics(
          find.bySemanticsLabel('Accept privacy notice, Consent required'),
        );
        expect(node.flagsCollection.isChecked, CheckedState.isFalse);
        expect(node.childrenCount, 0);
        await tester.tap(find.text('Accept privacy notice'));
        await tester.pump();
        expect(calls, 1);
        expect(find.text('Consent required'), findsNothing);
        expect(
          tester
              .getSemantics(find.bySemanticsLabel('Accept privacy notice'))
              .flagsCollection
              .isChecked,
          CheckedState.isTrue,
        );
        focus.requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.space);
        await tester.pump();
        expect(calls, 2);
        expect(checked, isFalse);
        expect(tester.takeException(), isNull);
      },
    );
  }

  semanticsTest('disabled checkbox has no tap action and cannot change', (
    tester,
  ) async {
    await mount(
      tester,
      const AppCheckboxRow(
        label: 'Remember email',
        value: true,
        onChanged: null,
      ),
    );
    final node = tester.getSemantics(find.bySemanticsLabel('Remember email'));
    expect(node.flagsCollection.isEnabled, Tristate.isFalse);
    expect(node.getSemanticsData().hasAction(SemanticsAction.tap), isFalse);
  });

  for (final labels in [
    ['İzin', 'Kayıt düzeltme'],
    ['Records', 'Calendar', 'Overview'],
  ]) {
    for (final width in [320.0, 390.0]) {
      semanticsTest(
        'segments retain full labels and keyboard selection at 200% $width $labels',
        (tester) async {
          var selected = 0;
          await mount(
            tester,
            StatefulBuilder(
              builder: (context, update) => AppSegmentControl<int>(
                segments: [
                  for (var i = 0; i < labels.length; i++)
                    AppSegment(value: i, label: labels[i]),
                ],
                selected: selected,
                onChanged: (value) => update(() => selected = value),
              ),
            ),
            scale: 2,
            width: width,
          );
          expect(find.byType(SingleChildScrollView), findsNothing);
          var previousBottom = 0.0;
          for (final label in labels) {
            final button = find.widgetWithText(TextButton, label);
            final bounds = tester.getRect(button);
            expect(bounds.top, greaterThanOrEqualTo(previousBottom));
            expect(bounds.height, greaterThanOrEqualTo(48));
            previousBottom = bounds.bottom;
            final paragraph = tester.renderObject<RenderParagraph>(
              find.text(label),
            );
            expect(paragraph.didExceedMaxLines, isFalse);
            expect(paragraph.size.width, lessThanOrEqualTo(width));
          }
          await tester.tap(find.text(labels.first));
          await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
          await tester.pump();
          expect(selected, 1);
          expect(
            tester
                .getSemantics(
                  find
                      .ancestor(
                        of: find.widgetWithText(TextButton, labels[1]),
                        matching: find.byWidgetPredicate(
                          (widget) =>
                              widget is Semantics &&
                              widget.properties.selected == true,
                        ),
                      )
                      .first,
                )
                .flagsCollection
                .isSelected,
            Tristate.isTrue,
          );
          expect(tester.takeException(), isNull);
        },
      );
    }
  }

  semanticsTest(
    'date picker today and empty initial value use the injected Turkey day',
    (tester) async {
      final instant = DateTime.utc(2027, 1, 1, 21, 30);
      await mount(
        tester,
        AppDateField(
          label: 'Day',
          value: null,
          firstDate: DateTime.utc(2026),
          lastDate: DateTime.utc(2028),
          now: () => instant,
          onChanged: (_) {},
        ),
      );
      await tester.tap(find.text('Choose a date'));
      await tester.pumpAndSettle();
      final picker = tester.widget<DatePickerDialog>(
        find.byType(DatePickerDialog),
      );
      expect(picker.currentDate, DateTime(2027, 1, 2));
      expect(picker.initialDate, DateTime(2027, 1, 2));
    },
  );

  semanticsTest('range picker today uses the same injected Turkey day', (
    tester,
  ) async {
    await mount(
      tester,
      AppDateRangeField(
        label: 'Dates',
        value: null,
        firstDate: DateTime.utc(2026),
        lastDate: DateTime.utc(2028),
        now: () => DateTime.utc(2027, 1, 1, 21, 30),
        onChanged: (_) {},
      ),
    );
    await tester.tap(find.text('Choose a date'));
    await tester.pumpAndSettle();
    final picker = tester.widget<DateRangePickerDialog>(
      find.byType(DateRangePickerDialog),
    );
    expect(picker.currentDate, DateTime(2027, 1, 2));
  });

  semanticsTest('supporting content remains in the named row semantics', (
    tester,
  ) async {
    var calls = 0;
    await mount(
      tester,
      AppListRow(
        title: 'İpek Şahin',
        subtitle: '4 November',
        supporting: const Text('Activation pending, not inside'),
        onTap: () => calls++,
      ),
    );
    final node = tester.getSemantics(find.byType(AppListRow));
    expect(node.label, contains('Activation pending, not inside'));
    await tester.tap(find.text('Activation pending, not inside'));
    expect(calls, 1);
  });

  semanticsTest('resolved recovery has only Close and queries once on open', (
    tester,
  ) async {
    final commands = _ReadOnlyCommands();
    final auth = AuditAuth('filled');
    addTearDown(commands.dispose);
    addTearDown(auth.dispose);
    await mount(
      tester,
      DoorOperationRecoveryDialog(commands: commands, auth: auth),
    );
    expect(commands.queries, 1);
    expect(find.text('Close'), findsOneWidget);
    expect(find.byType(AppPrimaryButton), findsNothing);
    expect(find.byType(AppSecondaryButton), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
