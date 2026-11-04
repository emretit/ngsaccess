import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import 'fix1_test.dart' show mount;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    // Measure the same proportional glyph widths used by the app, not Ahem.
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

  const visitorMetrics = [
    AppMetric(value: '12', label: 'Toplam'),
    AppMetric(value: '3', label: 'Erişim aktif'),
    AppMetric(value: '1', label: 'Onay bekliyor'),
  ];

  for (final dark in [false, true]) {
    testWidgets('visitor summary labels fit three columns at 390dp dark=$dark', (
      tester,
    ) async {
      await mount(
        tester,
        const SizedBox(
          width: 358,
          child: AppMetricRow(metrics: visitorMetrics),
        ),
        dark: dark,
        locale: 'tr',
      );
      final first = tester.getTopLeft(find.text('12'));
      final second = tester.getTopLeft(find.text('3'));
      final third = tester.getTopLeft(find.text('1'));
      expect(first.dy, second.dy);
      expect(second.dy, third.dy);
      expect(first.dx, lessThan(second.dx));
      expect(second.dx, lessThan(third.dx));
      expect(find.byType(VerticalDivider), findsNWidgets(2));
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('metric labels stay vertical at 200% text scale', (tester) async {
    await mount(
      tester,
      const AppMetricRow(metrics: visitorMetrics),
      width: 390,
      scale: 2,
      locale: 'tr',
    );
    expect(
      tester.getTopLeft(find.text('12')).dy,
      lessThan(tester.getTopLeft(find.text('3')).dy),
    );
    expect(find.byType(VerticalDivider), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('text field hides counter but keeps maxLength', (tester) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await mount(
      tester,
      AppTextField(
        label: 'Notes',
        controller: controller,
        maxLength: 5,
        showCounter: false,
      ),
    );
    await tester.enterText(find.byType(TextField), 'abcdefgh');
    await tester.pump();
    expect(controller.text, 'abcde');
    expect(find.text('5/5'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('text field shows counter by default', (tester) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await mount(
      tester,
      AppTextField(label: 'Notes', controller: controller, maxLength: 5),
    );
    await tester.enterText(find.byType(TextField), 'abc');
    await tester.pump();
    expect(find.text('3/5'), findsOneWidget);
  });

  for (final (width, scale) in [(390.0, 1.0), (320.0, 2.0)]) {
    testWidgets('list row supporting renders under subtitle at $width/$scale', (
      tester,
    ) async {
      await mount(
        tester,
        const AppListRow(
          title: 'Ayşe Yılmaz',
          subtitle: '9–11 Kas, 09:00–18:00',
          supporting: Text('Erişim aktif · İçeride değil'),
          trailing: Icon(Icons.chevron_right),
        ),
        width: width,
        scale: scale,
        locale: 'tr',
      );
      final subtitle = tester.getBottomLeft(find.text('9–11 Kas, 09:00–18:00'));
      final supporting = tester.getTopLeft(
        find.text('Erişim aktif · İçeride değil'),
      );
      expect(supporting.dy, greaterThanOrEqualTo(subtitle.dy));
      expect(supporting.dx, closeTo(subtitle.dx, .01));
      expect(tester.takeException(), isNull);
    });
  }
}
