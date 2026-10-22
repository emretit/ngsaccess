import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/providers/visitor_provider.dart';
import 'package:ngsplusapp/screens/visitor/visitor_screen.dart';
import 'package:provider/provider.dart';

import 'visitor_create_recovery_test.dart'
    show
        MemoryVisitorIntents,
        RecoveryVisitors,
        recoveryAuth,
        scopeA,
        firstRequest;
import 'visitor_provider_test.dart' show visitorFixture, visitorPage;

Widget recoveryApp(VisitorProvider state) => ChangeNotifierProvider.value(
  value: state,
  child: const MaterialApp(
    locale: Locale('en'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: VisitorScreen(),
  ),
);

void main() {
  testWidgets(
    'a store read completed in background defers receipt and notice until resume',
    (tester) async {
      final auth = await recoveryAuth();
      addTearDown(auth.dispose);
      final read = Completer<void>();
      final store = MemoryVisitorIntents()
        ..values[scopeA] = firstRequest
        ..readGate = read;
      final repo = RecoveryVisitors()..session = auth.sessionToken;
      final state = VisitorProvider(repository: repo, createIntentStore: store);
      addTearDown(state.dispose);
      state.synchronizeSession(auth);
      await state.refresh();
      await tester.pumpWidget(recoveryApp(state));
      await tester.tap(find.byKey(const Key('visitor-add')));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      state.setForeground(false);
      read.complete();
      await tester.pump();
      await tester.pump(const Duration(seconds: 30));
      expect(repo.receiptCalls, 0);
      expect(repo.noticeCalls, 0);
      expect(repo.createCalls, 0);
      expect(state.createRecoveryLoading, isTrue);
      expect(store.values[scopeA], firstRequest);
      expect(
        tester.widget<TextFormField>(find.byType(TextFormField).first).enabled,
        isFalse,
      );
      state.setForeground(true);
      await tester.pumpAndSettle();
      expect(repo.receiptCalls, 1);
      expect(repo.noticeCalls, 1);
      expect(repo.createCalls, 0);
      expect(state.createRecoveryLoading, isFalse);
      expect(state.recoveryRequestId, firstRequest);
      expect(
        tester.widget<TextFormField>(find.byType(TextFormField).first).enabled,
        isTrue,
      );
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'a receipt completed in background does not start notice or unlock create before resume',
    (tester) async {
      final auth = await recoveryAuth();
      addTearDown(auth.dispose);
      final store = MemoryVisitorIntents()..values[scopeA] = firstRequest;
      final receipt = Completer<String?>();
      final repo = RecoveryVisitors()
        ..session = auth.sessionToken
        ..receiptResult = (_) => receipt.future;
      final state = VisitorProvider(repository: repo, createIntentStore: store);
      addTearDown(state.dispose);
      state.synchronizeSession(auth);
      await state.refresh();
      await tester.pumpWidget(recoveryApp(state));
      await tester.tap(find.byKey(const Key('visitor-add')));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(repo.receiptCalls, 1);
      state.setForeground(false);
      receipt.complete(null);
      await tester.pump();
      await tester.pump(const Duration(seconds: 30));
      expect(repo.noticeCalls, 0);
      expect(repo.createCalls, 0);
      expect(state.createRecoveryLoading, isTrue);
      expect(state.recoveryRequestId, firstRequest);
      expect(
        tester.widget<TextFormField>(find.byType(TextFormField).first).enabled,
        isFalse,
      );
      state.setForeground(true);
      await tester.pumpAndSettle();
      expect(repo.receiptCalls, 1);
      expect(repo.noticeCalls, 1);
      expect(repo.createCalls, 0);
      expect(state.createRecoveryLoading, isFalse);
      expect(store.values[scopeA], firstRequest);
      expect(
        tester.widget<TextFormField>(find.byType(TextFormField).first).enabled,
        isTrue,
      );
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'an existing invitation remains editable after leaving a failed create recovery',
    (tester) async {
      final auth = await recoveryAuth();
      addTearDown(auth.dispose);
      final store = MemoryVisitorIntents()
        ..values[scopeA] = firstRequest
        ..failRead = true;
      final repo = RecoveryVisitors()
        ..session = auth.sessionToken
        ..listResult = () async => visitorPage([visitorFixture('own')]);
      final state = VisitorProvider(repository: repo, createIntentStore: store);
      addTearDown(state.dispose);
      state.synchronizeSession(auth);
      await state.refresh();
      await tester.pumpWidget(recoveryApp(state));
      await tester.tap(find.byKey(const Key('visitor-add')));
      await tester.pumpAndSettle();
      expect(state.createRecoveryError, isNotNull);
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Synthetic own'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(OutlinedButton, 'Edit'));
      await tester.pumpAndSettle();
      final save = find.widgetWithText(FilledButton, 'Save');
      await tester.scrollUntilVisible(
        save,
        200,
        scrollable: find
            .descendant(
              of: find.byType(Form),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.tap(save);
      await tester.pumpAndSettle();
      expect(repo.updatedDraft, isNotNull);
      expect(repo.createCalls, 0);
      expect(store.values[scopeA], firstRequest);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'restored unknown request waits for receipt and explicitly retries the same ID',
    (tester) async {
      final auth = await recoveryAuth();
      addTearDown(auth.dispose);
      final store = MemoryVisitorIntents()..values[scopeA] = firstRequest;
      final receipt = Completer<String?>();
      final repo = RecoveryVisitors()
        ..session = auth.sessionToken
        ..receiptResult = (_) => receipt.future;
      final state = VisitorProvider(repository: repo, createIntentStore: store);
      addTearDown(state.dispose);
      state.synchronizeSession(auth);
      await state.refresh();
      await tester.pumpWidget(recoveryApp(state));
      await tester.tap(find.byKey(const Key('visitor-add')));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(
        find.text('Checking the previous visitor request…'),
        findsOneWidget,
      );
      expect(repo.createCalls, 0);
      expect(
        tester.widget<TextFormField>(find.byType(TextFormField).first).enabled,
        isFalse,
      );
      receipt.complete(null);
      await tester.pumpAndSettle();
      expect(state.recoveryRequestId, firstRequest);
      expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField).first)
            .controller
            ?.text,
        isEmpty,
      );
      expect(
        tester.widget<TextFormField>(find.byType(TextFormField).first).enabled,
        isTrue,
      );
      expect(repo.createCalls, 0);
      await tester.enterText(find.byType(TextFormField).at(0), 'Synthetic');
      await tester.enterText(find.byType(TextFormField).at(1), 'Recovery');
      await tester.enterText(
        find.byType(TextFormField).at(3),
        'Synthetic visit',
      );
      tester.testTextInput.hide();
      await tester.pump();
      final retry = find.widgetWithText(FilledButton, 'Retry same request');
      await tester.scrollUntilVisible(
        retry,
        200,
        scrollable: find
            .descendant(
              of: find.byType(Form),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.tap(retry);
      await tester.pumpAndSettle();
      expect(repo.requests, [firstRequest]);
      expect(store.values, isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'receipt found on reopening closes the form without a second mutation',
    (tester) async {
      final auth = await recoveryAuth();
      addTearDown(auth.dispose);
      final store = MemoryVisitorIntents()..values[scopeA] = firstRequest;
      final repo = RecoveryVisitors()
        ..session = auth.sessionToken
        ..receipt = 'existing-visitor';
      final state = VisitorProvider(repository: repo, createIntentStore: store);
      addTearDown(state.dispose);
      state.synchronizeSession(auth);
      await state.refresh();
      await tester.pumpWidget(recoveryApp(state));
      await tester.tap(find.byKey(const Key('visitor-add')));
      await tester.pumpAndSettle();
      expect(
        find.text('The previous visitor record was found.'),
        findsOneWidget,
      );
      expect(find.byType(TextFormField), findsNothing);
      expect(repo.createCalls, 0);
      expect(store.values, isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'storage read error cannot enable a new create and retry preserves the stored ID',
    (tester) async {
      final auth = await recoveryAuth();
      addTearDown(auth.dispose);
      final store = MemoryVisitorIntents()
        ..values[scopeA] = firstRequest
        ..failRead = true;
      final repo = RecoveryVisitors()..session = auth.sessionToken;
      final state = VisitorProvider(repository: repo, createIntentStore: store);
      addTearDown(state.dispose);
      state.synchronizeSession(auth);
      await state.refresh();
      await tester.pumpWidget(recoveryApp(state));
      await tester.tap(find.byKey(const Key('visitor-add')));
      await tester.pumpAndSettle();
      expect(state.createRecoveryStorageFailed, isTrue);
      final save = find.widgetWithText(FilledButton, 'Save');
      final formScroll = find
          .descendant(of: find.byType(Form), matching: find.byType(Scrollable))
          .first; // The outer ListView precedes each text field's Scrollable.
      expect(formScroll, findsOneWidget);
      await tester.scrollUntilVisible(save, 200, scrollable: formScroll);
      expect(tester.widget<FilledButton>(save).onPressed, isNull);
      expect(repo.createCalls, 0);
      store.failRead = false;
      final retry = find.widgetWithText(TextButton, 'Try Again');
      await tester.scrollUntilVisible(retry, -200, scrollable: formScroll);
      await tester.tap(retry);
      await tester.pumpAndSettle();
      expect(state.createRecoveryError, isNull);
      expect(state.recoveryRequestId, firstRequest);
      expect(repo.createCalls, 0);
      expect(store.values[scopeA], firstRequest);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
