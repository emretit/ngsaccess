import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/app_bottom_navigation.dart';

import '../helpers/ui_mount.dart' as shared;

import 'package:flutter/services.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart' show AppUiTokens;

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
            extendBody: false,
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
              expect(
                bounds.width,
                closeTo(
                  tester
                      .getSize(find.byKey(const ValueKey('app_nav_button_0')))
                      .width,
                  0.01,
                ),
              );
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

  testWidgets(
    'navigation reserves space and leaves the final content action reachable',
    (tester) async {
      var taps = 0;
      await mount(
        tester,
        size: const Size(390, 844),
        onLastAction: () => taps++,
      );
      final action = find.byKey(const Key('last_content_action'));
      await tester.scrollUntilVisible(action, 400);
      await tester.pumpAndSettle();
      expect(
        tester.getRect(action).bottom,
        lessThanOrEqualTo(
          tester.getTopLeft(find.byType(AppBottomNavigation)).dy,
        ),
      );
      await tester.tap(action);
      await tester.pump();
      expect(taps, 1);
      expect(tester.takeException(), isNull);
    },
  );

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
  group('navigation accessibility regressions', () {
    testWidgets(
      'RV1-17 EN QR Actions keeps selected semantics and full-cell 48dp target',
      (tester) async {
        final handle = tester.ensureSemantics();
        try {
          var selected = 2;
          await shared.mount(
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
  });
  group('keyboard navigation feedback', () {
    for (final dark in [false, true]) {
      testWidgets('floating bar keeps circular QR and keyboard focus $dark', (
        tester,
      ) async {
        final handle = tester.ensureSemantics();
        try {
          tester.view.physicalSize = const Size(390, 844);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          var selected = 0;
          await tester.pumpWidget(
            MaterialApp(
              theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              supportedLocales: AppLocalizations.supportedLocales,
              locale: const Locale('en'),
              home: StatefulBuilder(
                builder: (context, setState) => Scaffold(
                  bottomNavigationBar: AppBottomNavigation(
                    selectedIndex: selected,
                    onDestinationSelected: (value) =>
                        setState(() => selected = value),
                  ),
                ),
              ),
            ),
          );
          await tester.pumpAndSettle();
          final qr = find.byKey(const ValueKey('app_nav_button_2'));
          final circle = find.descendant(
            of: qr,
            matching: find.byWidgetPredicate(
              (w) =>
                  w is AnimatedContainer &&
                  w.decoration is BoxDecoration &&
                  (w.decoration as BoxDecoration).shape == BoxShape.circle,
            ),
          );
          expect(tester.getSize(circle), const Size(64, 64));
          final context = tester.element(qr);
          expect(
            (tester.widget<AnimatedContainer>(circle).decoration
                    as BoxDecoration)
                .color,
            AppUiTokens.of(context).bandBackground,
          );
          final home = find.byKey(const ValueKey('app_nav_button_0'));
          expect(
            tester.getRect(circle).top,
            lessThan(tester.getRect(home).top),
          );
          for (var i = 0; i < 3; i++) {
            await tester.sendKeyEvent(LogicalKeyboardKey.tab);
            await tester.pumpAndSettle();
          }
          await tester.sendKeyEvent(LogicalKeyboardKey.enter);
          await tester.pumpAndSettle();
          expect(selected, 2);
          final data = tester
              .getSemantics(find.bySemanticsLabel('QR Actions'))
              .getSemanticsData();
          expect(data.flagsCollection.isSelected.toBoolOrNull(), isTrue);
          expect(tester.takeException(), isNull);
        } finally {
          handle.dispose();
        }
      });
    }
  });
}
