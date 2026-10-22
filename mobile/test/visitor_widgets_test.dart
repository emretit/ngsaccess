import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/models/visitor.dart';
import 'package:ngsplusapp/providers/visitor_provider.dart';
import 'package:ngsplusapp/screens/visitor/visitor_screen.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/visitor/visitor_cards.dart';
import 'package:ngsplusapp/widgets/visitor/visitor_detail.dart';

import 'visitor_provider_test.dart'
    show FakeVisitorRepository, visitorFixture, visitorPage;

Widget app(
  VisitorProvider state, {
  Locale locale = const Locale('en'),
  double textScale = 1,
  ThemeMode themeMode = ThemeMode.light,
  bool nested = false,
}) => ChangeNotifierProvider.value(
  value: state,
  child: MaterialApp(
    locale: locale,
    theme: AppTheme.lightTheme,
    darkTheme: AppTheme.darkTheme,
    themeMode: themeMode,
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(
        context,
      ).copyWith(textScaler: TextScaler.linear(textScale)),
      child: child ?? const SizedBox.shrink(),
    ),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: nested
        ? Scaffold(
            bottomNavigationBar: const SizedBox(
              key: Key('visitor-outer-nav'),
              height: 80,
            ),
            body: Navigator(
              onGenerateRoute: (_) => MaterialPageRoute<void>(
                builder: (_) => const VisitorScreen(),
              ),
            ),
          )
        : const VisitorScreen(),
  ),
);

void main() {
  testWidgets(
    'successful empty state supports pull refresh and displays retry after failure',
    (tester) async {
      final repo = FakeVisitorRepository();
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await state.refresh();
      await tester.pumpWidget(app(state));
      expect(find.text('No visitor records yet'), findsOneWidget);
      expect(find.byType(VisitorSummaryCard), findsNothing);
      expect(find.byType(FloatingActionButton), findsNothing);
      repo.listResult = () => Future.error(const NetworkError());
      await tester.drag(find.byType(ListView), const Offset(0, 400));
      await tester.pumpAndSettle();
      expect(repo.listCalls, 2);
      expect(find.text('Try Again'), findsOneWidget);
      expect(find.text('No visitor records yet'), findsNothing);
      repo.listResult = () async => visitorPage([visitorFixture('own')]);
      await tester.tap(find.text('Try Again'));
      await tester.pumpAndSettle();
      expect(find.text('Synthetic own'), findsOneWidget);
    },
  );

  testWidgets(
    'active access cancellation reports operator requirement without a false success',
    (tester) async {
      final repo = FakeVisitorRepository();
      repo.listResult = () async =>
          visitorPage([visitorFixture('active', active: true)]);
      repo.detailResult = (_) async => visitorFixture('active', active: true);
      repo.cancelResult = (_) async => false;
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await state.refresh();
      await tester.pumpWidget(app(state));
      await tester.tap(find.text('Synthetic active'));
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: find.byType(VisitorDetail),
          matching: find.text('Access active'),
        ),
        findsOneWidget,
      );
      expect(find.text('Physical presence unknown'), findsOneWidget);
      expect(find.text('Edit'), findsNothing);
      await tester.tap(find.text('Cancel invitation'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Cancel invitation'));
      await tester.pumpAndSettle();
      expect(repo.cancelCalls, 1);
      expect(
        find.text('Contact an authorized operator to revoke active access.'),
        findsOneWidget,
      );
      expect(find.text('Invitation cancelled.'), findsNothing);
      expect(state.selected?.id, 'active');
    },
  );

  testWidgets('declining cancellation performs no mutation', (tester) async {
    final repo = FakeVisitorRepository()
      ..listResult = () async => visitorPage([visitorFixture('own')]);
    final state = VisitorProvider(repository: repo);
    addTearDown(state.dispose);
    await state.refresh();
    await tester.pumpWidget(app(state));
    await tester.tap(find.text('Synthetic own'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel invitation'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
    await tester.pumpAndSettle();
    expect(repo.cancelCalls, 0);
    expect(state.selected?.id, 'own');
  });

  testWidgets(
    'ownership rejection never displays visitor contact information',
    (tester) async {
      final repo = FakeVisitorRepository();
      repo.listResult = () async => visitorPage([visitorFixture('own')]);
      repo.detailResult = (_) =>
          Future.error(const BusinessError(message: '', code: 'ACCESS_DENIED'));
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await state.refresh();
      await tester.pumpWidget(app(state));
      await tester.tap(find.text('Synthetic own'));
      await tester.pumpAndSettle();
      expect(find.text('Access denied'), findsOneWidget);
      expect(find.textContaining('+900000000000'), findsNothing);
      expect(find.text('Edit'), findsNothing);
      expect(find.text('Cancel invitation'), findsNothing);
    },
  );

  testWidgets(
    'ambiguous create locks its details and retries with the same request ID',
    (tester) async {
      final repo = FakeVisitorRepository()
        ..createResult = () => Future.error(const TimeoutError());
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await state.refresh();
      await tester.pumpWidget(app(state));
      await tester.tap(find.byTooltip('Add Visitor'));
      await tester.pumpAndSettle();
      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), 'Synthetic');
      await tester.enterText(fields.at(1), 'Visitor');
      await tester.enterText(fields.at(2), '+900000000000');
      await tester.enterText(fields.at(3), 'Synthetic visit');
      tester.testTextInput.hide();
      await tester.pump();
      await tester.scrollUntilVisible(
        find.widgetWithText(FilledButton, 'Save'),
        200,
        scrollable: find
            .descendant(
              of: find.byType(Form),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Save'));
      await tester.pumpAndSettle();
      expect(repo.createCalls, 1);
      expect(
        find.byWidgetPredicate(
          (widget) => widget is TextFormField && widget.enabled == false,
        ),
        findsWidgets,
      );
      expect(state.pendingCreate, isNotNull);
      repo.createResult = () async => 'created';
      await tester.scrollUntilVisible(
        find.widgetWithText(FilledButton, 'Retry same request'),
        200,
        scrollable: find
            .descendant(
              of: find.byType(Form),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Retry same request'));
      await tester.pumpAndSettle();
      expect(repo.requests, hasLength(2));
      expect(repo.requests.first, repo.requests.last);
      expect(state.pendingCreate, isNull);
      expect(
        find.text('Invitation record saved; operator activation is required.'),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'search debounces server filtering and summary overflow is explicit',
    (tester) async {
      final repo = FakeVisitorRepository();
      repo.summaryResult = () async => const VisitorSummary(
        total: 1000,
        counts: {VisitorAccessStatus.preRegistered: 1000},
        overflow: true,
      );
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await state.refresh();
      await tester.pumpWidget(app(state));
      expect(
        find.text(
          'These totals are lower bounds; the summary read limit was reached.',
        ),
        findsOneWidget,
      );
      await tester.enterText(find.byType(TextField), 'IŞIL');
      await tester.pump(const Duration(milliseconds: 200));
      expect(repo.listCalls, 1);
      repo.listResult = () async => visitorPage([visitorFixture('filtered')]);
      await tester.pump(const Duration(milliseconds: 150));
      await tester.pumpAndSettle();
      expect(repo.filters.last.search, 'IŞIL');
      expect(find.text('Synthetic filtered'), findsOneWidget);
    },
  );

  testWidgets(
    'editing clears optional contact and notes with explicit null payloads',
    (tester) async {
      final repo = FakeVisitorRepository();
      repo.listResult = () async =>
          visitorPage([visitorFixture('own', notes: 'Synthetic note')]);
      repo.detailResult = (_) async =>
          visitorFixture('own', notes: 'Synthetic note');
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await state.refresh();
      await tester.pumpWidget(app(state));
      await tester.tap(find.text('Synthetic own'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.widgetWithText(OutlinedButton, 'Edit'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(OutlinedButton, 'Edit'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).at(2), '');
      final notes = find.widgetWithText(TextFormField, 'Notes');
      final scrollable = find
          .descendant(of: find.byType(Form), matching: find.byType(Scrollable))
          .first;
      await tester.scrollUntilVisible(notes, 150, scrollable: scrollable);
      await tester.pumpAndSettle();
      await tester.enterText(notes, '');
      tester.testTextInput.hide();
      await tester.pump();
      await tester.scrollUntilVisible(
        find.widgetWithText(FilledButton, 'Save'),
        150,
        scrollable: scrollable,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Save'));
      await tester.pumpAndSettle();
      expect(repo.updatedDraft, isNotNull);
      expect(repo.updatedDraft?.toJson(), containsPair('visitorPhone', null));
      expect(repo.updatedDraft?.toJson(), containsPair('notes', null));
    },
  );

  testWidgets(
    'clearing a status filter also cancels pending search and clears its field',
    (tester) async {
      final repo = FakeVisitorRepository();
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await state.refresh();
      await tester.pumpWidget(app(state));
      await tester.tap(find.byTooltip('Filter'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Access active'));
      await tester.pumpAndSettle();
      expect(repo.filters.last.status, VisitorAccessStatus.active);
      await tester.enterText(find.byType(TextField), 'pending query');
      await tester.pump(const Duration(milliseconds: 100));
      await tester.tap(find.widgetWithText(TextButton, 'Clear filters'));
      await tester.pump(const Duration(milliseconds: 500));
      expect(repo.filters.last.search, '');
      expect(repo.filters.last.status, isNull);
      expect(
        tester.widget<EditableText>(find.byType(EditableText)).controller.text,
        '',
      );
      expect(repo.filters.where((f) => f.search == 'pending query'), isEmpty);
      expect(repo.createCalls, 0);
    },
  );

  testWidgets(
    'all-invitation totals remain separate from filtered list results',
    (tester) async {
      final repo = FakeVisitorRepository()
        ..summaryResult = () async => const VisitorSummary(
          total: 2,
          counts: {
            VisitorAccessStatus.active: 1,
            VisitorAccessStatus.preRegistered: 1,
          },
          overflow: false,
        );
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await state.refresh();
      await tester.pumpWidget(app(state));
      await tester.tap(find.byTooltip('Filter'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Expired'));
      await tester.pumpAndSettle();
      expect(repo.filters.last.status, VisitorAccessStatus.expired);
      expect(find.text('All invitations'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
      expect(find.text('No records found'), findsOneWidget);
      expect(find.text('Inside'), findsNothing);
    },
  );

  testWidgets(
    'filter and visitor details cover navigation outside a nested branch',
    (tester) async {
      final repo = FakeVisitorRepository()
        ..listResult = () async => visitorPage([visitorFixture('own')]);
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await state.refresh();
      await tester.pumpWidget(app(state, nested: true));
      final navTop = tester
          .getTopLeft(find.byKey(const Key('visitor-outer-nav')))
          .dy;
      await tester.tap(find.byTooltip('Filter'));
      await tester.pumpAndSettle();
      expect(
        tester.getRect(find.byType(BottomSheet)).bottom,
        greaterThan(navTop),
      );
      await tester.tap(find.byTooltip('Close'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Synthetic own'));
      await tester.pumpAndSettle();
      expect(
        tester.getRect(find.byType(BottomSheet)).bottom,
        greaterThan(navTop),
      );
      expect(find.byType(VisitorDetail), findsOneWidget);
      await tester.tap(find.byTooltip('Close'));
      await tester.pumpAndSettle();
      expect(repo.cancelCalls, 0);
    },
  );

  for (final locale in [const Locale('en'), const Locale('tr')]) {
    for (final mode in [ThemeMode.light, ThemeMode.dark]) {
      testWidgets(
        'visitor list, filter and form reflow at 320px / 200% ${locale.languageCode} $mode',
        (tester) async {
          tester.view.physicalSize = const Size(320, 700);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          final repo = FakeVisitorRepository();
          repo.listResult = () async =>
              visitorPage([visitorFixture('A long synthetic surname')]);
          repo.summaryResult = () async => const VisitorSummary(
            total: 2,
            counts: {
              VisitorAccessStatus.active: 1,
              VisitorAccessStatus.preRegistered: 1,
            },
            overflow: false,
          );
          final state = VisitorProvider(repository: repo);
          addTearDown(state.dispose);
          await state.refresh();
          await tester.pumpWidget(
            app(state, locale: locale, textScale: 2, themeMode: mode),
          );
          await tester.pumpAndSettle();
          final l10n = AppLocalizations.of(
            tester.element(find.byType(VisitorScreen)),
          );
          await tester.scrollUntilVisible(
            find.text('Synthetic A long synthetic surname'),
            300,
            scrollable: find
                .descendant(
                  of: find.byType(ListView),
                  matching: find.byType(Scrollable),
                )
                .first,
          );
          await tester.pumpAndSettle();
          expect(
            find.byTooltip(l10n.visitorAddButton).hitTestable(),
            findsOneWidget,
          );
          await tester.tap(find.byTooltip(l10n.visitorAddButton));
          await tester.pumpAndSettle();
          expect(find.text(l10n.visitorActivationHint), findsOneWidget);
          expect(find.text(l10n.visitorPreRegistered), findsNothing);
          await tester.scrollUntilVisible(
            find.widgetWithText(FilledButton, l10n.visitorSave),
            250,
            scrollable: find
                .descendant(
                  of: find.byType(Form),
                  matching: find.byType(Scrollable),
                )
                .first,
          );
          await tester.pumpAndSettle();
          expect(
            find.widgetWithText(FilledButton, l10n.visitorSave).hitTestable(),
            findsOneWidget,
          );
          await tester.tap(find.byType(BackButton));
          await tester.pumpAndSettle();
          await tester.drag(find.byType(ListView), const Offset(0, 4000));
          await tester.pumpAndSettle();
          await tester.tap(find.byTooltip(l10n.visitorFilterTitle));
          await tester.pumpAndSettle();
          expect(find.text(l10n.visitorAllStatuses), findsOneWidget);
          await tester.tap(find.byTooltip(l10n.commonClose));
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          expect(repo.createCalls, 0);
        },
      );
    }
  }
}
