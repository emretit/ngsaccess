import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/models/device.dart';

void main() {
  test(
    'missing, null, blank and non-string ids are never coerced into valid devices',
    () {
      for (final id in [
        null,
        '',
        ' ',
        'null',
        ' null ',
        ' padded',
        42,
        false,
      ]) {
        expect(
          () => Device.fromConvex({'_id': id, 'name': 'Reader'}),
          throwsFormatException,
        );
      }
    },
  );

  test(
    'missing and blank labels remain null, real Unicode labels stay unchanged',
    () {
      expect(Device.fromConvex({'_id': 'a'}).name, isNull);
      expect(Device.fromConvex({'_id': 'a', 'name': '  '}).name, isNull);
      expect(
        Device.fromConvex({'_id': 'a', 'name': 'İç Kapı ıI'}).name,
        'İç Kapı ıI',
      );
      expect(
        () => Device.fromConvex({'_id': 'a', 'name': 42}),
        throwsFormatException,
      );
    },
  );

  test(
    'malformed list/row fails instead of masquerading as successful empty access',
    () {
      for (final raw in [
        '{}',
        'null',
        '[null]',
        '[42]',
        '[{"_id":"good"},{}]',
      ]) {
        expect(() => Device.listFromConvexJson(raw), throwsFormatException);
      }
      expect(Device.listFromConvexJson('[]'), isEmpty);
    },
  );

  test('two doors on one controller stay distinct; duplicate targets fail', () {
    final rows = [
      {'_id': 'panel', 'targetId': 'panel:front', 'doorId': 'front'},
      {'_id': 'panel', 'targetId': 'panel:rear', 'doorId': 'rear'},
    ];
    expect(Device.listFromConvexJson(jsonEncode(rows)), hasLength(2));
    expect(
      () => Device.listFromConvexJson(jsonEncode([rows.first, rows.first])),
      throwsFormatException,
    );
  });

  test('target endpoint must supply typed capability metadata', () {
    const valid = {
      '_id': 'panel',
      'deviceId': 'panel',
      'targetId': 'panel:front',
      'doorId': 'front',
      'canOpen': true,
      'transport': 'ide_mqtt',
      'supportsReaderToken': false,
      'actuator': 1,
    };
    expect(
      Device.listFromConvexJson(
        jsonEncode([valid]),
        requireTargetMetadata: true,
      ).single.canOpen,
      isTrue,
    );
    expect(
      () => Device.listFromConvexJson(
        '[{"_id":"panel"}]',
        requireTargetMetadata: true,
      ),
      throwsFormatException,
    );
    expect(
      () => Device.fromConvex({...valid, 'canOpen': 'yes'}),
      throwsFormatException,
    );
    expect(
      () => Device.fromConvex({...valid, 'deviceId': 'different'}),
      throwsFormatException,
    );
    expect(
      () => Device.fromConvex({...valid, 'doorId': 'null'}),
      throwsFormatException,
    );
    expect(
      () => Device.listFromConvexJson(
        jsonEncode([
          {...valid, 'actuator': null},
        ]),
        requireTargetMetadata: true,
      ),
      throwsFormatException,
    );
    expect(
      Device.listFromConvexJson(
        jsonEncode([
          {...valid, 'actuator': 0},
        ]),
        requireTargetMetadata: true,
      ).single.actuator,
      0,
    );
    expect(
      () => Device.listFromConvexJson(
        jsonEncode([
          {...valid, 'transport': 'hik_gateway', 'actuator': 0},
        ]),
        requireTargetMetadata: true,
      ),
      throwsFormatException,
    );
  });

  test(
    'mixed target list keeps unsupported topology visible without inventing an actuator',
    () {
      final targets = Device.listFromConvexJson(
        jsonEncode([
          {
            '_id': 'supported',
            'targetId': 'supported:front',
            'doorId': 'front',
            'canOpen': true,
            'transport': 'ide_mqtt',
            'supportsReaderToken': false,
            'actuator': 0,
          },
          {
            '_id': 'incomplete',
            'targetId': 'incomplete:standalone',
            'canOpen': false,
            'transport': 'unsupported',
            'reason': 'TARGET_UNSUPPORTED',
            'supportsReaderToken': false,
            'actuator': null,
          },
        ]),
        requireTargetMetadata: true,
      );
      expect(targets, hasLength(2));
      expect(targets.first.canOpen, isTrue);
      expect(targets.first.actuator, 0);
      expect(targets.last.canOpen, isFalse);
      expect(targets.last.actuator, isNull);
      expect(targets.last.reason, 'TARGET_UNSUPPORTED');
    },
  );
}
