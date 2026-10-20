import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/repositories/attendance_repository.dart';

import '../helpers/mocks.dart';

Map<String, Object?> _record() => {
  '_id': 'a1',
  'employeeId': 'e1',
  'deviceId': 'd1',
  'cardNo': '',
  'accessTime': '2026-10-19T09:00:00Z',
  'accessStatus': 'izin_verildi',
  'direction': 'entry',
};
Map<String, Object?> _summary() => {
  'startDate': '2026-10-01',
  'endDate': '2026-10-31',
  'timeZone': 'Europe/Istanbul',
  'generatedAt': '2026-10-19T12:00:00Z',
  'days': List.generate(
    31,
    (i) => {
      'date': '2026-10-${(i + 1).toString().padLeft(2, '0')}',
      'entryCount': 0,
      'exitCount': 0,
      'deniedCount': 0,
      'unknownCount': 0,
      'firstEntry': null,
      'lastEntry': null,
      'lastExit': null,
      'lastDirection': 'unknown',
    },
  ),
  'totals': {
    'entryCount': 0,
    'exitCount': 0,
    'deniedCount': 0,
    'unknownCount': 0,
    'presentDays': 0,
  },
};

void main() {
  late MockHttpConvexClient client;
  late AttendanceRepository repo;
  setUpAll(registerCommonFallbacks);
  setUp(() {
    client = MockHttpConvexClient();
    repo = AttendanceRepository(client);
  });

  test(
    'legacy list reads valid domain rows and accepts a successful empty list',
    () async {
      when(
        () => client.employeeQuery(any(), any()),
      ).thenAnswer((_) async => jsonEncode([_record()]));
      expect((await repo.list(limit: 10)).single.id, 'a1');
      when(
        () => client.employeeQuery(any(), any()),
      ).thenAnswer((_) async => '[]');
      expect(await repo.list(), isEmpty);
    },
  );

  test(
    'malformed envelope, row and timestamp reject atomically rather than return empty/partial success',
    () async {
      for (final payload in [
        '{}',
        '[null]',
        '[true]',
        jsonEncode([
          _record(),
          {..._record(), '_id': 'bad', 'accessTime': 'invalid'},
        ]),
        jsonEncode([
          {..._record(), '_id': ''},
        ]),
      ]) {
        when(
          () => client.employeeQuery(any(), any()),
        ).thenAnswer((_) async => payload);
        await expectLater(repo.list(), throwsA(isA<ProtocolError>()));
      }
    },
  );

  test(
    'cursor API sends calendar bounds and device identity without employee ID',
    () async {
      when(() => client.employeeQuery(any(), any())).thenAnswer(
        (_) async => jsonEncode({
          'page': [_record()],
          'isDone': false,
          'continueCursor': 'next',
        }),
      );
      final result = await repo.listPage(
        cursor: 'previous',
        numItems: 50,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        deviceId: 'd1',
      );
      expect(result.continueCursor, 'next');
      expect(result.isDone, isFalse);
      verify(
        () => client.employeeQuery('mobileAttendance:listPage', {
          'cursor': 'previous',
          'numItems': 50,
          'startDate': '2026-10-01',
          'endDate': '2026-10-31',
          'deviceId': 'd1',
        }),
      ).called(1);
    },
  );

  test('server isDone controls exhaustion even for exactly 50 rows', () async {
    when(() => client.employeeQuery(any(), any())).thenAnswer(
      (_) async => jsonEncode({
        'page': List.generate(50, (i) => {..._record(), '_id': 'r$i'}),
        'isDone': true,
        'continueCursor': '',
      }),
    );
    final result = await repo.listPage();
    expect(result.page, hasLength(50));
    expect(result.isDone, isTrue);
  });

  test(
    'non-final page requires valid continuation; malformed rows are errors',
    () async {
      for (final payload in [
        {'page': [], 'isDone': false, 'continueCursor': ''},
        {'page': [], 'isDone': 'true', 'continueCursor': 'next'},
        {'page': {}, 'isDone': true, 'continueCursor': ''},
        {
          'page': [null],
          'isDone': true,
          'continueCursor': '',
        },
      ]) {
        when(
          () => client.employeeQuery(any(), any()),
        ).thenAnswer((_) async => jsonEncode(payload));
        await expectLater(repo.listPage(), throwsA(isA<ProtocolError>()));
      }
    },
  );

  test(
    'invalid calendar ranges and unbounded page sizes fail before transport',
    () async {
      await expectLater(
        repo.listPage(startDate: '2026-02-30'),
        throwsFormatException,
      );
      await expectLater(
        repo.listPage(startDate: '2026-10-02', endDate: '2026-10-01'),
        throwsFormatException,
      );
      await expectLater(repo.listPage(numItems: 101), throwsArgumentError);
      verifyNever(() => client.employeeQuery(any(), any()));
    },
  );

  test(
    'summary has an independent endpoint and validates requested range/timezone',
    () async {
      when(
        () => client.employeeQuery(any(), any()),
      ).thenAnswer((_) async => jsonEncode(_summary()));
      final result = await repo.summary(
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      );
      expect(result.timeZone, 'Europe/Istanbul');
      verify(
        () => client.employeeQuery('mobileAttendance:summary', {
          'startDate': '2026-10-01',
          'endDate': '2026-10-31',
        }),
      ).called(1);
      for (final payload in [
        {..._summary(), 'timeZone': 'UTC'},
        {..._summary(), 'startDate': '2026-09-01'},
      ]) {
        when(
          () => client.employeeQuery(any(), any()),
        ).thenAnswer((_) async => jsonEncode(payload));
        await expectLater(
          repo.summary(startDate: '2026-10-01', endDate: '2026-10-31'),
          throwsA(isA<ProtocolError>()),
        );
      }
    },
  );

  test(
    'self check-in preserves explicit decision and device serial compatibility',
    () async {
      when(
        () => client.employeeMutation(
          name: any(named: 'name'),
          args: any(named: 'args'),
        ),
      ).thenAnswer((_) async => '{"granted":true}');
      expect(await repo.selfCheckIn(deviceId: 'device'), isTrue);
      verify(
        () => client.employeeMutation(
          name: 'cardReadings:selfCheckIn',
          args: {'deviceId': 'device'},
        ),
      ).called(1);
      when(
        () => client.employeeMutation(
          name: any(named: 'name'),
          args: any(named: 'args'),
        ),
      ).thenAnswer((_) async => '{"granted":false}');
      expect(await repo.selfCheckIn(deviceSerial: 'serial'), isFalse);
      verify(
        () => client.employeeMutation(
          name: 'cardReadings:selfCheckIn',
          args: {'deviceSerial': 'serial'},
        ),
      ).called(1);
      await expectLater(repo.selfCheckIn(), throwsA(isA<BusinessError>()));
    },
  );

  test(
    'missing or non-boolean granted is protocol failure, never denial or success',
    () async {
      for (final body in [
        '{}',
        '[]',
        'null',
        '{"granted":"true"}',
        '{"granted":null}',
      ]) {
        when(
          () => client.employeeMutation(
            name: any(named: 'name'),
            args: any(named: 'args'),
          ),
        ).thenAnswer((_) async => body);
        await expectLater(
          repo.selfCheckIn(deviceId: 'device'),
          throwsA(isA<ProtocolError>()),
        );
      }
    },
  );

  test(
    'typed errors from transport propagate without becoming empty/denied',
    () async {
      when(
        () => client.employeeQuery(any(), any()),
      ).thenThrow(const AuthExpiredError());
      await expectLater(repo.listPage(), throwsA(isA<AuthExpiredError>()));
      when(
        () => client.employeeMutation(
          name: any(named: 'name'),
          args: any(named: 'args'),
        ),
      ).thenThrow(const BusinessError(message: '', code: 'READER_REQUIRED'));
      await expectLater(
        repo.selfCheckIn(deviceId: 'device'),
        throwsA(isA<BusinessError>()),
      );
    },
  );
}
