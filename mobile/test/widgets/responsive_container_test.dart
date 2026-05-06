import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/widgets/responsive_container.dart';

void main() {
  Widget wrap(double screenWidth, Widget child) {
    return MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(size: Size(screenWidth, 800)),
        child: Scaffold(body: child),
      ),
    );
  }

  testWidgets('genişlik > maxWidth ise içerik maxWidth\'e clamp olur',
      (tester) async {
    tester.view.physicalSize = const Size(1200, 1600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      wrap(
        1200,
        const ResponsiveContainer(
          maxWidth: 480,
          child: SizedBox(
            key: Key('content'),
            width: double.infinity,
            height: 100,
          ),
        ),
      ),
    );

    final size = tester.getSize(find.byKey(const Key('content')));
    expect(size.width, lessThanOrEqualTo(480));
  });

  testWidgets('genişlik < maxWidth ise içerik tüm genişliği kullanır',
      (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      wrap(
        360,
        const ResponsiveContainer(
          maxWidth: 480,
          child: SizedBox(
            key: Key('content'),
            width: double.infinity,
            height: 100,
          ),
        ),
      ),
    );

    final size = tester.getSize(find.byKey(const Key('content')));
    expect(size.width, 360);
  });
}
