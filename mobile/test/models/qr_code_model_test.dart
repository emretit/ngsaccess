import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/models/qr_code_model.dart';

void main() {
  final now = DateTime.utc(2026, 10, 19, 12);
  QrPayload parse(Object? value) =>
      QrPayloadParser.parse(jsonEncode(value), now: now);

  test(
    'legacy generator and equivalent JSON share the typed identity contract',
    () {
      final raw = QRCodeGenerator.generateQRData(
        deviceId: 'non-prefix-device',
        location: 'Untrusted location',
        deviceName: 'Untrusted device',
      );
      final base64Result = QrPayloadParser.parse(raw);
      final jsonResult = QrPayloadParser.parse(utf8.decode(base64Decode(raw)));
      expect(base64Result, isA<QrDeviceIdentity>());
      expect(jsonResult, isA<QrDeviceIdentity>());
      expect((base64Result as QrDeviceIdentity).deviceId, 'non-prefix-device');
      expect((jsonResult as QrDeviceIdentity).deviceId, base64Result.deviceId);
      // The legacy adapter cannot send a static identity to selfCheckIn.
      expect(QRCodeGenerator.parseQRData(raw)['is_valid'], isFalse);
    },
  );

  test(
    'j-prefixed serial remains a serial; web plain label is descriptive',
    () {
      final json = parse({
        'version': 1,
        'type': 'device_identity',
        'deviceSerial': 'j-SERIAL',
      });
      final plain = QrPayloadParser.parse('j-SERIAL');
      for (final payload in [json, plain]) {
        expect(payload, isA<QrDeviceIdentity>());
        final identity = payload as QrDeviceIdentity;
        expect(identity.deviceId, isNull);
        expect(identity.deviceSerial, 'j-SERIAL');
      }
    },
  );

  test(
    'scalar, array, missing, empty and non-string IDs are controlled errors',
    () {
      for (final value in [
        null,
        [],
        true,
        8,
        {},
        {'deviceId': true},
        {'deviceId': 123},
        {'deviceId': ''},
        {'deviceId': []},
      ]) {
        expect(
          parse(value),
          isA<QrInvalid>(),
          reason: 'invalid fixture: $value',
        );
      }
    },
  );

  test(
    'invalid/future timestamps and unknown version/type never reach an operation',
    () {
      for (final payload in [
        {'deviceId': 'device', 'timestamp': 'bad-date'},
        {'deviceId': 'device', 'timestamp': '2026-02-31T10:00:00Z'},
        {'deviceId': 'device', 'timestamp': 123},
        {
          'deviceId': 'device',
          'timestamp': now.add(const Duration(hours: 1)).toIso8601String(),
        },
        {'version': 2, 'deviceId': 'device'},
        {'version': true, 'deviceId': 'device'},
        {'type': 'unknown', 'deviceId': 'device'},
      ]) {
        expect(parse(payload), isA<QrInvalid>());
      }
    },
  );

  test(
    'metadata cannot inject verified device/user information into typed payload',
    () {
      expect(
        parse({
          'deviceId': 'device',
          'deviceName': {'html': 'x'},
          'location': [],
          'token': 'untrusted',
        }),
        isA<QrDeviceIdentity>(),
      );
      expect(
        parse({'type': 'user_qr', 'user_name': [], 'user_email': true}),
        isA<QrEmployeeIdentity>(),
      );
    },
  );

  test(
    'versioned challenge JSON and base64 normalize equally and expire at boundary',
    () {
      final fixture = {
        'version': 1,
        'type': 'device_challenge',
        'challenge': 'fixture-challenge',
        'expiresAt': now.add(const Duration(seconds: 30)).toIso8601String(),
      };
      final json = jsonEncode(fixture);
      final encoded = base64Encode(utf8.encode(json));
      for (final raw in [json, encoded]) {
        final payload = QrPayloadParser.parse(raw, now: now);
        expect(payload, isA<QrDeviceChallenge>());
        expect((payload as QrDeviceChallenge).challenge, 'fixture-challenge');
      }
      expect(
        QrPayloadParser.parse(json, now: now.add(const Duration(seconds: 30))),
        isA<QrInvalid>().having(
          (value) => value.reason,
          'reason',
          QrParseError.expired,
        ),
      );
    },
  );

  test(
    'Convex model rejects malformed date before rendering and narrows metadata',
    () {
      expect(
        () => QRCodeModel.fromConvex({'createdAt': 'bad'}),
        throwsFormatException,
      );
      final model = QRCodeModel.fromConvex({
        'createdAt': now.toIso8601String(),
        'location': true,
        'name': [],
        'isActive': 'yes',
      });
      expect(model.location, isEmpty);
      expect(model.deviceName, isEmpty);
      expect(model.isActive, isFalse);
    },
  );
}
