import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:ngsplusapp/config/convex_config.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/models/attendance.dart';
import 'package:ngsplusapp/providers/attendance_provider.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/repositories/auth_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../helpers/mocks.dart';

void main() {
  late MockAttendanceRepository attRepo;
  late MockAuthRepository authRepo;
  late AttendanceProvider provider;
  late AuthProvider auth;

  setUpAll(() {
    registerCommonFallbacks();
    SharedPreferences.setMockInitialValues({});
  });

  Future<void> signInUser() async {
    when(() => authRepo.signIn(
          email: any(named: 'email'),
          password: any(named: 'password'),
        )).thenAnswer((_) async => SignInResult(
          token: 'tok',
          expiresAt: null,
          user: const AuthUser(
            id: 'u1',
            email: 'a@b.c',
            firstName: 'A',
            lastName: 'B',
            cardNumber: '1',
          ),
        ));
    await auth.signIn('a@b.c', 'p');
  }

  ConvexSubscriptionHandle fakeSubHandle() {
    // İlk yangında zaten cancel edileceği için 1 saatlik dummy timer yeterli.
    final timer = Timer(const Duration(hours: 1), () {});
    return ConvexSubscriptionHandle(timer);
  }

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await ConvexConfig.initialize();
    attRepo = MockAttendanceRepository();
    authRepo = MockAuthRepository();
    auth = AuthProvider(repository: authRepo);
    provider = AttendanceProvider(repository: attRepo);

    // Default subscribe mock — setAuthProvider çağrıldığında side effect'i sustur.
    when(() => attRepo.subscribe(
          onUpdate: any(named: 'onUpdate'),
          onError: any(named: 'onError'),
          limit: any(named: 'limit'),
        )).thenAnswer((_) async => fakeSubHandle());
  });

  group('loadAttendanceRecords', () {
    test('user yoksa erken return + state değişmez', () async {
      await provider.loadAttendanceRecords();
      expect(provider.attendanceRecords, isEmpty);
      expect(provider.isLoading, isFalse);
    });

    test('başarılı yüklemede records güncellenir', () async {
      await signInUser();
      provider.setAuthProvider(auth);

      final attendance = Attendance(
        id: 'a1',
        employeeId: 'u1',
        deviceId: 'd1',
        cardNo: '1234',
        employeeName: 'Test',
        accessTime: DateTime(2026, 1, 1, 9, 0),
        granted: true,
      );
      when(() => attRepo.list(limit: any(named: 'limit')))
          .thenAnswer((_) async => [attendance]);

      await provider.loadAttendanceRecords();

      expect(provider.attendanceRecords.length, 1);
      expect(provider.attendanceRecords.first.id, 'a1');
      expect(provider.errorMessage, isNull);
    });

    test('AppError fırlarsa errorMessage + lastError set', () async {
      await signInUser();
      provider.setAuthProvider(auth);

      when(() => attRepo.list(limit: any(named: 'limit')))
          .thenThrow(const NetworkError('offline'));

      await provider.loadAttendanceRecords();

      expect(provider.lastError, isA<NetworkError>());
      expect(provider.errorMessage, isNotNull);
    });

    test('AuthExpiredError → auth.handleAuthExpiry tetikler', () async {
      await signInUser();
      provider.setAuthProvider(auth);
      expect(auth.isAuthenticated, isTrue);

      when(() => attRepo.list(limit: any(named: 'limit')))
          .thenThrow(const AuthExpiredError('expired'));

      await provider.loadAttendanceRecords();

      expect(auth.isAuthenticated, isFalse);
      expect(auth.lastError, isA<AuthExpiredError>());
    });
  });

  group('recordAttendance', () {
    test('user yoksa false döner', () async {
      final ok = await provider.recordAttendance('whatever');
      expect(ok, isFalse);
    });

    test('geçersiz QR → errorMessage set + false', () async {
      await signInUser();
      provider.setAuthProvider(auth);

      final ok = await provider.recordAttendance('not-a-valid-qr');

      expect(ok, isFalse);
      expect(provider.errorMessage, isNotNull);
    });
  });

  group('todayAttendance + hasCheckedInToday', () {
    test('granted=false kayıtları sayılmaz', () async {
      await signInUser();
      provider.setAuthProvider(auth);

      when(() => attRepo.list(limit: any(named: 'limit')))
          .thenAnswer((_) async => [
                Attendance(
                  id: 'a',
                  employeeId: 'u1',
                  deviceId: 'd',
                  cardNo: '1',
                  employeeName: 'U',
                  accessTime: DateTime.now(),
                  granted: false,
                )
              ]);

      await provider.loadAttendanceRecords();

      expect(provider.hasCheckedInToday, isFalse);
      expect(provider.todayAttendance, isNull);
    });
  });
}
