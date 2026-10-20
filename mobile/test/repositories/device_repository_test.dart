import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/repositories/device_repository.dart';

import '../helpers/mocks.dart';

void main() {
  late MockHttpConvexClient client;
  late DeviceRepository repository;
  setUpAll(registerCommonFallbacks);
  setUp(() {
    client = MockHttpConvexClient();
    repository = DeviceRepository(client);
  });

  test(
    'lists employee-scoped targets without accepting client identity arguments',
    () async {
      when(() => client.employeeQuery(any(), any())).thenAnswer(
        (_) async => jsonEncode([
          {
            '_id': 'controller',
            'deviceId': 'controller',
            'targetId': 'controller:front',
            'doorId': 'front',
            'name': null,
            'doorName': 'Front door',
            'canOpen': true,
            'transport': 'ide_mqtt',
            'supportsReaderToken': false,
            'actuator': 0,
          },
          {
            '_id': 'controller',
            'deviceId': 'controller',
            'targetId': 'controller:rear',
            'doorId': 'rear',
            'name': 'Panel',
            'canOpen': false,
            'reason': 'SCHEDULE_DENIED',
            'transport': 'unsupported',
            'supportsReaderToken': false,
            'actuator': null,
          },
        ]),
      );
      final targets = await repository.listForEmployee();
      expect(targets.map((target) => target.doorId), ['front', 'rear']);
      expect(targets.first.name, isNull);
      verify(
        () => client.employeeQuery('mobileAccess:listTargets', {}),
      ).called(1);
    },
  );

  test(
    'malformed or old partial DTO is a protocol error, not no-access success',
    () async {
      for (final raw in ['{}', 'null', '[null]', '[{"_id":"controller"}]']) {
        when(
          () => client.employeeQuery(any(), any()),
        ).thenAnswer((_) async => raw);
        await expectLater(
          repository.listForEmployee(),
          throwsA(isA<ProtocolError>()),
        );
      }
      when(
        () => client.employeeQuery(any(), any()),
      ).thenAnswer((_) async => '[]');
      expect(await repository.listForEmployee(), isEmpty);
    },
  );

  test('transport failure stays a typed failure', () async {
    when(
      () => client.employeeQuery(any(), any()),
    ).thenThrow(const NetworkError());
    await expectLater(
      repository.listForEmployee(),
      throwsA(isA<NetworkError>()),
    );
  });
}
