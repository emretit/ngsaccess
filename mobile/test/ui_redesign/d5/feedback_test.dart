import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/brand_mark.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';

import '../../auth_fakes.dart';
import '../../widgets/login_screen_test.dart' show wrapLogin;

void main() {
  testWidgets('restored login retains first-invalid-field and next focus', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final repo = FakeAuthRepository();
    final auth = AuthProvider(
      repository: repo,
      sessionStore: FakeSessionStore(),
    );
    addTearDown(auth.dispose);
    await tester.pumpWidget(wrapLogin(auth));
    await tester.pumpAndSettle();
    expect(find.text('Hoş geldiniz!'), findsOneWidget);
    expect(tester.getSize(find.byType(BrandMark)), const Size(44, 44));
    final email = find.byKey(const ValueKey('login-email'));
    final password = find.byKey(const ValueKey('login-password'));
    final submit = find.byKey(const ValueKey('login-submit'));
    expect(
      tester.getRect(email).top,
      greaterThan(tester.getRect(find.text('Hoş geldiniz!')).bottom),
    );
    await tester.tap(submit);
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<TextField>(
            find.descendant(of: email, matching: find.byType(TextField)),
          )
          .focusNode
          ?.hasFocus,
      isTrue,
    );
    await tester.enterText(email, 'a@example.test');
    await tester.testTextInput.receiveAction(TextInputAction.next);
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<TextField>(
            find.descendant(of: password, matching: find.byType(TextField)),
          )
          .focusNode
          ?.hasFocus,
      isTrue,
    );
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<TextField>(
            find.descendant(of: password, matching: find.byType(TextField)),
          )
          .focusNode
          ?.hasFocus,
      isTrue,
    );
    expect(repo.signInCalls, 0);
    expect(tester.takeException(), isNull);
  });

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
          (tester.widget<AnimatedContainer>(circle).decoration as BoxDecoration)
              .color,
          AppUiTokens.of(context).bandBackground,
        );
        final home = find.byKey(const ValueKey('app_nav_button_0'));
        expect(tester.getRect(circle).top, lessThan(tester.getRect(home).top));
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
}
