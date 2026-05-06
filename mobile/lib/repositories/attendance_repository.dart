import 'dart:convert';

import '../config/convex_config.dart';
import '../core/errors.dart';
import '../models/attendance.dart';

/// Convex `cardReadings.*` çağrılarını domain modeline ve [AppError]'a çevirir.
class AttendanceRepository {
  AttendanceRepository(this._client);

  final HttpConvexClient _client;

  Future<List<Attendance>> list({int limit = 50}) async {
    final raw = await _client.employeeQuery(
      'cardReadings:listForEmployee',
      {'limit': limit},
    );
    return Attendance.listFromConvexJson(raw);
  }

  /// QR yükündeki cihaz bilgisi kullanılarak self check-in yapar.
  /// `deviceId` ve `deviceSerial`'dan en az biri verilmelidir.
  Future<bool> selfCheckIn({String? deviceId, String? deviceSerial}) async {
    final args = <String, dynamic>{};
    if (deviceId != null && deviceId.isNotEmpty) {
      args['deviceId'] = deviceId;
    } else if (deviceSerial != null && deviceSerial.isNotEmpty) {
      args['deviceSerial'] = deviceSerial;
    } else {
      throw const BusinessError(message: 'QR kodda cihaz bilgisi yok');
    }

    final raw = await _client.employeeMutation(
      name: 'cardReadings:selfCheckIn',
      args: args,
    );
    final decoded = jsonDecode(raw);
    return decoded is Map<String, dynamic> && decoded['granted'] == true;
  }

  /// Periyodik polling ile attendance listesi günceller. Her güncellemede
  /// [onUpdate] çağrılır; hata olursa [onError] çağrılır (subscription devam eder).
  Future<ConvexSubscriptionHandle> subscribe({
    required void Function(List<Attendance>) onUpdate,
    required void Function(AppError) onError,
    int limit = 50,
  }) {
    return _client.subscribeEmployeeQuery(
      name: 'cardReadings:listForEmployee',
      args: {'limit': limit},
      onUpdate: (raw) => onUpdate(Attendance.listFromConvexJson(raw)),
      onError: onError,
    );
  }
}
