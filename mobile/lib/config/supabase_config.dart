import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter/foundation.dart';

class SupabaseConfig {
  // Environment variables'dan değerleri al
  static String get supabaseUrl => dotenv.env['SUPABASE_URL'] ?? 'YOUR_SUPABASE_URL';
  static String get supabaseAnonKey => dotenv.env['SUPABASE_ANON_KEY'] ?? 'YOUR_SUPABASE_ANON_KEY';
  
  static SupabaseClient get client => Supabase.instance.client;
  
  static Future<void> initialize() async {
    // .env dosyasını yükle
    try {
      await dotenv.load(fileName: ".env");
    } catch (e) {
      // .env dosyası yoksa uyarı ver
      if (kDebugMode) {
        debugPrint('Warning: .env file not found. Please create one with SUPABASE_URL and SUPABASE_ANON_KEY');
      }
    }
    
    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
    );
  }
}

// Supabase client için kısayol
final supabase = SupabaseConfig.client; 