import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/app_bottom_navigation.dart';

void main() {
  Future<void> mount(
    WidgetTester tester, {
    Locale locale = const Locale('tr'),
    Brightness brightness = Brightness.light,
    double textScale = 1,
    Size size = const Size(390, 844),
    bool reduceMotion = false,
    VoidCallback? onLastAction,
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    var selectedIndex = 0;
    await tester.pumpWidget(
      MaterialApp(
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        theme: brightness == Brightness.dark
            ? AppTheme.darkTheme
            : AppTheme.lightTheme,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(textScale),
            padding: const EdgeInsets.only(bottom: 34),
            disableAnimations: reduceMotion,
          ),
          child: child ?? const SizedBox.shrink(),
        ),
        home: StatefulBuilder(
          builder: (context, setState) => Scaffold(
            extendBody: true,
            body: SafeArea(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  for (var i = 0; i < 30; i++)
                    ListTile(title: Text('Record $i')),
                  ElevatedButton(
                    key: const Key('last_content_action'),
                    onPressed: onLastAction ?? () {},
                    child: const Text('Last action'),
                  ),
                ],
              ),
            ),
            bottomNavigationBar: AppBottomNavigation(
              selectedIndex: selectedIndex,
              onDestinationSelected: (index) =>
                  setState(() => selectedIndex = index),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  for (final locale in const [Locale('tr'), Locale('en')]) {
    for (final brightness in Brightness.values) {
      testWidgets(
        '320px navigation remains readable and tappable at 200% ${locale.languageCode} $brightness',
        (tester) async {
          final semantics = tester.ensureSemantics();
          try {
            await mount(
              tester,
              locale: locale,
              brightness: brightness,
              textScale: 2,
              size: const Size(320, 568),
            );
            expect(tester.takeException(), isNull);
            final nav = find.byType(AppBottomNavigation);
            for (final paragraph in tester.renderObjectList<RenderParagraph>(
              find.descendant(of: nav, matching: find.byType(RichText)),
            )) {
              expect(paragraph.didExceedMaxLines, isFalse);
            }
            for (var index = 0; index < 5; index++) {
              final target = find.byKey(ValueKey('app_nav_button_$index'));
              final bounds = tester.getRect(target);
              expect(bounds.width, greaterThanOrEqualTo(48));
              expect(bounds.height, greaterThanOrEqualTo(48));
              expect(bounds.left, greaterThanOrEqualTo(0));
              expect(bounds.right, lessThanOrEqualTo(320));
              expect(bounds.bottom, lessThanOrEqualTo(568 - 34));
              await tester.tap(target);
              await tester.pumpAndSettle();
              expect(
                tester.widget<AppBottomNavigation>(nav).selectedIndex,
                index,
              );
            }
            await expectLater(
              tester,
              meetsGuideline(androidTapTargetGuideline),
            );
            await expectLater(
              tester,
              meetsGuideline(labeledTapTargetGuideline),
            );
            expect(tester.takeException(), isNull);
          } finally {
            semantics.dispose();
          }
        },
      );
    }
  }

  testWidgets('floating navigation leaves the final content action reachable', (
    tester,
  ) async {
    var taps = 0;
    await mount(tester, size: const Size(390, 844), onLastAction: () => taps++);
    final action = find.byKey(const Key('last_content_action'));
    await tester.scrollUntilVisible(action, 400);
    await tester.pumpAndSettle();
    expect(
      tester.getRect(action).bottom,
      lessThanOrEqualTo(tester.getTopLeft(find.byType(AppBottomNavigation)).dy),
    );
    await tester.tap(action);
    await tester.pump();
    expect(taps, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('tablet navigation stays centered and honors reduced motion', (
    tester,
  ) async {
    await mount(tester, size: const Size(1024, 768), reduceMotion: true);
    final first = tester.getRect(
      find.byKey(const ValueKey('app_nav_button_0')),
    );
    final last = tester.getRect(find.byKey(const ValueKey('app_nav_button_4')));
    expect((first.left + last.right) / 2, closeTo(512, 1));
    expect(last.right - first.left, lessThanOrEqualTo(560));
    for (final animated in tester.widgetList<AnimatedContainer>(
      find.byType(AnimatedContainer),
    )) {
      expect(animated.duration, Duration.zero);
    }
    await tester.tap(find.byKey(const ValueKey('app_nav_button_2')));
    await tester.pump();
    expect(
      tester
          .widget<AppBottomNavigation>(find.byType(AppBottomNavigation))
          .selectedIndex,
      2,
    );
    expect(tester.takeException(), isNull);
  });
}
