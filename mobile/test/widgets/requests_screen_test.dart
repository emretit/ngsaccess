import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:ngsplusapp/core/attendance_date.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/request_provider.dart';
import 'package:ngsplusapp/screens/requests/requests_screen.dart';
import '../auth_fakes.dart';
import '../providers/request_provider_test.dart'
    show RequestFakeRepository, testLeave, testCorrection;

void main() {
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
        await tester.tap(find.text('Gönder'));
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
        await tester.tap(find.widgetWithText(TextButton, 'Geri çek'));
        await tester.pumpAndSettle();
        await tester.tap(find.widgetWithText(FilledButton, 'Geri çek'));
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
          .widget<TextButton>(find.widgetWithText(TextButton, 'Geri çek'))
          .onPressed;
      await tester.tap(find.widgetWithText(TextButton, 'Geri çek'));
      await tester.pumpAndSettle();
      repo.listGate = Completer();
      await tester.tap(find.widgetWithText(FilledButton, 'Geri çek'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      expect(p.busy, true);
      expect(p.commandError, isA<NetworkError>());
      staleAction?.call();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await tester.tap(find.widgetWithText(FilledButton, 'Geri çek'));
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
    'leave end picker starts at selected start and advancing start raises the end',
    (tester) async {
      await mount(tester, child: const RequestFormScreen(isLeave: true));
      await tester.pumpAndSettle();
      final today = AttendanceDate.parseDay(
        AttendanceDate.instantKey(DateTime.now()),
      );
      final target = today.add(const Duration(days: 3));
      await tester.tap(find.textContaining('Başlangıç tarihi: '));
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.edit_outlined));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.descendant(
          of: find.byType(DatePickerDialog),
          matching: find.byType(TextField),
        ),
        DateFormat.yMd('tr').format(target),
      );
      await tester.tap(find.text('Tamam'));
      await tester.pumpAndSettle();
      expect(
        find.text('Bitiş tarihi: ${AttendanceDate.calendarKey(target)}'),
        findsOneWidget,
      );
      await tester.tap(find.textContaining('Bitiş tarihi: '));
      await tester.pumpAndSettle();
      final picker = tester.widget<DatePickerDialog>(
        find.byType(DatePickerDialog),
      );
      expect(
        AttendanceDate.calendarKey(picker.firstDate),
        AttendanceDate.calendarKey(target),
      );
      expect(
        AttendanceDate.calendarKey(picker.initialDate ?? today),
        AttendanceDate.calendarKey(target),
      );
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
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
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
      expect(find.text('Bilinmiyor'), findsOneWidget);
      expect(find.text('Diğer'), findsOneWidget);
      expect(find.text('Yönetici kaydı'), findsOneWidget);
      expect(find.textContaining('Uygun değil'), findsOneWidget);
      expect(find.widgetWithText(TextButton, 'Geri çek'), findsOneWidget);
      await tester.tap(find.widgetWithText(TextButton, 'Geri çek'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Vazgeç'));
      await tester.pumpAndSettle();
      expect(repo.withdrawals, 0);
      await tester.tap(find.widgetWithText(TextButton, 'Geri çek'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Geri çek'));
      await tester.pumpAndSettle();
      expect(repo.withdrawals, 1);
      expect(find.text('Henüz talebiniz yok.'), findsOneWidget);
      await tester.tap(find.text('PDKS düzeltme'));
      await tester.pumpAndSettle();
      expect(find.text('Geri çekildi'), findsOneWidget);
      expect(find.widgetWithText(TextButton, 'Geri çek'), findsNothing);
    },
  );
  testWidgets('pending correction can be withdrawn and refreshes', (
    tester,
  ) async {
    repo.corrections = [testCorrection()];
    await mount(tester);
    await tester.pumpAndSettle();
    await tester.tap(find.text('PDKS düzeltme'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Geri çek'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Geri çek'));
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
    await tester.tap(find.text('Gönder'));
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
      await tester.tap(find.text('Gönder'));
      await tester.pumpAndSettle();
      expect(find.text('Gerekçe 5–300 karakter olmalı'), findsOneWidget);
      expect(repo.submits, 0);
      await tester.enterText(find.byType(TextField), 'Gerekçe yeterli');
      await tester.tap(find.text('Gönder'));
      await tester.pumpAndSettle();
      expect(
        find.text('Düzeltme türüne uygun giriş ve çıkış saatlerini belirtin'),
        findsOneWidget,
      );
      expect(repo.submits, 0);
      await tester.tap(find.text('Giriş: HH:mm'));
      await tester.pumpAndSettle();
      expect(find.byType(TimePickerDialog), findsOneWidget);
      await tester.tap(find.text('Tamam'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Gönder'));
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
      await tester.tap(find.text('Gönder'));
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
      await tester.tap(find.textContaining('Tarih: '));
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
}
