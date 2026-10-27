import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/models/visitor.dart';
import 'package:ngsplusapp/providers/visitor_provider.dart';
import 'package:ngsplusapp/screens/visitor/visitor_form_screen.dart';
import 'package:ngsplusapp/widgets/visitor/visitor_labels.dart';
import 'package:provider/provider.dart';

import 'visitor_provider_test.dart' show FakeVisitorRepository, visitorFixture;

class RecordingVisitors extends FakeVisitorRepository {
  final drafts = <VisitorDraft>[];

  @override
  Future<String> create(
    VisitorDraft draft, {
    required String requestId,
    required VisitorNotice notice,
    required bool noticeReviewed,
  }) {
    drafts.add(draft);
    return super.create(
      draft,
      requestId: requestId,
      notice: notice,
      noticeReviewed: noticeReviewed,
    );
  }
}

Future<void> openForm(
  WidgetTester tester,
  VisitorProvider state,
  DateTime Function() now, {
  Visitor? visitor,
}) async {
  await tester.pumpWidget(
    ChangeNotifierProvider.value(
      value: state,
      child: MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => Navigator.of(context).push<void>(
                MaterialPageRoute(
                  builder: (_) => VisitorFormScreen(visitor: visitor, now: now),
                ),
              ),
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Open'));
  await tester.pumpAndSettle();
  if (visitor == null && state.pendingCreate == null) {
    await tester.enterText(find.byType(TextFormField).at(0), 'Test');
    await tester.enterText(find.byType(TextFormField).at(1), 'Visitor');
    await tester.enterText(find.byType(TextFormField).at(3), 'Visit');
    tester.testTextInput.hide();
    await tester.pumpAndSettle();
  }
}

Future<void> submit(WidgetTester tester, {String label = 'Save'}) async {
  final button = find.widgetWithText(FilledButton, label);
  await tester.scrollUntilVisible(
    button,
    200,
    scrollable: find
        .descendant(of: find.byType(Form), matching: find.byType(Scrollable))
        .first,
  );
  await tester.tap(button);
  await tester.pumpAndSettle();
}

Future<void> resume(WidgetTester tester) async {
  for (final state in [
    AppLifecycleState.inactive,
    AppLifecycleState.hidden,
    AppLifecycleState.paused,
    AppLifecycleState.hidden,
    AppLifecycleState.inactive,
    AppLifecycleState.resumed,
  ]) {
    tester.binding.handleAppLifecycleStateChanged(state);
  }
  await tester.pumpAndSettle();
}

String displayedDate(WidgetTester tester, DateTime date) =>
    visitorDate(tester.element(find.byType(VisitorFormScreen)), date);

void main() {
  testWidgets(
    'untouched submit after three hours shifts start and preserves duration',
    (tester) async {
      var now = DateTime(2030, 1, 1, 10, 0, 35);
      final repo = RecordingVisitors();
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await openForm(tester, state, () => now);
      now = now.add(const Duration(hours: 3));
      await submit(tester);
      expect(repo.drafts, hasLength(1));
      final draft = repo.drafts.single;
      expect(draft.start.isBefore(now), isFalse);
      expect(draft.start, DateTime(2030, 1, 1, 13, 1));
      expect(draft.end.difference(draft.start), const Duration(hours: 1));
      expect(
        find.text('Invitation record saved; operator activation is required.'),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'resume refreshes visible untouched times and submit can advance again',
    (tester) async {
      var now = DateTime(2030, 1, 1, 10);
      final repo = RecordingVisitors();
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await openForm(tester, state, () => now);
      now = now.add(const Duration(hours: 3));
      await resume(tester);
      expect(find.text(displayedDate(tester, now)), findsOneWidget);
      expect(
        find.text(displayedDate(tester, now.add(const Duration(hours: 1)))),
        findsOneWidget,
      );
      now = now.add(const Duration(hours: 2));
      await submit(tester);
      expect(repo.drafts.single.start, now);
      expect(repo.drafts.single.end.difference(now), const Duration(hours: 1));
    },
  );

  for (final label in ['Visit starts', 'Visit ends']) {
    testWidgets(
      'manually selected $label is unchanged on resume and stale submit is rejected',
      (tester) async {
        var now = DateTime(2030, 1, 1, 10);
        final repo = RecordingVisitors();
        final state = VisitorProvider(repository: repo);
        addTearDown(state.dispose);
        await openForm(tester, state, () => now);
        final button = find.widgetWithText(OutlinedButton, label);
        await tester.ensureVisible(button);
        await tester.pumpAndSettle();
        await tester.tap(button);
        await tester.pumpAndSettle();
        await tester.tap(find.text('OK'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('OK'));
        await tester.pumpAndSettle();
        final initial = displayedDate(tester, now);
        final end = displayedDate(tester, now.add(const Duration(hours: 1)));
        now = now.add(const Duration(hours: 3));
        await resume(tester);
        expect(find.text(initial), findsOneWidget);
        expect(find.text(end), findsOneWidget);
        await submit(tester);
        expect(repo.drafts, isEmpty);
        expect(find.byType(SnackBar), findsOneWidget);
        expect(find.text(initial), findsOneWidget);
      },
    );
  }

  testWidgets('editing stale times does not shift and retains validation', (
    tester,
  ) async {
    final visitor = visitorFixture('existing');
    var now = visitor.visitStart.toLocal();
    final repo = RecordingVisitors();
    final state = VisitorProvider(repository: repo);
    addTearDown(state.dispose);
    await openForm(tester, state, () => now, visitor: visitor);
    final initial = displayedDate(tester, now);
    now = now.add(const Duration(hours: 3));
    await resume(tester);
    expect(find.text(initial), findsOneWidget);
    await submit(tester);
    expect(repo.updatedDraft, isNull);
    expect(find.byType(SnackBar), findsOneWidget);
    expect(find.text(initial), findsOneWidget);
  });

  testWidgets(
    'pending recovery preserves exact draft and request on resume and submit',
    (tester) async {
      var now = DateTime(2030, 1, 1, 10);
      final draft = VisitorDraft(
        firstName: 'Test',
        lastName: 'Recovery',
        purpose: 'Visit',
        start: now,
        end: now.add(const Duration(hours: 1)),
      );
      final repo = RecordingVisitors();
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      state.pendingCreate = PendingVisitorCreate(
        draft: draft,
        requestId: 'pending-request',
        notice: const VisitorNotice(),
        noticeReviewed: false,
      );
      await openForm(tester, state, () => now);
      final initial = displayedDate(tester, now);
      now = now.add(const Duration(hours: 3));
      await resume(tester);
      expect(find.text(initial), findsOneWidget);
      await submit(tester, label: 'Retry same request');
      expect(repo.drafts.single, same(draft));
      expect(repo.requests, ['pending-request']);
    },
  );

  testWidgets(
    'ambiguous create keeps exact submitted draft for a later retry',
    (tester) async {
      var now = DateTime(2030, 1, 1, 10);
      final repo = RecordingVisitors()
        ..createResult = () => Future.error(const TimeoutError());
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await openForm(tester, state, () => now);
      await submit(tester);
      final first = repo.drafts.single;
      now = now.add(const Duration(hours: 3));
      await resume(tester);
      expect(find.text(displayedDate(tester, first.start)), findsOneWidget);
      repo.createResult = () async => 'created';
      await submit(tester, label: 'Retry same request');
      expect(repo.drafts.last, same(first));
      expect(repo.requests.first, repo.requests.last);
    },
  );
}
