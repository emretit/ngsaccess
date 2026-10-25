import 'dart:convert';
import '../config/convex_config.dart';
import '../core/errors.dart';
import '../models/employee_request.dart';

class RequestRepository {
  RequestRepository(this._client);
  final HttpConvexClient _client;
  String? get sessionKey => _client.sessionToken;
  T _decode<T>(String raw, T Function(Object?) parse) {
    try {
      return parse(jsonDecode(raw));
    } on FormatException {
      throw const ProtocolError();
    }
  }

  List<T> _list<T>(String raw, T Function(Object?) parse) =>
      _decode(raw, (value) {
        if (value is! List || value.length > 100) throw const ProtocolError();
        return value.map(parse).toList();
      });
  Future<List<LeaveRequest>> listLeaves() async {
    final rows = _list(
      await _client.employeeQuery('leaveRequests:listMine', {}),
      LeaveRequest.fromJson,
    );
    rows.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return rows;
  }

  Future<List<AttendanceCorrectionRequest>> listCorrections() async {
    final rows = _list(
      await _client.employeeQuery('attendanceCorrections:listMine', {}),
      AttendanceCorrectionRequest.fromJson,
    );
    rows.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return rows;
  }

  Future<String> _submit(String name, Map<String, dynamic> args) async =>
      _decode(
        await _client.employeeMutation(name: name, args: args, retry: false),
        (value) {
          if (value is! String || value.isEmpty) throw const ProtocolError();
          return value;
        },
      );
  Future<String> submitLeave({
    required String leaveType,
    required String startDate,
    required String endDate,
    String? notes,
  }) => _submit('leaveRequests:submit', {
    'leaveType': leaveType,
    'startDate': startDate,
    'endDate': endDate,
    if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
  });
  Future<String> submitCorrection({
    required String date,
    required String correctionType,
    required String reason,
    String? requestedCheckIn,
    String? requestedCheckOut,
  }) => _submit('attendanceCorrections:submit', {
    'date': date,
    'correctionType': correctionType,
    'reason': reason.trim(),
    'requestedCheckIn': ?requestedCheckIn,
    'requestedCheckOut': ?requestedCheckOut,
  });
  Future<void> _withdraw(String name, Map<String, dynamic> args) async {
    _decode(
      await _client.employeeMutation(name: name, args: args, retry: false),
      (value) {
        if (value != null) throw const ProtocolError();
        return null;
      },
    );
  }

  Future<void> withdrawLeave(String id) =>
      _withdraw('leaveRequests:withdraw', {'leaveId': id});
  Future<void> withdrawCorrection(String id) =>
      _withdraw('attendanceCorrections:withdraw', {'id': id});
}
