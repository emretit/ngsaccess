import 'dart:convert';

import '../config/convex_config.dart';
import '../core/attendance_date.dart';
import '../core/errors.dart';
import '../models/attendance.dart';
import '../models/attendance_page.dart';
import '../models/attendance_summary.dart';

/// Employee identity is always derived by employeeQuery/employeeMutation.
class AttendanceRepository {
  AttendanceRepository(this._client);
  final HttpConvexClient _client;

  T _decode<T>(String raw, T Function(Object?) parse) {
    try {
      return parse(jsonDecode(raw));
    } on FormatException {
      // Never include the body or the malformed value in diagnostics/UI.
      throw const ProtocolError();
    }
  }

  AttendancePage _decodePage(String raw, int numItems) {
    final result = _decode(raw, AttendancePage.fromJson);
    if (result.page.length > numItems) throw const ProtocolError();
    return result;
  }

  /// Compatibility read; new consumers should use the explicit page contract.
  Future<List<Attendance>> list({int limit = 50}) async {
    final raw = await _client.employeeQuery('cardReadings:listForEmployee', {
      'limit': limit,
    });
    return _decode(raw, Attendance.decodeList);
  }

  Map<String, dynamic> _pageArgs({
    String? cursor,
    int numItems = 50,
    String? startDate,
    String? endDate,
    String? deviceId,
  }) {
    AttendanceDate.validateRange(startDate, endDate);
    if (numItems < 1 || numItems > 100) {
      throw ArgumentError.value(numItems, 'numItems');
    }
    final args = <String, dynamic>{'cursor': cursor, 'numItems': numItems};
    if (startDate != null) {
      args['startDate'] = startDate;
    }
    if (endDate != null) {
      args['endDate'] = endDate;
    }
    if (deviceId != null && deviceId.isNotEmpty) {
      args['deviceId'] = deviceId;
    }
    return args;
  }

  Future<AttendancePage> listPage({
    String? cursor,
    int numItems = 50,
    String? startDate,
    String? endDate,
    String? deviceId,
  }) async {
    final raw = await _client.employeeQuery(
      'mobileAttendance:listPage',
      _pageArgs(
        cursor: cursor,
        numItems: numItems,
        startDate: startDate,
        endDate: endDate,
        deviceId: deviceId,
      ),
    );
    return _decodePage(raw, numItems);
  }

  Future<AttendanceSummary> summary({
    required String startDate,
    required String endDate,
  }) async {
    AttendanceDate.validateRange(startDate, endDate);
    final raw = await _client.employeeQuery('mobileAttendance:summary', {
      'startDate': startDate,
      'endDate': endDate,
    });
    return _decode(raw, (json) {
      final result = AttendanceSummary.fromJson(json);
      if (result.startDate != startDate || result.endDate != endDate) {
        throw const FormatException('Unexpected summary range');
      }
      return result;
    });
  }

  /// This bool represents a server access decision, never physical door success.
  Future<bool> selfCheckIn({String? deviceId, String? deviceSerial}) async {
    final args = <String, dynamic>{};
    if (deviceId != null && deviceId.isNotEmpty) {
      args['deviceId'] = deviceId;
    } else if (deviceSerial != null && deviceSerial.isNotEmpty) {
      args['deviceSerial'] = deviceSerial;
    } else {
      throw const BusinessError(
        message: 'QR kodda cihaz bilgisi yok',
        code: 'INVALID_DEVICE',
      );
    }
    final raw = await _client.employeeMutation(
      name: 'cardReadings:selfCheckIn',
      args: args,
    );
    return _decode(raw, (json) {
      if (json is! Map<String, dynamic> || json['granted'] is! bool) {
        throw const FormatException('Invalid access decision');
      }
      return json['granted'] as bool;
    });
  }

  Future<ConvexSubscriptionHandle> subscribePage({
    required void Function(AttendancePage) onUpdate,
    required void Function(AppError) onError,
    int numItems = 50,
    String? startDate,
    String? endDate,
    String? deviceId,
  }) => _client.subscribeEmployeeQuery(
    name: 'mobileAttendance:listPage',
    args: _pageArgs(
      numItems: numItems,
      startDate: startDate,
      endDate: endDate,
      deviceId: deviceId,
    ),
    onUpdate: (raw) => onUpdate(_decodePage(raw, numItems)),
    onError: onError,
  );

  Future<ConvexSubscriptionHandle> subscribe({
    required void Function(List<Attendance>) onUpdate,
    required void Function(AppError) onError,
    int limit = 50,
  }) => _client.subscribeEmployeeQuery(
    name: 'cardReadings:listForEmployee',
    args: {'limit': limit},
    onUpdate: (raw) => onUpdate(_decode(raw, Attendance.decodeList)),
    onError: onError,
  );
}
