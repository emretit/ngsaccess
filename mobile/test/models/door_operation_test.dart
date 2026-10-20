import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/models/door_operation.dart';

Map<String, Object?> operationJson({String status = 'pending'}) => {
  'operationId': 'operation-a',
  'status': status,
  'deviceId': 'device-a',
  'doorId': 'door-a',
  'deviceName': 'Test door',
  'requestedAt': '2026-10-19T10:00:00.000Z',
};

void main() {
  test('command acknowledgement is terminal but not an attendance event', () {
    final pending = DoorOperation.fromJson(operationJson());
    expect(pending.isUnresolved, isTrue);
    expect(pending.pendingExpiresAt, DateTime.utc(2026, 10, 19, 10, 0, 30));
    final confirmed = DoorOperation.fromJson(
      operationJson(status: 'confirmed'),
    );
    expect(confirmed.status, DoorOperationStatus.confirmed);
    expect(confirmed.isUnresolved, isFalse);
    expect(confirmed.pendingExpiresAt, isNull);
    expect(
      DoorOperation.fromJson(operationJson(status: 'unknown')).isUnresolved,
      isTrue,
    );
  });

  test(
    'rejects malformed identifiers, states and noncanonical server dates',
    () {
      final corruptions = <Map<String, Object?>>[
        {'operationId': null},
        {'deviceId': true},
        {'doorId': ''},
        {'deviceId': 'null'},
        {'status': 'granted'},
        {'status': null},
        {'deviceName': 12},
        {'requestedAt': 1792404000000},
        {'requestedAt': '2026-10-19'},
        {'requestedAt': '2026-02-30T10:00:00.000Z'},
        {'requestedAt': '2026-10-19T13:00:00.000+03:00'},
        {'errorCode': <String>[]},
      ];
      for (final corruption in corruptions) {
        expect(
          () => DoorOperation.fromJson({...operationJson(), ...corruption}),
          throwsA(isA<ProtocolError>()),
        );
      }
      for (final value in <Object?>[null, [], true, 'granted']) {
        expect(
          () => DoorOperation.fromJson(value),
          throwsA(isA<ProtocolError>()),
        );
      }
    },
  );

  test(
    'failed command reasons are typed and arbitrary details are discarded',
    () {
      final failed = DoorOperation.fromJson({
        ...operationJson(status: 'failed'),
        'errorCode': 'COMMAND_EXPIRED',
      });
      expect(failed.errorCode, DoorOperationFailureCode.commandExpired);
      final unknown = DoorOperation.fromJson({
        ...operationJson(status: 'failed'),
        'errorCode': 'untrusted-private-marker',
      });
      expect(unknown.errorCode, DoorOperationFailureCode.unknown);
      expect(unknown.errorCode.toString(), isNot(contains('private-marker')));
    },
  );
}
