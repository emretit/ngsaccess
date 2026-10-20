import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/models/door_operation.dart';
import 'package:ngsplusapp/widgets/cards/door_command_status_card.dart';

DoorOperation _operation(
  DoorOperationStatus status, {
  DoorOperationFailureCode? code,
}) => DoorOperation(
  operationId: 'operation',
  status: status,
  deviceId: 'device',
  doorId: 'north-door',
  deviceName: 'North entrance',
  requestedAt: DateTime.utc(2026, 10, 19),
  errorCode: code,
);

Widget _wrap(Widget child, {double scale = 1, bool dark = false}) =>
    MaterialApp(
      locale: const Locale('en'),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      theme: ThemeData(brightness: dark ? Brightness.dark : Brightness.light),
      home: Builder(
        builder: (context) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: Scaffold(
            body: SingleChildScrollView(
              child: Padding(padding: const EdgeInsets.all(16), child: child),
            ),
          ),
        ),
      ),
    );

void main() {
  testWidgets('acknowledged command states never promise a physical passage', (
    tester,
  ) async {
    for (final status in DoorOperationStatus.values) {
      final operation = _operation(status);
      await tester.pumpWidget(
        _wrap(
          DoorCommandStatusCard(
            operation: operation,
            hasUnresolvedOperation: operation.isUnresolved,
            isLoading: false,
            onCheckStatus: () {},
            onRetrySameRequest: () {},
          ),
        ),
      );
      await tester.pump();
      final l10n = AppLocalizations.of(
        tester.element(find.byType(DoorCommandStatusCard)),
      );
      final expected = switch (status) {
        DoorOperationStatus.pending ||
        DoorOperationStatus.sent => l10n.homeCommandPending,
        DoorOperationStatus.confirmed => l10n.homeCommandConfirmed,
        DoorOperationStatus.failed => l10n.homeCommandFailed,
        DoorOperationStatus.unknown => l10n.homeCommandUnknown,
      };
      expect(find.text(expected), findsOneWidget);
      expect(find.text(l10n.unlockGranted), findsNothing);
      expect(
        find.text(l10n.homeCommandCheckStatus),
        operation.isUnresolved ? findsOneWidget : findsNothing,
      );
      expect(find.text(l10n.homeCommandRetrySameRequest), findsNothing);
    }
  });

  testWidgets(
    'no-response reconciliation and explicit resend are separate actions',
    (tester) async {
      var reads = 0;
      var resends = 0;
      await tester.pumpWidget(
        _wrap(
          DoorCommandStatusCard(
            operation: null,
            hasUnresolvedOperation: true,
            isLoading: false,
            canRetrySameRequest: true,
            error: const TimeoutError(),
            onCheckStatus: () => reads++,
            onRetrySameRequest: () => resends++,
          ),
        ),
      );
      await tester.pump();
      final l10n = AppLocalizations.of(
        tester.element(find.byType(DoorCommandStatusCard)),
      );
      expect(find.text(l10n.homeCommandUnknown), findsOneWidget);
      expect(find.text(l10n.unlockDenied), findsNothing);
      await tester.tap(find.text(l10n.homeCommandCheckStatus));
      expect(reads, 1);
      expect(resends, 0);
      await tester.tap(find.text(l10n.homeCommandRetrySameRequest));
      expect(reads, 1);
      expect(resends, 1);
    },
  );

  testWidgets(
    'network preflight error and denied target are presented differently',
    (tester) async {
      await tester.pumpWidget(
        _wrap(
          DoorCommandStatusCard(
            operation: null,
            hasUnresolvedOperation: false,
            isLoading: false,
            error: const NetworkError(),
            onCheckStatus: () {},
            onRetrySameRequest: () {},
          ),
        ),
      );
      await tester.pump();
      final l10n = AppLocalizations.of(
        tester.element(find.byType(DoorCommandStatusCard)),
      );
      expect(find.text(l10n.errorNetwork), findsOneWidget);
      expect(find.text(l10n.unlockDenied), findsNothing);
      await tester.pumpWidget(
        _wrap(
          DoorCommandStatusCard(
            operation: _operation(
              DoorOperationStatus.failed,
              code: DoorOperationFailureCode.targetNotAllowed,
            ),
            hasUnresolvedOperation: false,
            isLoading: false,
            onCheckStatus: () {},
            onRetrySameRequest: () {},
          ),
        ),
      );
      await tester.pump();
      expect(find.text(l10n.unlockDenied), findsOneWidget);
      expect(find.text(l10n.errorNetwork), findsNothing);
    },
  );

  testWidgets(
    'sending state disables reconciliation and does not claim submission completed',
    (tester) async {
      var reads = 0;
      var resends = 0;
      await tester.pumpWidget(
        _wrap(
          DoorCommandStatusCard(
            operation: null,
            hasUnresolvedOperation: true,
            isLoading: true,
            canRetrySameRequest: true,
            isSending: true,
            onCheckStatus: () => reads++,
            onRetrySameRequest: () => resends++,
          ),
        ),
      );
      await tester.pump();
      final l10n = AppLocalizations.of(
        tester.element(find.byType(DoorCommandStatusCard)),
      );
      expect(find.text(l10n.homeCommandSending), findsOneWidget);
      expect(find.text(l10n.homeCommandPending), findsNothing);
      await tester.tap(find.text(l10n.homeCommandCheckStatus));
      await tester.tap(find.text(l10n.homeCommandRetrySameRequest));
      expect(reads, 0);
      expect(resends, 0);
    },
  );

  testWidgets(
    'restore query offers recovery without claiming a command is being sent',
    (tester) async {
      await tester.pumpWidget(
        _wrap(
          DoorCommandStatusCard(
            operation: null,
            hasUnresolvedOperation: true,
            isLoading: true,
            onCheckStatus: () {},
            onRetrySameRequest: () {},
          ),
        ),
      );
      await tester.pump();
      final l10n = AppLocalizations.of(
        tester.element(find.byType(DoorCommandStatusCard)),
      );
      expect(find.text(l10n.homeDataLoading), findsOneWidget);
      expect(find.text(l10n.homeCommandSending), findsNothing);
      expect(find.text(l10n.homeCommandRetrySameRequest), findsNothing);
    },
  );

  testWidgets(
    'command status and recovery controls reflow at 320px and 200% text',
    (tester) async {
      tester.view.physicalSize = const Size(320, 1200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      for (final dark in [false, true]) {
        await tester.pumpWidget(
          _wrap(
            DoorCommandStatusCard(
              operation: null,
              hasUnresolvedOperation: true,
              isLoading: false,
              canRetrySameRequest: true,
              error: const TimeoutError(),
              onCheckStatus: () {},
              onRetrySameRequest: () {},
            ),
            scale: 2,
            dark: dark,
          ),
        );
        await tester.pump();
        expect(tester.takeException(), isNull);
        final l10n = AppLocalizations.of(
          tester.element(find.byType(DoorCommandStatusCard)),
        );
        await tester.ensureVisible(find.text(l10n.homeCommandRetrySameRequest));
        await tester.pump();
        expect(tester.takeException(), isNull);
      }
    },
  );
}
