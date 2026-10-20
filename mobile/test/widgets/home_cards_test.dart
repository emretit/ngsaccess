import 'dart:ui' show Tristate;

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/providers/attendance_provider.dart';
import 'package:ngsplusapp/widgets/cards/attendance_status_card.dart';
import 'package:ngsplusapp/widgets/cards/quick_action_card.dart';
import 'package:ngsplusapp/widgets/cards/progress_hero_card.dart';
import 'package:ngsplusapp/widgets/responsive_card_grid.dart';

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
    theme: ThemeData(brightness: dark ? Brightness.dark : Brightness.light),
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
  String? error,
  DateTime? entry,
  VoidCallback? retry,
}) => AttendanceStatusCard(
  status: entry == null ? AttendanceStatus.none : AttendanceStatus.inside,
  lastEntry: entry,
  lastExit: null,
  extraEntryCount: extraEntries,
  extraExitCount: 0,
  onScan: () {},
  isLoading: loading,
  hasLoaded: loaded,
  isStatusKnown: known,
  errorMessage: error,
  onRetry: retry,
);

void main() {
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
      expect(find.text(l10n.homeDataLoading), findsOneWidget);
      expect(find.text(l10n.homeStatusNone), findsNothing);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
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

  testWidgets('English attendance card renders singular movement count', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(_status(extraEntries: 1)));
    await tester.pump();
    expect(find.text('+1 movement'), findsOneWidget);
    expect(find.text('+1 movements'), findsNothing);
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

  testWidgets('actions use two columns at normal text and reflow at 200%', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    Widget grid(double scale) => _wrap(
      Padding(
        padding: const EdgeInsets.all(16),
        child: ResponsiveCardGrid(
          children: [
            for (var i = 0; i < 4; i++)
              QuickActionCard(
                icon: Icons.history,
                label: 'Action $i',
                color: Colors.blue,
                onTap: () {},
              ),
          ],
        ),
      ),
      scale: scale,
    );
    await tester.pumpWidget(grid(1));
    await tester.pump();
    final cards = find.byType(QuickActionCard);
    expect(
      tester.getTopLeft(cards.at(0)).dy,
      tester.getTopLeft(cards.at(1)).dy,
    );
    expect(
      tester.getTopLeft(cards.at(2)).dy,
      greaterThan(tester.getTopLeft(cards.at(0)).dy),
    );
    await tester.pumpWidget(grid(2));
    await tester.pump();
    expect(
      tester.getTopLeft(cards.at(1)).dy,
      greaterThan(tester.getTopLeft(cards.at(0)).dy),
    );
    expect(tester.takeException(), isNull);
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
        '320px, 200% text, $locale, dark=$dark preserves times and actions',
        (tester) async {
          tester.view.physicalSize = const Size(320, 2000);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          await tester.pumpWidget(
            _wrap(
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _status(entry: DateTime.utc(2026, 10, 19, 6, 15)),
                    ResponsiveCardGrid(
                      children: [
                        for (var i = 0; i < 4; i++)
                          QuickActionCard(
                            icon: Icons.lock_open,
                            label: 'Action number $i',
                            subtitle:
                                'North building service entrance with a long door name',
                            color: Colors.blue,
                            onTap: () {},
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              scale: 2,
              dark: dark,
              locale: locale,
            ),
          );
          await tester.pump();
          expect(tester.takeException(), isNull);
          expect(find.text('09:15'), findsOneWidget);
          final cards = find.byType(QuickActionCard);
          expect(cards, findsNWidgets(4));
          for (var i = 0; i < 4; i++) {
            await tester.ensureVisible(cards.at(i));
            await tester.pump();
            expect(tester.takeException(), isNull);
            expect(tester.getSize(cards.at(i)).width, lessThanOrEqualTo(288));
          }
        },
      );
    }
  }

  testWidgets(
    'busy action has a named disabled semantic button and cannot run again',
    (tester) async {
      final semantics = tester.ensureSemantics();
      try {
        var calls = 0;
        await tester.pumpWidget(
          _wrap(
            QuickActionCard(
              icon: Icons.lock_open,
              label: 'Open door',
              subtitle: 'North entrance',
              color: Colors.blue,
              onTap: () => calls++,
              isBusy: true,
              busyLabel: 'Command pending',
            ),
          ),
        );
        await tester.pump();
        final node = tester.getSemantics(
          find.bySemanticsLabel('Command pending, North entrance'),
        );
        expect(node.flagsCollection.isButton, isTrue);
        expect(node.flagsCollection.isEnabled != Tristate.none, isTrue);
        expect(node.flagsCollection.isEnabled, Tristate.isFalse);
        expect(node.getSemanticsData().hasAction(SemanticsAction.tap), isFalse);
        await tester.tap(find.byType(QuickActionCard));
        expect(calls, 0);
      } finally {
        semantics.dispose();
      }
    },
  );

  testWidgets('normal actions retain their complete target and activate', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    try {
      var calls = 0;
      await tester.pumpWidget(
        _wrap(
          QuickActionCard(
            icon: Icons.lock_open,
            label: 'Open door',
            subtitle: 'North entrance',
            color: Colors.blue,
            onTap: () => calls++,
          ),
        ),
      );
      await tester.pump();
      final node = tester.getSemantics(
        find.bySemanticsLabel('Open door, North entrance'),
      );
      expect(node.flagsCollection.isButton, isTrue);
      expect(node.flagsCollection.isEnabled, Tristate.isTrue);
      await tester.tap(find.byType(QuickActionCard));
      expect(calls, 1);
    } finally {
      semantics.dispose();
    }
  });

  testWidgets(
    'progress handles zero, negative, and overfull data without overflow',
    (tester) async {
      tester.view.physicalSize = const Size(320, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      for (final total in [0, 10]) {
        await tester.pumpWidget(
          _wrap(
            ProgressHeroCard(
              summary: 'A long summary for a compact screen',
              totalUnits: total,
              segments: const [
                ProgressHeroSegment(value: -5, color: Colors.red),
                ProgressHeroSegment(value: 100, color: Colors.blue),
                ProgressHeroSegment(value: 100, color: Colors.green),
              ],
              chips: const [
                ProgressHeroChip(
                  icon: Icons.check,
                  value: 123,
                  label: 'A long metric label',
                  color: Colors.green,
                ),
              ],
            ),
            scale: 2,
          ),
        );
        await tester.pump();
        expect(tester.takeException(), isNull);
        expect(find.text(total == 0 ? '0%' : '100%'), findsOneWidget);
      }
    },
  );
}
