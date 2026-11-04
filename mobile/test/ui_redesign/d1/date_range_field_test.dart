import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import 'fix1_test.dart' show mount;

// Models unchecked external data without triggering DateTimeRange's debug assert.
class _DraftRange implements DateTimeRange {
  @override
  final DateTime start = DateTime.utc(2026, 11, 9);
  @override
  final DateTime end = DateTime.utc(2026, 11, 4);
  @override
  Duration get duration => end.difference(start);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    // Native range-picker headers assume proportional Material font metrics.
    // Ahem makes the unselected start-date label overflow even at scale 1.
    final configured = Platform.environment['FLUTTER_ROOT'];
    final sdk = configured != null
        ? Directory(configured)
        : File(Platform.resolvedExecutable).parent.parent.parent.parent.parent;
    final loader = FontLoader('Roboto');
    final font = File(
      '${sdk.path}/bin/cache/artifacts/material_fonts/Roboto-Regular.ttf',
    );
    loader.addFont(
      Future.value(ByteData.sublistView(await font.readAsBytes())),
    );
    await loader.load();
  });
  testWidgets(
    'RV1-13 invalid range field stays renderable and opens a clean picker',
    (tester) async {
      await mount(
        tester,
        AppDateRangeField(
          label: 'Dates',
          value: _DraftRange(),
          firstDate: DateTime.utc(2026),
          lastDate: DateTime.utc(2027),
          onChanged: (_) {},
        ),
      );
      expect(tester.takeException(), isNull);
      expect(find.text('Choose a date'), findsOneWidget);
      await tester.tap(find.text('Choose a date'));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<DateRangePickerDialog>(find.byType(DateRangePickerDialog))
            .initialDateRange,
        isNull,
      );
      expect(tester.takeException(), isNull);
    },
  );
}
