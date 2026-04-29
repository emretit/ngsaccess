import 'package:convex_flutter/convex_flutter.dart' as convex_pkg;
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter/foundation.dart';

class ConvexConfig {
  static String get deploymentUrl =>
      dotenv.env['CONVEX_URL'] ?? 'https://notable-tern-4.convex.cloud';

  static convex_pkg.ConvexClient get client => convex_pkg.ConvexClient.instance;

  static Future<void> initialize() async {
    try {
      await dotenv.load(fileName: ".env");
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          'Warning: .env file not found. Falling back to default CONVEX_URL.',
        );
      }
    }

    await convex_pkg.ConvexClient.initialize(
      convex_pkg.ConvexConfig(
        deploymentUrl: deploymentUrl,
        clientId: 'ngsplus-mobile-1.0',
      ),
    );
  }
}

convex_pkg.ConvexClient get convex => ConvexConfig.client;
