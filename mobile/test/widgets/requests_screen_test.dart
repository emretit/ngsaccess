import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/attendance_date.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/request_provider.dart';
import 'package:ngsplusapp/screens/requests/requests_screen.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import 'package:provider/provider.dart';

import '../auth_fakes.dart';
import '../helpers/request_fakes.dart'
    show RequestFakeRepository, testLeave, testCorrection;

import '../helpers/history_request_app.dart' show app;

void main() {
  group('request screens', () {
    late RequestFakeRepository repo;
    late AuthProvider auth;
    late RequestProvider p;
    setUp(() async {
      auth = AuthProvider(
        repository: FakeAuthRepository(),
        sessionStore: FakeSessionStore(),
      );
      await auth.bootstrap();
      await auth.signIn('test', 'password');
      repo = RequestFakeRepository();
      p = RequestProvider(repository: repo)..synchronizeSession(auth);
    });
    tearDown(() {
      p.dispose();
      auth.dispose();
    });
    Future<void> mount(
      WidgetTester tester, {
      Widget child = const RequestsScreen(),
    }) async {
      await tester.pumpWidget(
        ChangeNotifierProvider<RequestProvider>.value(
          value: p,
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            locale: const Locale('tr'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: child,
          ),
        ),
      );
      await tester.pump();
    }

    for (final failure in <AppError>[
      const ServerError(statusCode: 503),
      const ProtocolError(),
    ]) {
      testWidgets(
        'uncertain ${failure.runtimeType} submit refreshes once and shows uncertainty',
        (tester) async {
          repo.failure = failure;
          await mount(tester);
          await tester.pumpAndSettle();
          await tester.tap(find.text('Yeni talep'));
          await tester.pumpAndSettle();
          await tester.tap(find.byKey(const Key('request-submit')));
          await tester.pumpAndSettle();
          expect(repo.submits, 1);
          expect(repo.reads, 2);
          expect(
            find.text('Talep gönderilmiş olabilir; listeyi kontrol edin.'),
            findsOneWidget,
          );
          expect(find.byType(RequestFormScreen), findsNothing);
        },
      );
      testWidgets(
        'uncertain ${failure.runtimeType} withdraw refreshes once and shows uncertainty',
        (tester) async {
          repo.leaves = [testLeave()];
          repo.withdrawFailure = failure;
          await mount(tester);
          await tester.pumpAndSettle();
          await tester.tap(
            find.widgetWithText(OutlinedButton, 'Talebi geri çek'),
          );
          await tester.pumpAndSettle();
          await tester.tap(
            find.descendant(
              of: find.byType(AppDialog),
              matching: find.widgetWithText(OutlinedButton, 'Talebi geri çek'),
            ),
          );
          await tester.pumpAndSettle();
          expect(repo.withdrawals, 1);
          expect(repo.reads, 2);
          expect(
            find.text('Talep geri çekilmiş olabilir; listeyi kontrol edin.'),
            findsOneWidget,
          );
        },
      );
    }
    testWidgets(
      'stale withdraw callback during busy recovery never repeats the previous error snackbar',
      (tester) async {
        repo.leaves = [testLeave()];
        repo.withdrawFailure = const NetworkError();
        await mount(tester);
        await tester.pumpAndSettle();
        final staleAction = tester
            .widget<OutlinedButton>(
              find.widgetWithText(OutlinedButton, 'Talebi geri çek'),
            )
            .onPressed;
        await tester.tap(
          find.widgetWithText(OutlinedButton, 'Talebi geri çek'),
        );
        await tester.pumpAndSettle();
        repo.listGate = Completer();
        await tester.tap(
          find.descendant(
            of: find.byType(AppDialog),
            matching: find.widgetWithText(OutlinedButton, 'Talebi geri çek'),
          ),
        );
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 500));
        expect(p.busy, true);
        expect(p.commandError, isA<NetworkError>());
        staleAction?.call();
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 500));
        await tester.tap(
          find.descendant(
            of: find.byType(AppDialog),
            matching: find.widgetWithText(OutlinedButton, 'Talebi geri çek'),
          ),
        );
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 500));
        expect(p.commandError, isNull);
        expect(find.byType(SnackBar), findsNothing);
        expect(repo.withdrawals, 1);
        repo.listGate?.complete([]);
        await tester.pumpAndSettle();
        expect(
          find.text('Talep geri çekilmiş olabilir; listeyi kontrol edin.'),
          findsOneWidget,
        );
      },
    );
    testWidgets(
      'leave range picker preserves ordered dates and last-30-day lower bound',
      (tester) async {
        await mount(tester, child: const RequestFormScreen(isLeave: true));
        await tester.pumpAndSettle();
        final today = AttendanceDate.parseDay(
          AttendanceDate.instantKey(DateTime.now()),
        );
        await tester.tap(find.byType(AppDateRangeField));
        await tester.pumpAndSettle();
        final picker = tester.widget<DateRangePickerDialog>(
          find.byType(DateRangePickerDialog),
        );
        expect(
          AttendanceDate.calendarKey(picker.firstDate),
          AttendanceDate.calendarKey(today.subtract(const Duration(days: 30))),
        );
        expect(picker.initialDateRange?.start, picker.initialDateRange?.end);
        expect(picker.lastDate, DateTime(today.year + 10, 12, 31));
        await tester.tap(find.byTooltip('Kapat'));
        await tester.pumpAndSettle();
        final field = tester.widget<AppDateRangeField>(
          find.byType(AppDateRangeField),
        );
        final target = today.add(const Duration(days: 3));
        field.onChanged?.call(
          DateTimeRange(
            start: target,
            end: target.add(const Duration(days: 1)),
          ),
        );
        await tester.pumpAndSettle();
        final updated = tester.widget<AppDateRangeField>(
          find.byType(AppDateRangeField),
        );
        expect(updated.value?.start, target);
        expect(updated.value?.end, target.add(const Duration(days: 1)));
      },
    );
    testWidgets('pull to refresh performs one refresh without polling', (
      tester,
    ) async {
      await mount(tester);
      await tester.pumpAndSettle();
      expect(repo.reads, 1);
      await tester.drag(find.byType(ListView).first, const Offset(0, 350));
      await tester.pumpAndSettle();
      expect(repo.reads, 2);
      await tester.pump(const Duration(minutes: 2));
      expect(repo.reads, 2);
    });
    testWidgets('loading, empty, localized error and retry', (tester) async {
      repo.listGate = Completer();
      await mount(tester);
      expect(find.byType(AppSkeleton), findsOneWidget);
      repo.listGate?.complete([]);
      await tester.pumpAndSettle();
      expect(find.text('Henüz talebiniz yok.'), findsOneWidget);
      repo.listGate = null;
      repo.readFailure = const NetworkError('unsafe');
      await p.refresh();
      await tester.pumpAndSettle();
      expect(find.textContaining('İnternet bağlantısı'), findsOneWidget);
      repo.readFailure = null;
      await tester.tap(find.text('Yeniden dene'));
      await tester.pumpAndSettle();
      expect(p.error, isNull);
    });
    testWidgets(
      'known/unknown labels, decision notes, admin rows and withdraw confirmation refresh',
      (tester) async {
        repo.leaves = [
          testLeave(decision: 'Yönetici kararı'),
          testLeave(
            id: 'admin',
            source: 'admin',
            status: 'rejected',
            decision: 'Uygun değil',
          ),
          testLeave(id: 'future', status: 'future', type: 'future'),
        ];
        repo.corrections = [testCorrection(status: 'withdrawn')];
        await mount(tester);
        await tester.pumpAndSettle();
        expect(find.text('Bekliyor'), findsOneWidget);
        expect(find.text('Reddedildi'), findsOneWidget);
        await tester.scrollUntilVisible(
          find.text('Bilinmiyor'),
          150,
          scrollable: find.byType(Scrollable).last,
        );
        expect(find.text('Bilinmiyor'), findsOneWidget);
        expect(find.text('Diğer'), findsOneWidget);
        await tester.scrollUntilVisible(
          find.text('Yönetici kaydı'),
          -150,
          scrollable: find.byType(Scrollable).last,
        );
        expect(find.text('Yönetici kaydı'), findsOneWidget);
        expect(find.textContaining('Uygun değil'), findsOneWidget);
        expect(
          find.widgetWithText(OutlinedButton, 'Talebi geri çek'),
          findsOneWidget,
        );
        await tester.tap(
          find.widgetWithText(OutlinedButton, 'Talebi geri çek'),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text('Vazgeç'));
        await tester.pumpAndSettle();
        expect(repo.withdrawals, 0);
        await tester.tap(
          find.widgetWithText(OutlinedButton, 'Talebi geri çek'),
        );
        await tester.pumpAndSettle();
        await tester.tap(
          find.descendant(
            of: find.byType(AppDialog),
            matching: find.widgetWithText(OutlinedButton, 'Talebi geri çek'),
          ),
        );
        await tester.pumpAndSettle();
        expect(repo.withdrawals, 1);
        expect(find.text('Henüz talebiniz yok.'), findsOneWidget);
        await tester.tap(find.text('Kayıt düzeltme'));
        await tester.pumpAndSettle();
        expect(find.text('Geri çekildi'), findsOneWidget);
        expect(
          find.widgetWithText(OutlinedButton, 'Talebi geri çek'),
          findsNothing,
        );
      },
    );
    testWidgets('pending correction can be withdrawn and refreshes', (
      tester,
    ) async {
      repo.corrections = [testCorrection()];
      await mount(tester);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kayıt düzeltme'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(OutlinedButton, 'Talebi geri çek'));
      await tester.pumpAndSettle();
      await tester.tap(
        find.descendant(
          of: find.byType(AppDialog),
          matching: find.widgetWithText(OutlinedButton, 'Talebi geri çek'),
        ),
      );
      await tester.pumpAndSettle();
      expect(repo.withdrawals, 1);
      expect(find.text('Henüz talebiniz yok.'), findsOneWidget);
    });
    testWidgets('new leave opens form, sends once while locked and refreshes', (
      tester,
    ) async {
      await mount(tester);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Yeni talep'));
      await tester.pumpAndSettle();
      expect(find.byType(RequestFormScreen), findsOneWidget);
      expect(find.text('Yıllık izin'), findsOneWidget);
      repo.gate = Completer();
      await tester.tap(find.byKey(const Key('request-submit')));
      await tester.pump();
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );
      expect(repo.submits, 1);
      repo.gate?.complete('id');
      await tester.pumpAndSettle();
      expect(find.byType(RequestFormScreen), findsNothing);
      expect(repo.reads, 2);
    });
    testWidgets(
      'correction form validates reason and missing time without sending',
      (tester) async {
        await mount(tester, child: const RequestFormScreen(isLeave: false));
        await tester.tap(find.byKey(const Key('request-submit')));
        await tester.pumpAndSettle();
        final reason = tester.widget<AppTextField>(
          find.byKey(const Key('request-reason')),
        );
        expect(reason.focusNode?.hasFocus, isTrue);
        expect(reason.errorText, 'Gerekçe 5–300 karakter olmalı');
        expect(find.text('Gerekçe 5–300 karakter olmalı'), findsOneWidget);
        expect(repo.submits, 0);
        await tester.enterText(find.byType(TextField), 'Gerekçe yeterli');
        await tester.tap(find.byKey(const Key('request-submit')));
        await tester.pumpAndSettle();
        final time = tester.widget<AppTimeField>(
          find.byKey(const Key('request-check-in-time')),
        );
        expect(time.focusNode?.hasFocus, isTrue);
        expect(
          time.errorText,
          'Düzeltme türüne uygun giriş ve çıkış saatlerini belirtin',
        );
        expect(
          find.text('Düzeltme türüne uygun giriş ve çıkış saatlerini belirtin'),
          findsOneWidget,
        );
        expect(repo.submits, 0);
        await tester.tap(find.byKey(const Key('request-check-in-time')));
        await tester.pumpAndSettle();
        expect(find.byType(TimePickerDialog), findsOneWidget);
        await tester.tap(find.text('Tamam'));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('request-submit')));
        await tester.pumpAndSettle();
        expect(repo.submits, 1);
      },
    );
    testWidgets(
      'uncertain network submit refreshes and displays check-list message with no retry',
      (tester) async {
        repo.failure = const TimeoutError();
        await mount(tester);
        await tester.pumpAndSettle();
        await tester.tap(find.text('Yeni talep'));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('request-submit')));
        await tester.pumpAndSettle();
        expect(repo.submits, 1);
        expect(repo.reads, 2);
        expect(
          find.text('Talep gönderilmiş olabilir; listeyi kontrol edin.'),
          findsOneWidget,
        );
        expect(find.byType(RequestFormScreen), findsNothing);
      },
    );
    testWidgets(
      'correction date picker restricts dates to Istanbul last 30 days',
      (tester) async {
        await mount(tester, child: const RequestFormScreen(isLeave: false));
        await tester.tap(find.byType(AppDateField));
        await tester.pumpAndSettle();
        final picker = tester.widget<DatePickerDialog>(
          find.byType(DatePickerDialog),
        );
        final today = AttendanceDate.parseDay(
          AttendanceDate.instantKey(DateTime.now()),
        );
        expect(
          AttendanceDate.calendarKey(picker.lastDate),
          AttendanceDate.calendarKey(today),
        );
        expect(
          AttendanceDate.calendarKey(picker.firstDate),
          AttendanceDate.calendarKey(today.subtract(const Duration(days: 30))),
        );
      },
    );
  });
  group('request route lifecycle regressions', () {
    late AuthProvider auth;
    late RequestProvider provider;
    late RequestFakeRepository repo;
    setUp(() async {
      auth = AuthProvider(
        repository: FakeAuthRepository(),
        sessionStore: FakeSessionStore(),
      );
      await auth.bootstrap();
      await auth.signIn('fixture', 'password');
      repo = RequestFakeRepository();
      provider = RequestProvider(repository: repo)..synchronizeSession(auth);
    });
    tearDown(() {
      provider.dispose();
      auth.dispose();
    });
    Future<void> mount(WidgetTester tester, Widget child) async {
      await tester.pumpWidget(
        ChangeNotifierProvider<RequestProvider>.value(
          value: provider,
          child: app(child, dark: false, scale: 1),
        ),
      );
      await tester.pumpAndSettle();
    }

    testWidgets(
      'busy form blocks back and duplicate callbacks until result reaches list',
      (tester) async {
        await mount(tester, const RequestsScreen());
        await tester.tap(find.text('Yeni talep'));
        await tester.pumpAndSettle();
        final submit = tester
            .widget<AppPrimaryButton>(find.byKey(const Key('request-submit')))
            .onPressed;
        repo.gate = Completer();
        submit?.call();
        submit?.call();
        await tester.pump();
        final form = find.byType(RequestFormScreen);
        expect(repo.submits, 1);
        expect(
          tester
              .widget<AppTextField>(find.byKey(const Key('request-notes')))
              .enabled,
          isFalse,
        );
        expect(
          tester
              .widget<AppPrimaryButton>(find.byKey(const Key('request-submit')))
              .busy,
          isTrue,
        );
        await Navigator.of(tester.element(form)).maybePop();
        await tester.pump();
        expect(form, findsOneWidget);
        repo.gate?.complete('id');
        await tester.pumpAndSettle();
        expect(form, findsNothing);
        expect(find.text('İzin talebi gönderildi'), findsOneWidget);
        expect(repo.submits, 1);
      },
    );
    testWidgets(
      'covered form removes itself after success without popping or notifying another route',
      (tester) async {
        await mount(tester, const RequestsScreen());
        await tester.tap(find.text('Yeni talep'));
        await tester.pumpAndSettle();
        repo.gate = Completer();
        await tester.tap(find.byKey(const Key('request-submit')));
        await tester.pump();
        final navigator = Navigator.of(
          tester.element(find.byType(RequestFormScreen)),
        );
        unawaited(
          navigator.push<void>(
            MaterialPageRoute(
              builder: (_) => const Scaffold(body: Text('Other route')),
            ),
          ),
        );
        await tester.pumpAndSettle();
        repo.gate?.complete('id');
        await tester.pumpAndSettle();
        expect(find.text('Other route'), findsOneWidget);
        expect(find.byType(SnackBar), findsNothing);
        expect(repo.submits, 1);
        navigator.pop();
        await tester.pumpAndSettle();
        expect(find.byType(RequestFormScreen), findsNothing);
        expect(find.byType(RequestsScreen), findsOneWidget);
        expect(find.byType(SnackBar), findsNothing);
        expect(repo.submits, 1);
      },
    );
  });
}
