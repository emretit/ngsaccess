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
  const metrics = [
    AppMetric(value: '08:52', label: 'İlk giriş'),
    AppMetric(value: '12:31', label: 'Son çıkış'),
    AppMetric(value: '13:14', label: 'Son giriş'),
  ];
  for (final dark in [false, true]) {
    for (final width in [308.0, 200.0]) {
      testWidgets('metric layout measures clock labels at $width dark=$dark', (
        tester,
      ) async {
        await mount(
          tester,
          SizedBox(
            width: width,
            child: const AppMetricRow(metrics: metrics),
          ),
          dark: dark,
          locale: 'tr',
        );
        final first = tester.getTopLeft(find.text('08:52'));
        final second = tester.getTopLeft(find.text('12:31'));
        final third = tester.getTopLeft(find.text('13:14'));
        if (width == 308) {
          expect(first.dy, second.dy);
          expect(second.dy, third.dy);
          expect(first.dx, lessThan(second.dx));
          expect(second.dx, lessThan(third.dx));
          expect(second.dx - first.dx, closeTo(third.dx - second.dx, .01));
          expect(find.byType(VerticalDivider), findsNWidgets(2));
        } else {
          expect(first.dx, second.dx);
          expect(second.dx, third.dx);
          expect(first.dy, lessThan(second.dy));
          expect(second.dy, lessThan(third.dy));
          expect(find.byType(VerticalDivider), findsNothing);
        }
        expect(tester.takeException(), isNull);
      });
    }
  }
  testWidgets(
    'metric large-text policy remains vertical even with ample width',
    (tester) async {
      await mount(
        tester,
        const AppMetricRow(metrics: metrics),
        width: 900,
        scale: 2,
      );
      expect(
        tester.getTopLeft(find.text('08:52')).dy,
        lessThan(tester.getTopLeft(find.text('12:31')).dy),
      );
      expect(find.byType(VerticalDivider), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('metric label width participates in the equal-column fit', (
    tester,
  ) async {
    await mount(
      tester,
      const SizedBox(
        width: 308,
        child: AppMetricRow(
          metrics: [
            AppMetric(value: '08:52', label: 'Uzun bir ilk giriş etiketi'),
            AppMetric(value: '12:31', label: 'Son çıkış'),
            AppMetric(value: '13:14', label: 'Son giriş'),
          ],
        ),
      ),
    );
    expect(find.byType(VerticalDivider), findsNothing);
    expect(
      tester.getTopLeft(find.text('08:52')).dy,
      lessThan(tester.getTopLeft(find.text('12:31')).dy),
    );
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'metric fit excludes divider spacing when dividers are disabled',
    (tester) async {
      await mount(
        tester,
        const SizedBox(
          width: 260,
          child: AppMetricRow(metrics: metrics, showDividers: false),
        ),
      );
      expect(
        tester.getTopLeft(find.text('08:52')).dy,
        tester.getTopLeft(find.text('12:31')).dy,
      );
      expect(tester.takeException(), isNull);
    },
  );
}
