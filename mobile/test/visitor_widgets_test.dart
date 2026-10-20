import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/models/visitor.dart';
import 'package:ngsplusapp/providers/visitor_provider.dart';
import 'package:ngsplusapp/screens/visitor/visitor_screen.dart';

import 'visitor_provider_test.dart'
    show FakeVisitorRepository, visitorFixture, visitorPage;

Widget app(VisitorProvider state) => ChangeNotifierProvider.value(
  value: state,
  child: MaterialApp(
    locale: const Locale('en'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: const VisitorScreen(),
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
      expect(find.text('Access active'), findsOneWidget);
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
}
