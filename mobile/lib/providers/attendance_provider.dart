import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:convex_flutter/convex_flutter.dart' as convex_pkg;

import '../config/convex_config.dart';
import '../models/attendance.dart';
import '../models/qr_code_model.dart';
import 'auth_provider.dart';

class AttendanceProvider extends ChangeNotifier {
  List<Attendance> _attendanceRecords = [];
  bool _isLoading = false;
  String? _errorMessage;
  AuthProvider? _authProvider;

  convex_pkg.SubscriptionHandle? _subscription;
  String? _subscribedUserId;

  List<Attendance> get attendanceRecords => _attendanceRecords;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Attendance? get todayAttendance {
    final today = DateTime.now();
    final start = DateTime(today.year, today.month, today.day);
    final end = start.add(const Duration(days: 1));
    final granted = _attendanceRecords.where((a) =>
        a.granted &&
        a.accessTime.isAfter(start) &&
        a.accessTime.isBefore(end));
    if (granted.isEmpty) return null;
    return granted.first;
  }

  bool get hasCheckedInToday => todayAttendance != null;
  bool get hasCheckedOutToday => false;

  void setAuthProvider(AuthProvider authProvider) {
    final newId = authProvider.currentUser?.id;
    if (newId == _subscribedUserId && _subscription != null) {
      _authProvider = authProvider;
      return;
    }
    _authProvider = authProvider;
    _subscribedUserId = newId;
    if (newId != null) {
      _ensureSubscription();
    } else {
      _cancelSubscription();
      _attendanceRecords = [];
      notifyListeners();
    }
  }

  Future<void> _ensureSubscription() async {
    await _cancelSubscription();
    try {
      _subscription = await convex.subscribe(
        name: 'cardReadings:listForEmployee',
        args: {'limit': 50},
        onUpdate: _onSubscriptionUpdate,
        onError: (message, value) {
          if (kDebugMode) {
            debugPrint('cardReadings subscription error: $message');
          }
          _errorMessage = message;
          notifyListeners();
        },
      );
    } catch (e) {
      _errorMessage = 'Aboneliğe başlanamadı: $e';
      notifyListeners();
    }
  }

  Future<void> _cancelSubscription() async {
    final sub = _subscription;
    _subscription = null;
    if (sub == null) return;
    try {
      sub.cancel();
    } catch (_) {}
  }

  void _onSubscriptionUpdate(String raw) {
    _attendanceRecords = Attendance.listFromConvexJson(raw);
    _errorMessage = null;
    notifyListeners();
  }

  Future<void> loadAttendanceRecords() async {
    final user = _authProvider?.currentUser;
    if (user == null) return;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final raw = await convex.query('cardReadings:listForEmployee', {'limit': 50});
      _attendanceRecords = Attendance.listFromConvexJson(raw);
    } catch (e) {
      _errorMessage = 'Kayıtlar yüklenemedi: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Mobile QR check-in. QR yükündeki `deviceId` (Convex Id) veya `deviceSerial`
  /// kullanılır. Server access kuralını değerlendirir.
  Future<bool> recordAttendance(String qrData) async {
    final user = _authProvider?.currentUser;
    if (user == null) return false;

    _errorMessage = null;
    final parsed = QRCodeGenerator.parseQRData(qrData);
    if (parsed['is_valid'] != true) {
      _errorMessage = parsed['error'] as String? ?? 'Geçersiz QR kod';
      notifyListeners();
      return false;
    }

    final deviceIdRaw = parsed['deviceId']?.toString();
    final deviceSerial = parsed['deviceSerial']?.toString() ?? deviceIdRaw;

    final args = <String, dynamic>{};
    if (deviceIdRaw != null && deviceIdRaw.startsWith('j')) {
      // Convex Id'leri tipik olarak 'j' veya 'k' ile başlar.
      args['deviceId'] = deviceIdRaw;
    } else if (deviceSerial != null && deviceSerial.isNotEmpty) {
      args['deviceSerial'] = deviceSerial;
    } else {
      _errorMessage = 'QR kodda cihaz bilgisi yok';
      notifyListeners();
      return false;
    }

    try {
      _isLoading = true;
      notifyListeners();
      final raw = await convex.mutation(name: 'cardReadings:selfCheckIn', args: args);
      final result = jsonDecode(raw);
      final granted = result is Map<String, dynamic> && result['granted'] == true;
      if (!granted) {
        _errorMessage = 'Erişim reddedildi';
      }
      return granted;
    } catch (e) {
      _errorMessage = 'Check-in başarısız: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  int get totalDaysThisMonth {
    final now = DateTime.now();
    final lastDay = DateTime(now.year, now.month + 1, 0);
    return lastDay.day;
  }

  int get daysPresent {
    final now = DateTime.now();
    final firstDay = DateTime(now.year, now.month, 1);
    final dates = _attendanceRecords
        .where((r) => r.granted && r.accessTime.isAfter(firstDay) && r.accessTime.isBefore(now))
        .map((r) => DateTime(r.accessTime.year, r.accessTime.month, r.accessTime.day))
        .toSet();
    return dates.length;
  }

  int get timesLate {
    const lateAfter = Duration(hours: 9);
    return _attendanceRecords.where((r) {
      if (!r.granted) return false;
      final t = Duration(hours: r.accessTime.hour, minutes: r.accessTime.minute);
      return t > lateAfter;
    }).length;
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _cancelSubscription();
    super.dispose();
  }
}
