import '../config/convex_config.dart';
import '../models/device.dart';

class DeviceRepository {
  DeviceRepository(this._client);

  final HttpConvexClient _client;

  /// Çalışanın erişim yetkisi olan aktif cihazları döner.
  Future<List<Device>> listForEmployee() async {
    final raw = await _client.employeeQuery('devices:listForEmployee', {});
    return Device.listFromConvexJson(raw);
  }
}
