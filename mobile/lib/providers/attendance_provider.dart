import 'dart:async';

import 'package:flutter/foundation.dart';

import '../config/convex_config.dart';
import '../core/errors.dart';
import '../models/attendance.dart';
import '../models/qr_code_model.dart';
import '../repositories/attendance_repository.dart';
import 'auth_provider.dart';

class AttendanceProvider extends ChangeNotifier {
  AttendanceProvider({required AttendanceRepository repository})
    : _repo = repository;

  final AttendanceRepository _repo;

  static const int _pageSize = 50;

  List<Attendance> _attendanceRecords = [];
  bool _isLoading = false;
  bool _isLoadingMore = false;
  bool _hasMore = true;
  int _currentLimit = _pageSize;
  String? _errorMessage;
  AppError? _lastError;
  AuthProvider? _authProvider;

  ConvexSubscriptionHandle? _subscription;
  String? _subscribedUserId;

  List<Attendance> get attendanceRecords => _attendanceRecords;
  bool get isLoading => _isLoading;
  bool get isLoadingMore => _isLoadingMore;
  bool get hasMore => _hasMore;
  String? get errorMessage => _errorMessage;
  AppError? get lastError => _lastError;

  List<Attendance> get _todayGranted {
    final today = DateTime.now();
    final start = DateTime(today.year, today.month, today.day);
    final end = start.add(const Duration(days: 1));
    return _attendanceRecords
        .where(
          (a) =>
              a.granted &&
              a.accessTime.isAfter(start) &&
              a.accessTime.isBefore(end),
        )
        .toList();
  }

  Attendance? get todayAttendance {
    final granted = _todayGranted;
    if (granted.isEmpty) return null;
    return granted.first;
  }

  /// Bugünün ilk giriş kaydı (`direction == entry`).
  DateTime? get firstEntryToday {
    final entries = _todayGranted.where((a) => a.isEntry).toList();
    if (entries.isEmpty) return null;
    entries.sort((a, b) => a.accessTime.compareTo(b.accessTime));
    return entries.first.accessTime;
  }

  /// Bugünün son giriş kaydı (`direction == entry`).
  DateTime? get lastEntryToday {
    final entries = _todayGranted.where((a) => a.isEntry).toList();
    if (entries.isEmpty) return null;
    entries.sort((a, b) => b.accessTime.compareTo(a.accessTime));
    return entries.first.accessTime;
  }

  /// Bugünün son çıkış kaydı (`direction == exit`).
  DateTime? get lastExitToday {
    final exits = _todayGranted.where((a) => a.isExit).toList();
    if (exits.isEmpty) return null;
    exits.sort((a, b) => b.accessTime.compareTo(a.accessTime));
    return exits.first.accessTime;
  }

  /// İlk giriş + son çıkış dışında kalan ek hareket sayısı (öğle molası vs.).
  int get extraMovementsToday {
    final extra = _todayGranted.length - 2;
    return extra > 0 ? extra : 0;
  }

  /// Gösterilen son girişin dışında kalan ek giriş sayısı.
  int get extraEntryMovementsToday {
    final entries = _todayGranted.where((a) => a.isEntry).length;
    return entries > 1 ? entries - 1 : 0;
  }

  /// Gösterilen son çıkışın dışında kalan ek çıkış sayısı.
  int get extraExitMovementsToday {
    final exits = _todayGranted.where((a) => a.isExit).length;
    return exits > 1 ? exits - 1 : 0;
  }

  bool get hasCheckedInToday => firstEntryToday != null;

  /// Bugünün en son onaylanmış hareketi (entry veya exit fark etmez).
  Attendance? get _latestMovementToday {
    final granted = _todayGranted;
    if (granted.isEmpty) return null;
    final sorted = [...granted]
      ..sort((a, b) => b.accessTime.compareTo(a.accessTime));
    return sorted.first;
  }

  bool get hasCheckedOutToday => _latestMovementToday?.isExit ?? false;

  AttendanceStatus get attendanceStatus {
    final latest = _latestMovementToday;
    if (latest == null) return AttendanceStatus.none;
    return latest.isExit ? AttendanceStatus.out : AttendanceStatus.inside;
  }

  void setAuthProvider(AuthProvider authProvider) {
    final newId = authProvider.currentUser?.id;
    if (newId == _subscribedUserId && _subscription != null) {
      _authProvider = authProvider;
      return;
    }
    _authProvider = authProvider;
    _subscribedUserId = newId;
    if (newId != null) {
      _currentLimit = _pageSize;
      _hasMore = true;
      _ensureSubscription();
    } else {
      _cancelSubscription();
      _attendanceRecords = [];
      _currentLimit = _pageSize;
      _hasMore = true;
      notifyListeners();
    }
  }

  Future<void> _ensureSubscription() async {
    await _cancelSubscription();
    try {
      _subscription = await _repo.subscribe(
        limit: _currentLimit,
        onUpdate: (records) {
          _attendanceRecords = records;
          _hasMore = records.length >= _currentLimit;
          _errorMessage = null;
          notifyListeners();
        },
        onError: _handleSubscriptionError,
      );
    } on AppError catch (e) {
      _handleSubscriptionError(e);
    } catch (error, stack) {
      _handleSubscriptionError(AppError.fromException(error, stack));
    }
  }

  /// Backend'den bir sonraki sayfayı çeker (limit'i artırıp subscription'ı
  /// yeni limit ile yeniden kurar). Mevcut subscription polling'i koruyarak
  /// daha fazla kayıt yüklenir.
  Future<void> loadMore() async {
    if (_isLoadingMore || !_hasMore) return;
    if (_subscribedUserId == null) return;

    _isLoadingMore = true;
    notifyListeners();

    try {
      _currentLimit += _pageSize;
      await _ensureSubscription();
    } finally {
      _isLoadingMore = false;
      notifyListeners();
    }
  }

  void _handleSubscriptionError(AppError error) {
    if (kDebugMode) {
      debugPrint('cardReadings subscription error: ${error.debugMessage}');
    }
    if (error is AuthExpiredError) {
      _cancelSubscription();
      _authProvider?.handleAuthExpiry();
      return;
    }
    _lastError = error;
    _errorMessage = error.userMessage;
    notifyListeners();
  }

  Future<void> _cancelSubscription() async {
    final sub = _subscription;
    _subscription = null;
    if (sub == null) return;
    try {
      sub.cancel();
    } catch (_) {}
  }

  /// Subscription polling'ini beklemeden listeyi tazeler. Self check-in
  /// gibi yerel mutasyonlardan sonra UI'ın anında güncellenmesi için kullanılır.
  Future<void> _silentRefresh() async {
    if (_authProvider?.currentUser == null) return;
    try {
      final fresh = await _repo.list(limit: _currentLimit);
      _attendanceRecords = fresh;
      _hasMore = fresh.length >= _currentLimit;
      notifyListeners();
    } catch (_) {
      // Sessiz başarısızlık — polling bir sonraki turda yine deneyecek.
    }
  }

  Future<void> loadAttendanceRecords() async {
    final user = _authProvider?.currentUser;
    if (user == null) return;

    _isLoading = true;
    _errorMessage = null;
    _lastError = null;
    notifyListeners();

    try {
      _attendanceRecords = await _repo.list(limit: _currentLimit);
      _hasMore = _attendanceRecords.length >= _currentLimit;
    } on AuthExpiredError {
      await _authProvider?.handleAuthExpiry();
    } on AppError catch (e) {
      _lastError = e;
      _errorMessage = e.userMessage;
    } catch (error, stack) {
      final mapped = AppError.fromException(error, stack);
      _lastError = mapped;
      _errorMessage = mapped.userMessage;
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

    final deviceIdRaw = parsed['deviceId'] as String?;
    final deviceSerial = (parsed['deviceSerial'] as String?) ?? deviceIdRaw;

    // Convex Id'leri tipik olarak 'j' veya 'k' ile başlar.
    final isConvexId = deviceIdRaw != null && deviceIdRaw.startsWith('j');
    final deviceId = isConvexId ? deviceIdRaw : null;
    final serial = isConvexId ? null : deviceSerial;

    return _performSelfCheckIn(deviceId: deviceId, deviceSerial: serial);
  }

  /// Programatik kapı açma — QR scan'i atlayıp seçili cihaza doğrudan
  /// `selfCheckIn` mutation'ı atar. Erişim kuralı server'da değerlendirilir.
  Future<bool> quickUnlock(String deviceId) {
    return _performSelfCheckIn(deviceId: deviceId, deviceSerial: null);
  }

  Future<bool> _performSelfCheckIn({
    required String? deviceId,
    required String? deviceSerial,
  }) async {
    final user = _authProvider?.currentUser;
    if (user == null) return false;

    try {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      final granted = await _repo.selfCheckIn(
        deviceId: deviceId,
        deviceSerial: deviceSerial,
      );
      if (!granted) {
        _errorMessage = 'Erişim reddedildi';
      } else {
        unawaited(_silentRefresh());
      }
      return granted;
    } on AuthExpiredError {
      await _authProvider?.handleAuthExpiry();
      return false;
    } on AppError catch (e) {
      _lastError = e;
      _errorMessage = e.userMessage;
      return false;
    } catch (error, stack) {
      final mapped = AppError.fromException(error, stack);
      _lastError = mapped;
      _errorMessage = mapped.userMessage;
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

  int get daysElapsedThisMonth => DateTime.now().day;

  /// Aydaki her benzersiz güne ait ilk onaylanmış girişi döner.
  Map<DateTime, DateTime> get _firstCheckInByDay {
    final now = DateTime.now();
    final firstDay = DateTime(now.year, now.month, 1);
    final result = <DateTime, DateTime>{};
    for (final r in _attendanceRecords) {
      if (!r.granted) continue;
      if (r.accessTime.isBefore(firstDay) || r.accessTime.isAfter(now)) {
        continue;
      }
      final day = DateTime(
        r.accessTime.year,
        r.accessTime.month,
        r.accessTime.day,
      );
      final existing = result[day];
      if (existing == null || r.accessTime.isBefore(existing)) {
        result[day] = r.accessTime;
      }
    }
    return result;
  }

  int get daysPresent => _firstCheckInByDay.length;

  /// İlk girişi geç eşiğinden sonra olan benzersiz gün sayısı.
  int get daysLate {
    const lateAfter = Duration(hours: 9);
    return _firstCheckInByDay.values.where((time) {
      final t = Duration(hours: time.hour, minutes: time.minute);
      return t > lateAfter;
    }).length;
  }

  int get daysOnTime {
    final present = daysPresent;
    final late = daysLate;
    return present > late ? present - late : 0;
  }

  void clearError() {
    _errorMessage = null;
    _lastError = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _cancelSubscription();
    super.dispose();
  }
}

enum AttendanceStatus { none, inside, out }
