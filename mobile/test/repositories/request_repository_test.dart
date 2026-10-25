import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/models/employee_request.dart';
import 'package:ngsplusapp/repositories/request_repository.dart';
import '../helpers/mocks.dart';

Map<String, Object?> leaveJson({
  String status = 'pending',
  String type = 'annual',
}) => {
  '_id': 'l1',
  'leaveType': type,
  'startDate': '2026-10-20',
  'endDate': '2026-10-21',
  'status': status,
  'source': 'employee',
  'createdAt': '2026-10-19T10:00:00Z',
};
Map<String, Object?> correctionJson() => {
  '_id': 'c1',
  'date': '2026-10-19',
  'correctionType': 'checkIn',
  'requestedCheckIn': '08:00',
  'reason': 'Gerekçe yeterli',
  'status': 'withdrawn',
  'createdAt': '2026-10-19T10:00:00Z',
};
void main() {
  setUpAll(registerCommonFallbacks);
  late MockHttpConvexClient client;
  late RequestRepository repo;
  setUp(() {
    client = MockHttpConvexClient();
    repo = RequestRepository(client);
  });
  test(
    'leave notes are trimmed, blank notes omitted, and correction reason trimmed',
    () async {
      when(
        () => client.employeeMutation(
          name: any(named: 'name'),
          args: any(named: 'args'),
          retry: false,
        ),
      ).thenAnswer((_) async => '"id"');
      for (final notes in [null, '', '  \t\n  ']) {
        await repo.submitLeave(
          leaveType: 'annual',
          startDate: '2026-10-20',
          endDate: '2026-10-21',
          notes: notes,
        );
      }
      await repo.submitLeave(
        leaveType: 'annual',
        startDate: '2026-10-20',
        endDate: '2026-10-21',
        notes: '  Özgün not  ',
      );
      await repo.submitCorrection(
        date: '2026-10-19',
        correctionType: 'checkIn',
        requestedCheckIn: '09:00',
        reason: '  Gerekçe  ',
      );
      verify(
        () => client.employeeMutation(
          name: 'leaveRequests:submit',
          args: {
            'leaveType': 'annual',
            'startDate': '2026-10-20',
            'endDate': '2026-10-21',
          },
          retry: false,
        ),
      ).called(3);
      verify(
        () => client.employeeMutation(
          name: 'leaveRequests:submit',
          args: {
            'leaveType': 'annual',
            'startDate': '2026-10-20',
            'endDate': '2026-10-21',
            'notes': 'Özgün not',
          },
          retry: false,
        ),
      ).called(1);
      verify(
        () => client.employeeMutation(
          name: 'attendanceCorrections:submit',
          args: {
            'date': '2026-10-19',
            'correctionType': 'checkIn',
            'requestedCheckIn': '09:00',
            'reason': 'Gerekçe',
          },
          retry: false,
        ),
      ).called(1);
      verifyNoMoreInteractions(client);
    },
  );
  test(
    'all six endpoint names and arguments, no mutation retries or employee identity',
    () async {
      when(
        () => client.employeeQuery(any(), any()),
      ).thenAnswer((_) async => '[]');
      when(
        () => client.employeeMutation(
          name: any(named: 'name'),
          args: any(named: 'args'),
          retry: false,
        ),
      ).thenAnswer(
        (call) async =>
            (call.namedArguments[#name] as String).endsWith(':submit')
            ? '"id"'
            : 'null',
      );
      await repo.listLeaves();
      await repo.listCorrections();
      await repo.submitLeave(
        leaveType: 'annual',
        startDate: '2026-10-20',
        endDate: '2026-10-21',
      );
      await repo.submitCorrection(
        date: '2026-10-19',
        correctionType: 'checkOut',
        reason: 'Gerekçe',
        requestedCheckOut: '17:00',
      );
      await repo.withdrawLeave('l1');
      await repo.withdrawCorrection('c1');
      verify(
        () => client.employeeQuery('leaveRequests:listMine', {}),
      ).called(1);
      verify(
        () => client.employeeQuery('attendanceCorrections:listMine', {}),
      ).called(1);
      verify(
        () => client.employeeMutation(
          name: 'leaveRequests:submit',
          args: {
            'leaveType': 'annual',
            'startDate': '2026-10-20',
            'endDate': '2026-10-21',
          },
          retry: false,
        ),
      ).called(1);
      verify(
        () => client.employeeMutation(
          name: 'attendanceCorrections:submit',
          args: {
            'date': '2026-10-19',
            'correctionType': 'checkOut',
            'reason': 'Gerekçe',
            'requestedCheckOut': '17:00',
          },
          retry: false,
        ),
      ).called(1);
      verify(
        () => client.employeeMutation(
          name: 'leaveRequests:withdraw',
          args: {'leaveId': 'l1'},
          retry: false,
        ),
      ).called(1);
      verify(
        () => client.employeeMutation(
          name: 'attendanceCorrections:withdraw',
          args: {'id': 'c1'},
          retry: false,
        ),
      ).called(1);
      verifyNoMoreInteractions(client);
    },
  );
  test('decode and newest first; unknown enum rows stay in list', () async {
    when(() => client.employeeQuery('leaveRequests:listMine', {})).thenAnswer(
      (_) async => jsonEncode([
        leaveJson(),
        {
          ...leaveJson(status: 'future', type: 'future'),
          '_id': 'l2',
          'createdAt': '2026-10-20T10:00:00Z',
        },
      ]),
    );
    final rows = await repo.listLeaves();
    expect(rows.map((r) => r.id), ['l2', 'l1']);
    expect(rows.first.canWithdraw, false);
    when(
      () => client.employeeQuery('attendanceCorrections:listMine', {}),
    ).thenAnswer((_) async => jsonEncode([correctionJson()]));
    expect((await repo.listCorrections()).single.canWithdraw, false);
  });
  test(
    'malformed envelopes, required fields and optional field types are ProtocolError',
    () async {
      for (final payload in [
        'bad',
        '{}',
        '[null]',
        jsonEncode([
          {...leaveJson(), 'status': 5},
        ]),
        jsonEncode([
          {...leaveJson(), 'startDate': '2026-02-30'},
        ]),
        jsonEncode([
          {...leaveJson(), 'decisionNote': 3},
        ]),
        jsonEncode([
          {...leaveJson(), 'createdAt': 'bad'},
        ]),
        jsonEncode([Map.of(leaveJson())..remove('leaveType')]),
      ]) {
        when(
          () => client.employeeQuery('leaveRequests:listMine', {}),
        ).thenAnswer((_) async => payload);
        await expectLater(repo.listLeaves(), throwsA(isA<ProtocolError>()));
      }
      for (final payload in [
        '[null]',
        jsonEncode([
          {...correctionJson(), 'reason': null},
        ]),
        jsonEncode([
          {...correctionJson(), 'requestedCheckIn': '24:00'},
        ]),
      ]) {
        when(
          () => client.employeeQuery('attendanceCorrections:listMine', {}),
        ).thenAnswer((_) async => payload);
        await expectLater(
          repo.listCorrections(),
          throwsA(isA<ProtocolError>()),
        );
      }
      when(
        () => client.employeeMutation(
          name: any(named: 'name'),
          args: any(named: 'args'),
          retry: false,
        ),
      ).thenAnswer((_) async => '{}');
      await expectLater(
        repo.withdrawLeave('id'),
        throwsA(isA<ProtocolError>()),
      );
      await expectLater(
        repo.submitLeave(
          leaveType: 'annual',
          startDate: '2026-10-20',
          endDate: '2026-10-20',
        ),
        throwsA(isA<ProtocolError>()),
      );
    },
  );
  test('withdraw eligibility uses both source and status', () {
    for (final status in ['approved', 'rejected', 'withdrawn', 'future']) {
      expect(
        LeaveRequest.fromJson(leaveJson(status: status)).canWithdraw,
        false,
      );
    }
    for (final source in [null, 'admin', 'future']) {
      expect(
        LeaveRequest.fromJson({...leaveJson(), 'source': source}).canWithdraw,
        false,
      );
    }
    expect(LeaveRequest.fromJson(leaveJson()).canWithdraw, true);
  });
}
