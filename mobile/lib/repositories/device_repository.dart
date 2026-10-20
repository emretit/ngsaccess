import '../config/convex_config.dart';
import '../core/errors.dart';
import '../models/device.dart';

class DeviceRepository {
  DeviceRepository(this._client);

  final HttpConvexClient _client;

  /// Employee identity and target permissions are derived from the server session.
  /// Multiple doors on one controller remain distinct targets.
  Future<List<Device>> listForEmployee() async {
    final raw = await _client.employeeQuery('mobileAccess:listTargets', {});
    try {
      return Device.listFromConvexJson(raw, requireTargetMetadata: true);
    } on FormatException {
      throw const ProtocolError();
    }
  }
}
