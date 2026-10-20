import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/models/device.dart';
import 'package:ngsplusapp/providers/preferred_device_provider.dart';
import 'package:ngsplusapp/repositories/device_repository.dart';
import 'package:ngsplusapp/screens/settings/select_device_screen.dart';
import 'package:provider/provider.dart';

import '../helpers/preference_store.dart';

const firstTarget = Device(
  id: 'panel',
  name: null,
  doorId: 'front',
  targetId: 'panel:front',
  doorName: 'İç Kapı',
  canOpen: true,
);
const secondTarget = Device(
  id: 'panel',
  name: 'Panel',
  doorId: 'rear',
  targetId: 'panel:rear',
  doorName: 'Rear door',
  canOpen: true,
);

class ControlledDevices implements DeviceRepository {
  Future<List<Device>> Function()? onList;
  int calls = 0;
  @override
  Future<List<Device>> listForEmployee() async {
    calls++;
    return onList?.call() ?? Future.value([firstTarget, secondTarget]);
  }
}

void main() {
  late TestPreferences prefs;
  late PreferredDeviceProvider preferred;
  late ControlledDevices repository;
  Future<void> prepare() async {
    prefs = TestPreferences();
    preferred = PreferredDeviceProvider(preferencesLoader: () async => prefs);
    repository = ControlledDevices();
    await preferred.setIdentity(
      'employee-a',
      projectId: 'project-a',
      deployment: 'fixture',
    );
  }

  tearDown(() => preferred.dispose());

  Future<void> mount(
    WidgetTester tester, {
    double scale = 1,
    bool settle = true,
  }) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          Provider<DeviceRepository>.value(value: repository),
          ChangeNotifierProvider<PreferredDeviceProvider>.value(
            value: preferred,
          ),
        ],
        child: MaterialApp(
          locale: const Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(scale)),
            child: child ?? const SizedBox.shrink(),
          ),
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const SelectDeviceScreen(),
                  ),
                ),
                child: const Text('Open selector'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open selector'));
    if (settle) {
      await tester.pumpAndSettle();
    } else {
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
    }
  }

  testWidgets(
    'localized network failure preserves preference and allows explicit clear',
    (tester) async {
      await prepare();
      await preferred.setDevice(
        id: 'panel',
        name: 'İç Kapı',
        doorId: 'front',
        targetId: 'panel:front',
      );
      repository.onList = () async =>
          throw const NetworkError('untrusted fixture');
      await mount(tester);
      expect(
        find.text('No internet connection. Please check your connection.'),
        findsOneWidget,
      );
      expect(find.textContaining('untrusted'), findsNothing);
      expect(preferred.doorId, 'front');
      await tester.tap(find.text('Clear selection'));
      await tester.pumpAndSettle();
      expect(preferred.hasDevice, isFalse);
    },
  );

  testWidgets(
    'successful empty access list invalidates old preference with explanation',
    (tester) async {
      await prepare();
      await preferred.setDevice(
        id: 'panel',
        name: 'İç Kapı',
        doorId: 'front',
        targetId: 'panel:front',
      );
      repository.onList = () async => [];
      await mount(tester);
      expect(preferred.hasDevice, isFalse);
      expect(
        find.text(
          'The previous target is no longer available. Choose a new target.',
        ),
        findsOneWidget,
      );
      expect(find.text('No accessible doors yet'), findsOneWidget);
      expect(find.byTooltip('Refresh'), findsOneWidget);
    },
  );

  testWidgets('failed selection stays visible and never navigates as saved', (
    tester,
  ) async {
    await prepare();
    prefs.rejectedWrites.add(1);
    await mount(tester);
    await tester.tap(find.text('Rear door'));
    await tester.pumpAndSettle();
    expect(find.text('Select Door'), findsOneWidget);
    expect(
      find.text('Could not save your preference. Please try again.'),
      findsOneWidget,
    );
    expect(preferred.hasDevice, isFalse);
  });

  testWidgets(
    'pending save locks further choices and successful save retains exact door target',
    (tester) async {
      await prepare();
      await mount(tester);
      prefs.writeGate = Completer<void>();
      await tester.tap(find.text('Rear door'));
      await tester.pump();
      expect(preferred.isSaving, isTrue);
      expect(find.text('Select Door'), findsOneWidget);
      await tester.tap(find.text('İç Kapı'));
      await tester.pump();
      expect(prefs.writes, hasLength(1));
      prefs.writeGate?.complete();
      await tester.pumpAndSettle();
      expect(preferred.doorId, 'rear');
      expect(preferred.targetId, 'panel:rear');
      expect(find.text('Open selector'), findsOneWidget);
    },
  );

  testWidgets('old account response cannot replace the new account list', (
    tester,
  ) async {
    await prepare();
    final firstResponse = Completer<List<Device>>();
    repository.onList = () => repository.calls == 1
        ? firstResponse.future
        : Future.value([secondTarget]);
    await mount(tester, settle: false);
    await preferred.setIdentity(
      'employee-b',
      projectId: 'project-b',
      deployment: 'fixture',
    );
    await tester.pumpAndSettle();
    firstResponse.complete([firstTarget]);
    await tester.pumpAndSettle();
    expect(find.text('Rear door'), findsOneWidget);
    expect(find.text('İç Kapı'), findsNothing);
  });

  testWidgets('Turkish search and unknown labels use the current UI language', (
    tester,
  ) async {
    await prepare();
    repository.onList = () async => [
      firstTarget,
      const Device(
        id: 'unknown',
        name: null,
        targetId: 'unknown:standalone',
        canOpen: true,
      ),
    ];
    await mount(tester);
    expect(find.text('Unknown Device'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'ic kapi');
    await tester.pumpAndSettle();
    // This query intentionally includes a distinct Turkish consonant: ç != c.
    expect(find.text('No matching doors'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'İÇ KAPI');
    await tester.pumpAndSettle();
    expect(find.text('İç Kapı'), findsOneWidget);
  });

  testWidgets(
    'unavailable target explains its typed reason and cannot be selected',
    (tester) async {
      await prepare();
      repository.onList = () async => [
        const Device(
          id: 'panel',
          name: 'Panel',
          targetId: 'panel:standalone',
          canOpen: false,
          reason: 'SCHEDULE_DENIED',
        ),
      ];
      await mount(tester, scale: 2);
      expect(find.text('Outside access hours'), findsOneWidget);
      await tester.tap(find.text('Panel'));
      await tester.pumpAndSettle();
      expect(preferred.hasDevice, isFalse);
      expect(tester.takeException(), isNull);
    },
  );
}
