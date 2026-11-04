import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/models/visitor.dart';
import 'package:ngsplusapp/providers/visitor_provider.dart';
import 'package:ngsplusapp/screens/visitor/visitor_form_screen.dart';
import 'package:ngsplusapp/screens/visitor/visitor_screen.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import 'package:ngsplusapp/widgets/visitor/visitor_cards.dart';
import 'package:ngsplusapp/widgets/visitor/visitor_detail.dart';
import 'package:provider/provider.dart';

import '../../visitor_provider_test.dart'
    show FakeVisitorRepository, visitorPage;
import '../../../screenshot_test/_harness.dart'
    show captureKey, loadAuditFonts, saveCapture;

const _capture = bool.fromEnvironment('D3B_CAPTURE');
final _now = DateTime.utc(2030, 1, 1, 6);
final _visitor = Visitor(
  id: 'layout',
  firstName: 'İpek',
  lastName: 'Şahin',
  visitStart: _now,
  visitEnd: _now.add(const Duration(hours: 2)),
  status: VisitorAccessStatus.preRegistered,
  canEdit: true,
  purpose: 'Proje görüşmesi',
  phone: '0532 123 45 67',
  notes: 'Toplantı salonunda görüşme.',
  syncStatus: VisitorSyncStatus.applied,
);

Widget _app(VisitorProvider state, ThemeMode theme, double scale) =>
    ChangeNotifierProvider.value(
      value: state,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: theme,
        locale: const Locale('tr'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => RepaintBoundary(
          key: captureKey,
          child: MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(scale)),
            child: child ?? const SizedBox.shrink(),
          ),
        ),
        home: const VisitorScreen(),
      ),
    );

Future<void> _shot(WidgetTester tester, String name) async {
  if (_capture) await saveCapture(tester, 'd3b_$name');
}

Future<void> _reveal(
  WidgetTester tester,
  Finder target, {
  bool form = false,
  double delta = 180,
}) async {
  final scope = form ? find.byType(Form) : find.byType(VisitorScreen);
  await tester.scrollUntilVisible(
    target,
    delta,
    scrollable: find
        .descendant(of: scope, matching: find.byType(Scrollable))
        .first,
  );
  await tester.pumpAndSettle();
}

void _minTap(WidgetTester tester, Finder finder) {
  final size = tester.getSize(finder);
  expect(size.width, greaterThanOrEqualTo(48));
  expect(size.height, greaterThanOrEqualTo(48));
}

void main() {
  if (_capture) setUpAll(loadAuditFonts);
  for (final mode in [ThemeMode.light, ThemeMode.dark]) {
    for (final size in [(390.0, 1.0), (320.0, 2.0)]) {
      testWidgets('list/form/detail $mode ${size.$1}dp ${size.$2 * 100}%', (
        tester,
      ) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = Size(size.$1, 844);
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.view.resetViewInsets);
        final repo = FakeVisitorRepository();
        repo.listResult = () async => visitorPage([_visitor]);
        repo.detailResult = (_) async => _visitor;
        repo.summaryResult = () async => const VisitorSummary(
          total: 1,
          counts: {VisitorAccessStatus.preRegistered: 1},
          overflow: false,
        );
        final state = VisitorProvider(repository: repo);
        addTearDown(state.dispose);
        await state.refresh();
        await tester.pumpWidget(_app(state, mode, size.$2));
        await tester.pumpAndSettle();
        final suffix = '${mode.name}_${size.$1.toInt()}';
        expect(find.byKey(const Key('visitor-add')), findsOneWidget);
        expect(find.byType(AppMetricRow), findsOneWidget);
        _minTap(tester, find.byKey(const Key('visitor-add')));
        await _shot(tester, 'list_$suffix');
        await _reveal(tester, find.byType(VisitorRecordCard));
        _minTap(tester, find.byType(VisitorRecordCard));
        await tester.tap(find.byType(VisitorRecordCard));
        await tester.pumpAndSettle();
        expect(find.byType(AppSheet), findsOneWidget);
        expect(
          find.descendant(
            of: find.byType(VisitorDetail),
            matching: find.text('Fiziksel konum bilinmiyor'),
          ),
          findsOneWidget,
        );
        // Device applied status must never imply that the visitor is inside.
        expect(
          find.descendant(
            of: find.byType(VisitorDetail),
            matching: find.text('Son kayda göre içeride'),
          ),
          findsNothing,
        );
        await _shot(tester, 'detail_$suffix');
        final cancel = find.descendant(
          of: find.byType(VisitorDetail),
          matching: find.widgetWithText(OutlinedButton, 'Daveti iptal et'),
        );
        await tester.ensureVisible(cancel);
        await tester.pumpAndSettle();
        _minTap(tester, cancel);
        await tester.tap(cancel);
        await tester.pumpAndSettle();
        expect(find.byType(AppDialog), findsOneWidget);
        await _shot(tester, 'cancel_$suffix');
        await tester.tap(
          find.descendant(
            of: find.byType(AppDialog),
            matching: find.widgetWithText(OutlinedButton, 'Vazgeç'),
          ),
        );
        await tester.pumpAndSettle();
        expect(repo.cancelCalls, 0);
        await tester.tap(find.byTooltip('Kapat'));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('visitor-add')));
        await tester.pumpAndSettle();
        expect(find.byType(VisitorFormScreen), findsOneWidget);
        final save = find.widgetWithText(FilledButton, 'Daveti kaydet');
        expect(save.hitTestable(), findsOneWidget);
        _minTap(tester, save);
        final first = find.widgetWithText(TextFormField, 'Ad *');
        await tester.enterText(first, 'İpek');
        await tester.enterText(
          find.widgetWithText(TextFormField, 'Soyad *'),
          'Şahin',
        );
        await tester.enterText(
          find.widgetWithText(TextFormField, 'Telefon'),
          '0532 123 45 67',
        );
        final purpose = find.widgetWithText(TextFormField, 'Ziyaret Amacı *');
        await _reveal(tester, purpose, form: true);
        await tester.enterText(purpose, 'Proje görüşmesi');
        await tester.enterText(
          find.widgetWithText(TextFormField, 'Notlar'),
          'Toplantı salonunda görüşme.',
        );
        tester.testTextInput.hide();
        await tester.pumpAndSettle();
        final date = find.byKey(const Key('visitor-start-date'));
        await _reveal(tester, date, form: true);
        _minTap(tester, date);
        _minTap(tester, find.byKey(const Key('visitor-start-time')));
        await _shot(tester, 'form_dates_$suffix');
        await _reveal(tester, first, form: true, delta: -180);
        await _shot(tester, 'form_$suffix');
        final notes = find.widgetWithText(TextFormField, 'Notlar');
        await _reveal(tester, notes, form: true);
        await tester.tap(notes);
        tester.view.viewInsets = const FakeViewPadding(bottom: 280);
        await tester.pumpAndSettle();
        expect(save.hitTestable(), findsOneWidget);
        final footer = tester.getRect(find.byType(AppFormActionBar));
        expect(footer.bottom, closeTo(844 - 280, 0.1));
        expect(tester.getRect(save).bottom, lessThanOrEqualTo(footer.bottom));
        await _shot(tester, 'keyboard_$suffix');
        expect(tester.takeException(), isNull);
        expect(repo.createCalls, 0);
        await tester.pumpWidget(const SizedBox.shrink());
      });
    }
  }

  testWidgets('summary/list loading and cached errors stay independent', (
    tester,
  ) async {
    final summary = Completer<VisitorSummary>();
    final list = Completer<VisitorPage>();
    final repo = FakeVisitorRepository();
    repo.summaryResult = () => summary.future;
    repo.listResult = () => list.future;
    final state = VisitorProvider(repository: repo);
    addTearDown(state.dispose);
    final refresh = state.refresh();
    await tester.pumpWidget(_app(state, ThemeMode.light, 1));
    await tester.pump();
    expect(find.byType(AppSkeleton), findsNWidgets(2));
    list.complete(visitorPage([_visitor]));
    await tester.pump();
    expect(state.summaryLoading, isTrue);
    await _reveal(tester, find.byType(VisitorRecordCard));
    expect(find.byType(VisitorRecordCard), findsOneWidget);
    summary.complete(
      const VisitorSummary(total: 1, counts: {}, overflow: false),
    );
    await refresh;
    repo.listResult = () => Future.error(const NetworkError());
    repo.summaryResult = () => Future.error(const NetworkError());
    await state.refresh();
    await tester.pumpAndSettle();
    expect(
      find.text('Davetler yenilenemedi. Önceki davetler gösteriliyor.'),
      findsOneWidget,
    );
    await _reveal(tester, find.byType(VisitorRecordCard));
    expect(find.byType(VisitorRecordCard), findsOneWidget);
    expect(state.summary?.total, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('cancel confirm locks repeat taps until the request completes', (
    tester,
  ) async {
    final pending = Completer<bool>();
    final repo = FakeVisitorRepository();
    repo.listResult = () async => visitorPage([_visitor]);
    repo.detailResult = (_) async => _visitor;
    repo.cancelResult = (_) => pending.future;
    final state = VisitorProvider(repository: repo);
    addTearDown(state.dispose);
    await state.refresh();
    await tester.pumpWidget(_app(state, ThemeMode.light, 1));
    await _reveal(tester, find.byType(VisitorRecordCard));
    await tester.tap(find.byType(VisitorRecordCard));
    await tester.pumpAndSettle();
    final cancel = find.descendant(
      of: find.byType(VisitorDetail),
      matching: find.widgetWithText(OutlinedButton, 'Daveti iptal et'),
    );
    await tester.tap(cancel);
    await tester.pumpAndSettle();
    final confirm = find.descendant(
      of: find.byType(AppDialog),
      matching: find.widgetWithText(OutlinedButton, 'Daveti iptal et'),
    );
    final repeatedCallback = tester
        .widget<AppDialog>(find.byType(AppDialog))
        .onConfirm;
    await tester.tap(confirm);
    repeatedCallback?.call();
    await tester.pump(const Duration(seconds: 1));
    expect(repo.cancelCalls, 1);
    expect(find.byType(VisitorDetail), findsOneWidget);
    expect(tester.widget<OutlinedButton>(cancel).onPressed, isNull);
    expect(find.text('Davet iptal edildi.'), findsNothing);
    pending.complete(true);
    await tester.pumpAndSettle();
    expect(repo.cancelCalls, 1);
    expect(find.text('Davet iptal edildi.'), findsOneWidget);
    expect(find.byType(VisitorDetail), findsNothing);
  });
  testWidgets(
    'empty, filtered empty and initial failure use invitation wording',
    (tester) async {
      final repo = FakeVisitorRepository();
      final state = VisitorProvider(repository: repo);
      addTearDown(state.dispose);
      await state.refresh();
      await tester.pumpWidget(_app(state, ThemeMode.light, 1));
      await tester.pumpAndSettle();
      expect(find.text('Henüz davet yok'), findsOneWidget);
      expect(find.byKey(const Key('visitor-add')), findsOneWidget);
      await _shot(tester, 'empty');
      state.setFilters(status: VisitorAccessStatus.active);
      await tester.pumpAndSettle();
      expect(find.text('Eşleşen davet yok'), findsOneWidget);
      expect(find.text('Henüz davet yok'), findsNothing);
      await _shot(tester, 'filtered_empty');
      await tester.pumpWidget(const SizedBox.shrink());
      final failingRepo = FakeVisitorRepository();
      failingRepo.listResult = () => Future.error(const NetworkError());
      final failing = VisitorProvider(repository: failingRepo);
      addTearDown(failing.dispose);
      await failing.refresh();
      await tester.pumpWidget(_app(failing, ThemeMode.light, 1));
      await tester.pumpAndSettle();
      expect(find.text('Davetler alınamadı. Yeniden deneyin.'), findsOneWidget);
      expect(find.text('Henüz davet yok'), findsNothing);
      await _shot(tester, 'error');
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('saving from the bottom still validates every required field', (
    tester,
  ) async {
    final repo = FakeVisitorRepository();
    final state = VisitorProvider(repository: repo);
    addTearDown(state.dispose);
    await state.refresh();
    await tester.pumpWidget(_app(state, ThemeMode.light, 1));
    await tester.tap(find.byKey(const Key('visitor-add')));
    await tester.pumpAndSettle();
    await _reveal(
      tester,
      find.text(
        'Davet kaydı oluşturulduktan sonra yetkili aktivasyonu gerekir.',
      ),
      form: true,
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Daveti kaydet'));
    await tester.pumpAndSettle();
    expect(repo.createCalls, 0);
    expect(find.byType(VisitorFormScreen), findsOneWidget);
    // Three required fields show the message inline; no snackbar covers the
    // save bar.
    expect(find.text('Bu alan zorunlu.'), findsNWidgets(3));
    expect(find.byType(SnackBar), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
