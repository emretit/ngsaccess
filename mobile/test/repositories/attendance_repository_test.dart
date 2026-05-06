import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/repositories/attendance_repository.dart';

import '../helpers/mocks.dart';

void main() {
  late MockHttpConvexClient client;
  late AttendanceRepository repo;

  setUpAll(registerCommonFallbacks);

  setUp(() {
    client = MockHttpConvexClient();
    repo = AttendanceRepository(client);
  });

  group('AttendanceRepository.list', () {
    test('JSON list\'i Attendance listesine parse eder', () async {
      final body = jsonEncode([
        {
          '_id': 'a1',
          'employeeId': 'e1',
          'deviceId': 'd1',
          'cardNo': '1234',
          'employeeName': 'Test User',
          'accessTime': '2026-01-01T09:00:00Z',
          'accessStatus': 'izin_verildi',
        }
      ]);
      when(() => client.employeeQuery(any(), any()))
          .thenAnswer((_) async => body);

      final result = await repo.list(limit: 10);

      expect(result.length, 1);
      expect(result.first.id, 'a1');
      expect(result.first.granted, isTrue);
    });

    test('boş listede boş liste döner', () async {
      when(() => client.employeeQuery(any(), any()))
          .thenAnswer((_) async => '[]');

      final result = await repo.list();
      expect(result, isEmpty);
    });
  });

  group('AttendanceRepository.selfCheckIn', () {
    test('deviceId Convex Id gönderir, granted=true döner', () async {
      when(
        () => client.employeeMutation(
          name: any(named: 'name'),
          args: any(named: 'args'),
        ),
      ).thenAnswer((_) async => jsonEncode({'granted': true}));

      final granted = await repo.selfCheckIn(deviceId: 'j-device-1');

      expect(granted, isTrue);
      verify(
        () => client.employeeMutation(
          name: 'cardReadings:selfCheckIn',
          args: {'deviceId': 'j-device-1'},
        ),
      ).called(1);
    });

    test('deviceSerial fallback kullanır', () async {
      when(
        () => client.employeeMutation(
          name: any(named: 'name'),
          args: any(named: 'args'),
        ),
      ).thenAnswer((_) async => jsonEncode({'granted': false}));

      final granted = await repo.selfCheckIn(deviceSerial: 'SER-001');

      expect(granted, isFalse);
      verify(
        () => client.employeeMutation(
          name: 'cardReadings:selfCheckIn',
          args: {'deviceSerial': 'SER-001'},
        ),
      ).called(1);
    });

    test('hiç device bilgisi yoksa BusinessError fırlatır', () {
      expect(
        () => repo.selfCheckIn(),
        throwsA(isA<BusinessError>()),
      );
    });
  });
}
