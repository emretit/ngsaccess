import 'package:http/http.dart' as http;
import 'package:mocktail/mocktail.dart';
import 'package:ngsplusapp/config/convex_config.dart';
import 'package:ngsplusapp/repositories/attendance_repository.dart';
import 'package:ngsplusapp/repositories/auth_repository.dart';

class MockHttpClient extends Mock implements http.Client {}

class MockHttpConvexClient extends Mock implements HttpConvexClient {}

class MockAuthRepository extends Mock implements AuthRepository {}

class MockAttendanceRepository extends Mock implements AttendanceRepository {}

/// `setUpAll` fallback'leri — `mocktail` `any()` matcher'ı için karmaşık tipleri
/// burada register ederiz.
void registerCommonFallbacks() {
  registerFallbackValue(<String, dynamic>{});
  registerFallbackValue(Uri.parse('https://example.com'));
}
