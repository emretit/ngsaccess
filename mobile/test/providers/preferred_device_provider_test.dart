import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/models/device.dart';
import 'package:ngsplusapp/providers/preferred_device_provider.dart';
import 'package:ngsplusapp/providers/theme_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../helpers/preference_store.dart';

const front = Device(
  id: 'controller',
  name: 'Controller',
  doorId: 'front',
  targetId: 'controller:front',
  doorName: 'Front door',
  canOpen: true,
);
const rear = Device(
  id: 'controller',
  name: 'Controller',
  doorId: 'rear',
  targetId: 'controller:rear',
  doorName: 'Rear door',
  canOpen: true,
);

void main() {
  late TestPreferences prefs;
  late PreferredDeviceProvider provider;
  setUp(() {
    prefs = TestPreferences();
    provider = PreferredDeviceProvider(preferencesLoader: () async => prefs);
  });
  tearDown(() => provider.dispose());

  Future<void> identity(
    String employee, {
    String project = 'project-a',
    String deployment = 'test-deployment',
  }) => provider.setIdentity(
    employee,
    projectId: project,
    deployment: deployment,
  );
  Future<bool> select(Device device) => provider.setDevice(
    id: device.id,
    name: device.doorName ?? device.name,
    doorId: device.doorId,
    targetId: device.targetId,
  );

  test(
    'legacy unscoped preference is deleted and never assigned to an account',
    () async {
      prefs.values.addAll({
        'mobile_preferred_device_id': 'old-device',
        'mobile_preferred_device_name': 'Old label',
      });
      await identity('employee-a');
      expect(provider.hasDevice, isFalse);
      expect(prefs.values.containsKey('mobile_preferred_device_id'), isFalse);
      expect(prefs.values.containsKey('mobile_preferred_device_name'), isFalse);
    },
  );

  test(
    'selection is one versioned JSON write with complete target and scope',
    () async {
      await identity('employee-a');
      expect(await select(rear), isTrue);
      expect(prefs.writes, hasLength(1));
      final Object? decoded = jsonDecode(
        prefs.values[PreferredDeviceProvider.storageKey] ?? 'null',
      );
      expect(decoded, {
        'version': 1,
        'employeeId': 'employee-a',
        'projectId': 'project-a',
        'deployment': 'test-deployment',
        'device': {
          'id': 'controller',
          'name': 'Rear door',
          'doorId': 'rear',
          'targetId': 'controller:rear',
        },
      });
      expect(provider.doorId, 'rear');
    },
  );

  test(
    'account change clears memory immediately and late A write cannot populate B',
    () async {
      await identity('employee-a');
      prefs.writeGate = Completer<void>();
      final aSave = select(front);
      await prefs.writeStarted.future;
      final bBootstrap = identity('employee-b');
      expect(provider.hasDevice, isFalse);
      expect(provider.deviceName, isNull);
      expect(provider.isSaving, isFalse);
      prefs.writeGate?.complete();
      expect(await aSave, isFalse);
      await bBootstrap;
      expect(provider.hasDevice, isFalse);
      expect(provider.error, isNull);
      expect(await select(rear), isTrue);
      expect(provider.deviceName, 'Rear door');
    },
  );

  test(
    'project and deployment changes cannot restore a different scope',
    () async {
      await identity('employee-a');
      await select(front);
      await identity('employee-a', project: 'project-b');
      expect(provider.hasDevice, isFalse);
      await identity('employee-a', deployment: 'other-deployment');
      expect(provider.hasDevice, isFalse);
      await identity('employee-a');
      expect(provider.deviceName, 'Front door');
      await provider.setIdentity(null);
      expect(provider.deviceId, isNull);
      expect(provider.doorId, isNull);
    },
  );

  test(
    'incomplete identity fails closed rather than using global preferences',
    () async {
      await provider.setIdentity('employee-a', projectId: 'project-a');
      expect(await select(front), isFalse);
      expect(provider.error, PreferenceError.unavailableIdentity);
      expect(prefs.writes, isEmpty);
    },
  );

  test(
    'distinct doors on one panel survive restore and revalidation',
    () async {
      await identity('employee-a');
      await select(rear);
      final restored = PreferredDeviceProvider(
        preferencesLoader: () async => prefs,
      );
      addTearDown(restored.dispose);
      await restored.setIdentity(
        'employee-a',
        projectId: 'project-a',
        deployment: 'test-deployment',
      );
      await restored.revalidate([front, rear]);
      expect(restored.doorId, 'rear');
      expect(restored.targetId, 'controller:rear');
      await restored.revalidate([front]);
      expect(restored.hasDevice, isFalse);
      expect(restored.wasInvalidated, isTrue);
    },
  );

  test(
    'fast server list still invalidates a preference restored from slow storage',
    () async {
      await identity('employee-a');
      await select(front);
      final read = Completer<SharedPreferences>();
      var loads = 0;
      final restored = PreferredDeviceProvider(
        preferencesLoader: () =>
            ++loads == 1 ? read.future : Future.value(prefs),
      );
      addTearDown(restored.dispose);
      final restore = restored.setIdentity(
        'employee-a',
        projectId: 'project-a',
        deployment: 'test-deployment',
      );
      final validation = restored.revalidate([]);
      read.complete(prefs);
      await Future.wait([restore, validation]);
      expect(restored.hasDevice, isFalse);
      expect(restored.wasInvalidated, isTrue);
    },
  );

  test(
    'successful list updates a renamed target and preserves schedule-denied choice',
    () async {
      await identity('employee-a');
      await select(front);
      await provider.revalidate([
        const Device(
          id: 'controller',
          name: null,
          doorId: 'front',
          targetId: 'controller:front',
          doorName: 'New front name',
          canOpen: false,
          reason: 'SCHEDULE_DENIED',
        ),
      ]);
      expect(provider.deviceName, 'New front name');
      expect(provider.hasDevice, isTrue);
      expect(provider.wasInvalidated, isFalse);
    },
  );

  test(
    'inactive target clears immediately even if persistence fails',
    () async {
      await identity('employee-a');
      await select(front);
      prefs.rejectedWrites.add(2);
      expect(
        await provider.revalidate([
          const Device(
            id: 'controller',
            name: 'Controller',
            doorId: 'front',
            targetId: 'controller:front',
            canOpen: false,
            reason: 'DEVICE_INACTIVE',
          ),
        ]),
        isFalse,
      );
      expect(provider.hasDevice, isFalse);
      expect(provider.error, PreferenceError.storage);
      expect(provider.wasInvalidated, isTrue);
    },
  );

  test(
    'failed manual selection/clear leaves last verified choice visible',
    () async {
      await identity('employee-a');
      await select(front);
      prefs.rejectedWrites.addAll([2, 3]);
      expect(await select(rear), isFalse);
      expect(provider.doorId, 'front');
      expect(await provider.clear(), isFalse);
      expect(provider.doorId, 'front');
      expect(provider.isSaving, isFalse);
    },
  );

  test(
    'rapid selections serialize and the final id and label stay paired',
    () async {
      await identity('employee-a');
      prefs.writeGate = Completer<void>();
      final first = select(front);
      await prefs.writeStarted.future;
      final second = select(rear);
      prefs.writeGate?.complete();
      await Future.wait([first, second]);
      expect(prefs.maxConcurrentWrites, 1);
      expect(provider.doorId, 'rear');
      expect(provider.deviceName, 'Rear door');
      expect(provider.isSaving, isFalse);
    },
  );

  test('corrupt record is safe and a nullable label stays nullable', () async {
    prefs.values[PreferredDeviceProvider.storageKey] = '{invalid';
    await identity('employee-a');
    expect(provider.error, PreferenceError.storage);
    expect(provider.hasDevice, isFalse);
    expect(await provider.setDevice(id: 'valid', name: null), isTrue);
    expect(provider.deviceName, isNull);
    expect(await provider.setDevice(id: 'null', name: 'bad'), isFalse);
    expect(provider.deviceId, 'valid');
  });
}
