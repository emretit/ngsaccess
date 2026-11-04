import 'package:flutter/material.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/providers/attendance_provider.dart';
import 'package:ngsplusapp/widgets/cards/attendance_status_card.dart';

Widget _wrap(
  Widget child, {
  double scale = 1,
  bool dark = false,
  String locale = 'en',
}) {
  return MaterialApp(
    locale: Locale(locale),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
    home: Builder(
      builder: (context) => MediaQuery(
        data: MediaQuery.of(
          context,
        ).copyWith(textScaler: TextScaler.linear(scale)),
        child: Scaffold(body: SingleChildScrollView(child: child)),
      ),
    ),
  );
}

AttendanceStatusCard _status({
  bool loaded = true,
  bool loading = false,
  bool known = true,
  int extraEntries = 123,
  int extraExits = 0,
  String? error,
  DateTime? entry,
  VoidCallback? retry,
}) => AttendanceStatusCard(
  status: entry == null ? AttendanceStatus.none : AttendanceStatus.inside,
  lastEntry: entry,
  lastExit: null,
  extraEntryCount: extraEntries,
  extraExitCount: extraExits,
  isLoading: loading,
  hasLoaded: loaded,
  isStatusKnown: known,
  errorMessage: error,
  onRetry: retry,
);

void main() {
  testWidgets(
    'today shows the real first entry separately from the last entry',
    (tester) async {
      await tester.pumpWidget(
        _wrap(
          AttendanceStatusCard(
            status: AttendanceStatus.inside,
            firstEntry: DateTime.utc(2026, 11, 4, 5, 52),
            lastEntry: DateTime.utc(2026, 11, 4, 10, 14),
            lastExit: DateTime.utc(2026, 11, 4, 9, 31),
            extraEntryCount: 0,
            extraExitCount: 0,
            firstEntryDoorName: 'Verified entrance',
          ),
        ),
      );
      await tester.pump();
      expect(find.text('08:52'), findsOneWidget);
      expect(find.text('12:31'), findsOneWidget);
      expect(find.text('13:14'), findsOneWidget);
      expect(find.text('Verified entrance'), findsOneWidget);
      expect(find.byType(AppPrimaryButton), findsNothing);
    },
  );

  testWidgets('initial loading never announces an empty business status', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    try {
      await tester.pumpWidget(_wrap(_status(loaded: false, loading: true)));
      await tester.pump();
      final l10n = AppLocalizations.of(
        tester.element(find.byType(AttendanceStatusCard)),
      );
      expect(find.byType(AppSkeleton), findsOneWidget);
      expect(find.text(l10n.homeStatusNone), findsNothing);
      expect(find.byType(LinearProgressIndicator), findsNothing);
      expect(
        find.bySemanticsLabel(RegExp(RegExp.escape(l10n.homeDataLoading))),
        findsWidgets,
      );
    } finally {
      semantics.dispose();
    }
  });

  testWidgets('a failed first load exposes retry, then empty success', (
    tester,
  ) async {
    var retries = 0;
    await tester.pumpWidget(
      _wrap(
        _status(
          loaded: false,
          error: 'Connection unavailable',
          retry: () => retries++,
        ),
      ),
    );
    await tester.pump();
    final l10n = AppLocalizations.of(
      tester.element(find.byType(AttendanceStatusCard)),
    );
    expect(find.text(l10n.homeStatusNone), findsNothing);
    expect(find.text(l10n.homeDataUnavailable), findsOneWidget);
    await tester.tap(find.text(l10n.homeRetry));
    expect(retries, 1);
    await tester.pumpWidget(_wrap(_status()));
    await tester.pump();
    expect(find.text(l10n.homeStatusNone), findsOneWidget);
    expect(find.text(l10n.homeDataUnavailable), findsNothing);
  });

  testWidgets('English attendance card renders directional extra counts', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(_status(extraEntries: 1, extraExits: 2)));
    await tester.pump();
    expect(find.text('+1 more entry'), findsOneWidget);
    expect(find.text('+1 more entries'), findsNothing);
    expect(find.text('+2 more exits'), findsOneWidget);
  });

  testWidgets('unknown direction is neither empty success nor inside', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(_status(known: false)));
    await tester.pump();
    final l10n = AppLocalizations.of(
      tester.element(find.byType(AttendanceStatusCard)),
    );
    expect(find.text(l10n.homeStatusUnknown), findsOneWidget);
    expect(find.text(l10n.homeStatusNone), findsNothing);
    expect(find.text(l10n.homeStatusInside), findsNothing);
  });

  testWidgets(
    'refresh error keeps the last status and explicitly marks stale data',
    (tester) async {
      await tester.pumpWidget(
        _wrap(
          _status(
            entry: DateTime.utc(2026, 10, 19, 6, 15),
            error: 'Connection unavailable',
            retry: () {},
          ),
        ),
      );
      await tester.pump();
      final l10n = AppLocalizations.of(
        tester.element(find.byType(AttendanceStatusCard)),
      );
      expect(find.text(l10n.homeDataStale), findsOneWidget);
      expect(find.text(l10n.homeStatusInside), findsOneWidget);
      expect(find.text('09:15'), findsOneWidget);
      expect(find.text(l10n.homeRetry), findsOneWidget);
    },
  );

  for (final dark in [false, true]) {
    for (final locale in ['tr', 'en']) {
      testWidgets(
        '320px, 200% text, $locale, dark=$dark preserves attendance times',
        (tester) async {
          tester.view.physicalSize = const Size(320, 2000);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          await tester.pumpWidget(
            _wrap(
              Padding(
                padding: const EdgeInsets.all(16),
                child: _status(entry: DateTime.utc(2026, 10, 19, 6, 15)),
              ),
              scale: 2,
              dark: dark,
              locale: locale,
            ),
          );
          await tester.pump();
          expect(tester.takeException(), isNull);
          expect(find.text('09:15'), findsOneWidget);
          expect(
            tester.getSize(find.byType(AttendanceStatusCard)).width,
            lessThanOrEqualTo(288),
          );
        },
      );
    }
  }
}
