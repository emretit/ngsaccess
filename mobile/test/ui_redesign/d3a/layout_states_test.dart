import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:ngsplusapp/providers/attendance_provider.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/request_provider.dart';
import 'package:ngsplusapp/screens/history/history_screen.dart';
import 'package:ngsplusapp/screens/requests/requests_screen.dart';
import 'package:ngsplusapp/widgets/history/history_calendar.dart';
import 'package:ngsplusapp/widgets/history/history_record_tile.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import 'package:provider/provider.dart';

import '../../../screenshot_test/_harness.dart'
    show loadAuditFonts, resolveAuditFontFallbacks;
import '../../auth_fakes.dart';
import '../../helpers/request_fakes.dart'
    show RequestFakeRepository, testLeave;
import '../../helpers/history_fakes.dart'
    show HistoryTestProvider, event, summary;
import '../../helpers/history_request_app.dart';

const output = String.fromEnvironment('AUDIT_OUTPUT_DIR');
Future<void> capture(WidgetTester tester, String name) async {
  expect(tester.takeException(), isNull);
  if (output.isEmpty) return;
  await resolveAuditFontFallbacks(tester);
  await expectLater(
    find.byType(MaterialApp),
    matchesGoldenFile(Uri.file('$output/$name.png')),
  );
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('tr');
    if (output.isNotEmpty) await loadAuditFonts();
  });
  for (final dark in [false, true]) {
    for (final compact in [dark]) {
      final variant =
          '${dark ? 'dark' : 'light'}_${compact ? '320_200' : '390_100'}';
      void viewport(WidgetTester tester) {
        tester.view.physicalSize = Size(compact ? 320 : 390, 844);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
      }

      testWidgets('history records calendar summary filter $variant', (
        tester,
      ) async {
        viewport(tester);
        final provider = HistoryTestProvider()
          ..attendanceRecords = [event(1), event(2)]
          ..deviceFacets = {'door-a': 'Ana Giriş', 'door-b': 'Otopark Turnike'};
        provider.summaries['2026-10-01/2026-10-31'] = summary(
          '2026-10-01',
          '2026-10-31',
          4,
        );
        provider.summaries['2026-10-19/2026-10-25'] = summary(
          '2026-10-19',
          '2026-10-25',
          2,
        );
        addTearDown(provider.dispose);
        await tester.pumpWidget(
          ChangeNotifierProvider<AttendanceProvider>.value(
            value: provider,
            child: app(
              HistoryScreen(now: () => DateTime.utc(2026, 10, 21)),
              dark: dark,
              scale: compact ? 2 : 1,
            ),
          ),
        );
        await tester.pumpAndSettle();
        // The day's two records share a single neutral group.
        expect(find.byType(AppListGroup), findsOneWidget);
        expect(find.byType(HistoryRecordTile), findsNWidgets(2));
        expect(find.byType(Card), findsNothing);
        expect(
          tester.getSize(find.byKey(const ValueKey('event-1'))).height,
          greaterThanOrEqualTo(64),
        );
        await capture(tester, 'd3a_history_$variant');
        if (!compact) {
          await tester.tap(find.byKey(const ValueKey('event-1')));
          await tester.pumpAndSettle();
          expect(find.text('Kayıt ayrıntısı'), findsOneWidget);
          expect(find.byType(CircularProgressIndicator), findsNothing);
          await capture(tester, 'd3a_history_detail_$variant');
          await tester.tap(find.byTooltip('Kapat'));
          await tester.pumpAndSettle();
        }
        await tester.ensureVisible(find.text('Takvim'));
        await tester.tap(find.text('Takvim'));
        await tester.pumpAndSettle();
        expect(find.byType(HistoryCalendar), findsOneWidget);
        final day = find.byKey(const ValueKey('history-day-2026-10-19'));
        await tester.ensureVisible(day);
        await tester.pumpAndSettle();
        final size = tester.getSize(day);
        expect(size.width, greaterThanOrEqualTo(48));
        expect(size.height, greaterThanOrEqualTo(48));
        if (compact) {
          expect(tester.widget(day), isA<AppListRow>());
        }
        await capture(tester, 'd3a_history_calendar_$variant');
        await tester.ensureVisible(find.text('Özet'));
        await tester.tap(find.text('Özet'));
        await tester.pumpAndSettle();
        expect(find.byType(AppMetricRow), findsOneWidget);
        await capture(tester, 'd3a_history_summary_$variant');
        await tester.ensureVisible(find.text('Kayıtlar'));
        await tester.tap(find.text('Kayıtlar'));
        await tester.pumpAndSettle();
        final before = provider.filters.length;
        await tester.tap(find.byTooltip('Filtrele'));
        await tester.pumpAndSettle();
        final apply = find.byKey(const Key('history-apply-filters'));
        expect(apply.hitTestable(), findsOneWidget);
        expect(tester.getSize(apply).height, greaterThanOrEqualTo(48));
        final door = find.byKey(const ValueKey('history-device-door-a'));
        await tester.scrollUntilVisible(
          door,
          120,
          scrollable: find
              .descendant(
                of: find.byType(ListView).last,
                matching: find.byType(Scrollable),
              )
              .first,
        );
        await tester.pumpAndSettle();
        await tester.tap(door);
        await tester.pumpAndSettle();
        expect(provider.filters.length, before);
        expect(tester.widget<AppListRow>(door).selected, isTrue);
        await capture(tester, 'd3a_history_filter_$variant');
        await tester.tap(find.byTooltip('Kapat'));
        await tester.pumpAndSettle();
        expect(provider.filters.length, before);
      });
      for (final leave in [true, false]) {
        testWidgets('${leave ? 'leave' : 'correction'} form $variant', (
          tester,
        ) async {
          viewport(tester);
          final auth = AuthProvider(
            repository: FakeAuthRepository(),
            sessionStore: FakeSessionStore(),
          );
          await auth.bootstrap();
          await auth.signIn('fixture', 'password');
          final provider = RequestProvider(repository: RequestFakeRepository())
            ..synchronizeSession(auth);
          addTearDown(provider.dispose);
          addTearDown(auth.dispose);
          await tester.pumpWidget(
            ChangeNotifierProvider<RequestProvider>.value(
              value: provider,
              child: app(
                RequestFormScreen(isLeave: leave),
                dark: dark,
                scale: compact ? 2 : 1,
              ),
            ),
          );
          await tester.pumpAndSettle();
          if (!leave) {
            final time = find.byKey(const Key('request-check-in-time'));
            await tester.scrollUntilVisible(
              time,
              150,
              scrollable: find
                  .descendant(
                    of: find.byType(ListView).last,
                    matching: find.byType(Scrollable),
                  )
                  .first,
            );
            await tester.pumpAndSettle();
            await tester.tap(time);
            await tester.pumpAndSettle();
            await tester.tap(find.text('Tamam'));
            await tester.pumpAndSettle();
          }
          final field = find.byKey(
            Key(leave ? 'request-notes' : 'request-reason'),
          );
          await tester.scrollUntilVisible(
            field,
            150,
            scrollable: find
                .descendant(
                  of: find.byType(ListView).last,
                  matching: find.byType(Scrollable),
                )
                .first,
          );
          await tester.pumpAndSettle();
          await tester.enterText(
            find.descendant(of: field, matching: find.byType(TextField)),
            leave
                ? 'Aile ziyareti için yıllık izin talebi.'
                : 'Kartımı okutmama rağmen giriş saatim görünmüyor.',
          );
          tester.testTextInput.hide();
          FocusManager.instance.primaryFocus?.unfocus();
          await tester.pumpAndSettle();
          final formScroll = tester.state<ScrollableState>(
            find
                .descendant(
                  of: find.byType(ListView).last,
                  matching: find.byType(Scrollable),
                )
                .first,
          );
          formScroll.position.jumpTo(0);
          await tester.pumpAndSettle();
          final submit = find.byKey(const Key('request-submit'));
          expect(submit.hitTestable(), findsOneWidget);
          expect(tester.getSize(submit).height, greaterThanOrEqualTo(48));
          await capture(
            tester,
            'd3a_${leave ? 'leave' : 'correction'}_filled_$variant',
          );
        });
      }
      testWidgets('requests and withdraw $variant', (tester) async {
        viewport(tester);
        final auth = AuthProvider(
          repository: FakeAuthRepository(),
          sessionStore: FakeSessionStore(),
        );
        await auth.bootstrap();
        await auth.signIn('fixture', 'password');
        final repo = RequestFakeRepository()..leaves = [testLeave()];
        final provider = RequestProvider(repository: repo)
          ..synchronizeSession(auth);
        addTearDown(provider.dispose);
        addTearDown(auth.dispose);
        await tester.pumpWidget(
          ChangeNotifierProvider<RequestProvider>.value(
            value: provider,
            child: app(
              const RequestsScreen(),
              dark: dark,
              scale: compact ? 2 : 1,
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.byType(AppPrimaryButton), findsOneWidget);
        expect(find.textContaining('2026-'), findsNothing);
        await capture(tester, 'd3a_requests_leave_$variant');
        final withdraw = find.widgetWithText(OutlinedButton, 'Talebi geri çek');
        await tester.scrollUntilVisible(
          withdraw,
          100,
          scrollable: find
              .descendant(
                of: find.byType(ListView).last,
                matching: find.byType(Scrollable),
              )
              .first,
        );
        await tester.pumpAndSettle();
        expect(withdraw.hitTestable(), findsOneWidget);
        await tester.tap(withdraw);
        await tester.pumpAndSettle();
        expect(find.byType(AppDialog), findsOneWidget);
        expect(
          find.descendant(
            of: find.byType(AppDialog),
            matching: find.byType(AppPrimaryButton),
          ),
          findsNothing,
        );
        await capture(tester, 'd3a_request_withdraw_$variant');
        await tester.tap(find.text('Vazgeç'));
        await tester.pumpAndSettle();
        expect(repo.withdrawals, 0);
      });
    }
  }
}
