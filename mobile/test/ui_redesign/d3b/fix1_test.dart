import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/models/visitor.dart';
import 'package:ngsplusapp/providers/visitor_provider.dart';
import 'package:ngsplusapp/screens/visitor/visitor_form_screen.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import 'package:ngsplusapp/widgets/visitor/visitor_cards.dart';
import 'package:ngsplusapp/widgets/visitor/visitor_detail.dart';
import 'package:provider/provider.dart';

import '../../visitor_provider_test.dart'
    show FakeVisitorRepository, visitorFixture, visitorPage;
import '../../visitor_widgets_test.dart' show app;

class _NoticeRepository extends FakeVisitorRepository {
  @override
  Future<VisitorNotice> notice() async =>
      const VisitorNotice(url: 'https://example.test/notice', version: 'v3');
}

// Hold delivery after the real provider has cleared selected. This exercises the
// frame between the provider's success notification and the sheet receiving it.
class _DelayedCancelProvider extends VisitorProvider {
  _DelayedCancelProvider(FakeVisitorRepository repository)
    : super(repository: repository);
  final delivered = Completer<void>();
  @override
  Future<bool?> cancel(String id) async {
    final result = await super.cancel(id);
    await delivered.future;
    return result;
  }
}

final _now = DateTime.utc(2030, 1, 1, 6);
Widget _form(VisitorProvider state) => ChangeNotifierProvider.value(
  value: state,
  child: MaterialApp(
    theme: AppTheme.lightTheme,
    locale: const Locale('tr'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: VisitorFormScreen(now: () => _now),
  ),
);

Future<void> _fill(WidgetTester tester, {bool purpose = true}) async {
  await tester.enterText(find.widgetWithText(TextFormField, 'Ad *'), 'İpek');
  await tester.enterText(
    find.widgetWithText(TextFormField, 'Soyad *'),
    'Şahin',
  );
  if (purpose) {
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Ziyaret Amacı *'),
      'Görüşme',
    );
  }
  tester.testTextInput.hide();
  await tester.pumpAndSettle();
}

Future<void> _save(WidgetTester tester) async {
  await tester.tap(find.widgetWithText(FilledButton, 'Daveti kaydet'));
  await tester.pumpAndSettle();
}

void _visible(WidgetTester tester, Finder field) {
  final rect = tester.getRect(field);
  expect(
    rect.top,
    greaterThanOrEqualTo(tester.getRect(find.byType(AppPageHeader)).bottom),
  );
  expect(
    rect.bottom,
    lessThanOrEqualTo(tester.getRect(find.byType(AppFormActionBar)).top),
  );
}

void main() {
  testWidgets('RV3B-01 only missing purpose is focused and visible', (
    tester,
  ) async {
    final repo = FakeVisitorRepository();
    final state = VisitorProvider(repository: repo);
    addTearDown(state.dispose);
    await tester.pumpWidget(_form(state));
    await tester.pumpAndSettle();
    await _fill(tester, purpose: false);
    await _save(tester);
    final purpose = find.widgetWithText(AppTextField, 'Ziyaret Amacı *');
    expect(tester.widget<AppTextField>(purpose).focusNode?.hasFocus, isTrue);
    _visible(tester, purpose);
    expect(repo.createCalls, 0);
  });

  testWidgets(
    'RV3B-01 notice alone shows inline error and focuses the checkbox',
    (tester) async {
      final repo = _NoticeRepository();
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await tester.pumpWidget(_form(state));
      await tester.pumpAndSettle();
      await _fill(tester);
      await _save(tester);
      final checkbox = find.byType(AppCheckboxRow);
      expect(
        tester.widget<AppCheckboxRow>(checkbox).focusNode?.hasFocus,
        isTrue,
      );
      _visible(tester, checkbox);
      final error = find.text('Devam etmek için aydınlatma metnini onaylayın.');
      expect(error.hitTestable(), findsOneWidget);
      expect(repo.createCalls, 0);
    },
  );

  for (final (name, day, time, message, onTime) in [
    (
      'end before start',
      DateTime.utc(2030, 1, 1),
      const TimeOfDay(hour: 8, minute: 0),
      'Bitiş, başlangıçtan sonra olmalı.',
      true,
    ),
    (
      'maximum duration',
      DateTime.utc(2030, 2, 2),
      const TimeOfDay(hour: 10, minute: 0),
      'Ziyaret en fazla 31 gün sürebilir.',
      false,
    ),
    (
      'end in past',
      DateTime.utc(2029, 12, 31),
      const TimeOfDay(hour: 10, minute: 0),
      'Bitiş geçmişte olamaz.',
      false,
    ),
  ]) {
    testWidgets('RV3B-01 $name has a focused inline range error', (
      tester,
    ) async {
      final repo = FakeVisitorRepository();
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await tester.pumpWidget(_form(state));
      await tester.pumpAndSettle();
      await _fill(tester);
      if (name == 'end in past') {
        tester
            .widget<AppDateField>(find.byKey(const Key('visitor-start-date')))
            .onChanged
            ?.call(DateTime.utc(2029, 12, 30));
        await tester.pump();
      }
      tester
          .widget<AppDateField>(find.byKey(const Key('visitor-end-date')))
          .onChanged
          ?.call(day);
      await tester.pump();
      tester
          .widget<AppTimeField>(find.byKey(const Key('visitor-end-time')))
          .onChanged
          ?.call(time);
      await tester.pump();
      await _save(tester);
      final target = find.byKey(
        Key(onTime ? 'visitor-end-time' : 'visitor-end-date'),
      );
      if (onTime) {
        final field = tester.widget<AppTimeField>(target);
        expect(field.errorText, message);
        expect(field.focusNode?.hasFocus, isTrue);
      } else {
        final field = tester.widget<AppDateField>(target);
        expect(field.errorText, message);
        expect(field.focusNode?.hasFocus, isTrue);
      }
      expect(find.text(message).hitTestable(), findsOneWidget);
      _visible(tester, target);
      expect(repo.createCalls, 0);
      expect(
        tester
            .widget<AppTimeField>(find.byKey(const Key('visitor-start-time')))
            .label,
        'Başlangıç saati',
      );
      expect(
        tester
            .widget<AppTimeField>(find.byKey(const Key('visitor-end-time')))
            .label,
        'Bitiş saati',
      );
    });
  }

  testWidgets('RV3B-02 no empty frame during cancel success or pop', (
    tester,
  ) async {
    final repo = FakeVisitorRepository();
    repo.listResult = () async => visitorPage([visitorFixture('own')]);
    final state = _DelayedCancelProvider(repo);
    addTearDown(state.dispose);
    await state.refresh();
    await tester.pumpWidget(app(state));
    await tester.tap(find.text('Synthetic own'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, 'Cancel invitation'));
    await tester.pumpAndSettle();
    await tester.tap(
      find.descendant(
        of: find.byType(AppDialog),
        matching: find.widgetWithText(OutlinedButton, 'Cancel invitation'),
      ),
    );
    await tester.pumpAndSettle();
    expect(state.selected, isNull);
    expect(find.byType(VisitorDetail), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(VisitorDetail),
        matching: find.byType(AppEmptyState),
      ),
      findsNothing,
    );
    expect(
      find.descendant(
        of: find.byType(VisitorDetail),
        matching: find.text('Synthetic own'),
      ),
      findsOneWidget,
    );
    state.delivered.complete();
    for (var i = 0; i < 25; i++) {
      await tester.pump(const Duration(milliseconds: 16));
      expect(
        find.descendant(
          of: find.byType(VisitorDetail),
          matching: find.byType(AppEmptyState),
        ),
        findsNothing,
      );
    }
    expect(find.byType(VisitorDetail), findsNothing);
    expect(repo.cancelCalls, 1);
    expect(find.text('Invitation cancelled.'), findsOneWidget);
  });

  testWidgets(
    'RV3B-05 loading empty has no empty state; refresh does not move rows',
    (tester) async {
      final repo = FakeVisitorRepository();
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await state.refresh();
      await tester.pumpWidget(app(state));
      final pending = Completer<VisitorPage>();
      repo.listResult = () => pending.future;
      final emptyRefresh = state.refresh();
      await tester.pump();
      expect(find.byType(AppEmptyState), findsNothing);
      pending.complete(visitorPage([visitorFixture('own')]));
      await emptyRefresh;
      await tester.pumpAndSettle();
      final before = tester.getTopLeft(find.byType(VisitorRecordCard));
      final next = Completer<VisitorPage>();
      repo.listResult = () => next.future;
      final cachedRefresh = state.refresh();
      await tester.pump();
      expect(tester.getTopLeft(find.byType(VisitorRecordCard)), before);
      expect(find.byType(AppSkeleton), findsNothing);
      next.complete(visitorPage([visitorFixture('own')]));
      await cachedRefresh;
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'RV3B-06/07/12 long notes stay full width at 200% with reachable actions',
    (tester) async {
      tester.view.physicalSize = const Size(320, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final notes = List.filled(100, 'Uzun not. ').join();
      expect(notes.length, 1000);
      final fixture = visitorFixture('long', notes: notes);
      final repo = FakeVisitorRepository();
      repo.listResult = () async => visitorPage([fixture]);
      repo.detailResult = (_) async => fixture;
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await state.refresh();
      await tester.pumpWidget(app(state, textScale: 2));
      expect(find.text('Physical presence unknown'), findsNothing);
      final row = find.byType(VisitorRecordCard);
      await tester.scrollUntilVisible(
        row,
        200,
        scrollable: find
            .descendant(
              of: find.byType(ListView),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(row);
      await tester.pumpAndSettle();
      await tester.tap(row);
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: find.byType(MergeSemantics),
          matching: find.byType(VisitorStatusBadge),
        ),
        findsOneWidget,
      );
      final text = find.text(notes);
      expect(tester.getSize(text).width, greaterThan(220));
      final cancel = find.widgetWithText(OutlinedButton, 'Cancel invitation');
      await tester.scrollUntilVisible(
        cancel,
        500,
        maxScrolls: 60,
        scrollable: find
            .descendant(
              of: find.byType(AppSheet),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.pumpAndSettle();
      expect(cancel.hitTestable(), findsOneWidget);
      expect(tester.getSize(cancel).height, greaterThanOrEqualTo(48));
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('RV3B-02 missing detail uses invitation wording', (tester) async {
    final state = VisitorProvider(repository: FakeVisitorRepository());
    addTearDown(state.dispose);
    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: state,
        child: MaterialApp(
          theme: AppTheme.lightTheme,
          locale: const Locale('tr'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const Scaffold(body: VisitorDetail(visitorId: 'missing')),
        ),
      ),
    );
    expect(find.text('Davet bulunamadı'), findsOneWidget);
    expect(
      find.text('Arama veya durum filtresiyle eşleşen davet bulunamadı.'),
      findsNothing,
    );
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets(
    'RV3B-11 session search reset happens without build side effects',
    (tester) async {
      final repo = FakeVisitorRepository();
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await state.refresh();
      await tester.pumpWidget(app(state));
      await tester.enterText(find.byType(TextField), 'Old account');
      repo.session = 'B';
      state.synchronizeSession();
      await tester.pumpAndSettle();
      expect(
        tester.widget<EditableText>(find.byType(EditableText)).controller.text,
        '',
      );
      expect(tester.takeException(), isNull);
    },
  );
}
