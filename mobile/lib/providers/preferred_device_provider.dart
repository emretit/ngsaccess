import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Hızlı kapı açma butonu için kullanıcının tercih ettiği cihazı saklar.
/// Mekanizma: SharedPreferences (theme_provider örüntüsü).
class PreferredDeviceProvider extends ChangeNotifier {
  static const _kDeviceIdKey = 'mobile_preferred_device_id';
  static const _kDeviceNameKey = 'mobile_preferred_device_name';

  String? _deviceId;
  String? _deviceName;

  String? get deviceId => _deviceId;
  String? get deviceName => _deviceName;
  bool get hasDevice => _deviceId != null && _deviceId!.isNotEmpty;

  Future<void> bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    _deviceId = prefs.getString(_kDeviceIdKey);
    _deviceName = prefs.getString(_kDeviceNameKey);
    notifyListeners();
  }

  Future<void> setDevice({required String id, required String name}) async {
    _deviceId = id;
    _deviceName = name;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kDeviceIdKey, id);
    await prefs.setString(_kDeviceNameKey, name);
  }

  Future<void> clear() async {
    _deviceId = null;
    _deviceName = null;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kDeviceIdKey);
    await prefs.remove(_kDeviceNameKey);
  }
}
