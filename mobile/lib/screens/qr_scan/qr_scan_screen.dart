import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:provider/provider.dart';
import '../../providers/attendance_provider.dart';
import '../../providers/auth_provider.dart';
import '../../models/qr_code_model.dart';
import 'dart:convert';

class QRScanScreen extends StatefulWidget {
  const QRScanScreen({Key? key}) : super(key: key);

  @override
  State<QRScanScreen> createState() => _QRScanScreenState();
}

class _QRScanScreenState extends State<QRScanScreen> with TickerProviderStateMixin {
  late TabController _tabController;
  MobileScannerController cameraController = MobileScannerController();
  bool _isProcessing = false;
  String? _lastScannedCode;
  DateTime? _lastScanTime;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('QR İşlemleri'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(
              icon: Icon(Icons.camera_alt),
              text: 'Tara',
            ),
            Tab(
              icon: Icon(Icons.qr_code),
              text: 'QR Kodum',
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildScannerTab(),
          _buildMyQRTab(),
        ],
      ),
    );
  }

  Widget _buildScannerTab() {
    return Stack(
      children: [
        MobileScanner(
          controller: cameraController,
          onDetect: _onDetect,
        ),
        if (_isProcessing)
          Container(
            color: Colors.black54,
            child: const Center(
              child: CircularProgressIndicator(),
            ),
          ),
        // QR Overlay
        Center(
          child: Container(
            width: MediaQuery.of(context).size.width * 0.8,
            height: MediaQuery.of(context).size.width * 0.8,
            decoration: BoxDecoration(
              border: Border.all(
                color: Theme.of(context).primaryColor,
                width: 4,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Stack(
              children: [
                // Corner indicators
                Positioned(
                  top: 0,
                  left: 0,
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      color: Theme.of(context).primaryColor,
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(12),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: 0,
                  right: 0,
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      color: Theme.of(context).primaryColor,
                      borderRadius: const BorderRadius.only(
                        topRight: Radius.circular(12),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  bottom: 0,
                  left: 0,
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      color: Theme.of(context).primaryColor,
                      borderRadius: const BorderRadius.only(
                        bottomLeft: Radius.circular(12),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      color: Theme.of(context).primaryColor,
                      borderRadius: const BorderRadius.only(
                        bottomRight: Radius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        // Instructions
        Positioned(
          bottom: 100,
          left: 0,
          right: 0,
          child: Container(
            padding: const EdgeInsets.all(16),
            child: const Text(
              'QR kodu kare içine yerleştirin',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ),
        // Camera controls
        Positioned(
          top: 16,
          right: 16,
          child: Column(
            children: [
                             FloatingActionButton(
                 mini: true,
                 heroTag: "camera",
                 onPressed: () => cameraController.switchCamera(),
                 child: const Icon(Icons.flip_camera_android),
               ),
               const SizedBox(height: 8),
               FloatingActionButton(
                 mini: true,
                 heroTag: "flash",
                 onPressed: () => cameraController.toggleTorch(),
                 child: const Icon(Icons.flash_on),
               ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildMyQRTab() {
    return Consumer<AuthProvider>(
      builder: (context, authProvider, child) {
        if (authProvider.user == null) {
          return const Center(
            child: Text('Kullanıcı bilgileri yükleniyor...'),
          );
        }

        final qrData = _generateUserQRData(authProvider);
        
        return Container(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // QR Code
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 10,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: QrImageView(
                  data: qrData,
                  version: QrVersions.auto,
                  size: 250.0,
                  backgroundColor: Colors.white,
                  foregroundColor: Colors.black,
                  errorCorrectionLevel: QrErrorCorrectLevel.M,
                ),
              ),
              const SizedBox(height: 24),
              // User info
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Kullanıcı Bilgileri',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text('Ad: ${authProvider.user?.userMetadata?['full_name'] ?? 'Bilinmiyor'}'),
                      Text('E-posta: ${authProvider.user?.email ?? 'Bilinmiyor'}'),
                      Text('ID: ${authProvider.user?.id ?? 'Bilinmiyor'}'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              // Instructions
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Theme.of(context).primaryColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'Bu QR kodu başkalarının size yoklama işlemi yapması için kullanılır. '
                  'QR kodunuzu gösterin ve diğer kişilerin kamerasına okutun.',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.black87,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 16),
              // Refresh button
              ElevatedButton.icon(
                onPressed: () {
                  setState(() {
                    // QR kodunu yenile
                  });
                },
                icon: const Icon(Icons.refresh),
                label: const Text('QR Kodunu Yenile'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  String _generateUserQRData(AuthProvider authProvider) {
    final now = DateTime.now();
    final userData = {
      'type': 'user_qr',
      'user_id': authProvider.user?.id,
      'user_name': authProvider.user?.userMetadata?['full_name'] ?? 'Bilinmiyor',
      'user_email': authProvider.user?.email,
      'timestamp': now.toIso8601String(),
      'expires_at': now.add(const Duration(hours: 24)).toIso8601String(),
      'app_version': '1.0.0',
      'device_type': 'mobile',
    };
    
    return jsonEncode(userData);
  }

  void _onDetect(BarcodeCapture capture) async {
    if (_isProcessing) return;

    final List<Barcode> barcodes = capture.barcodes;
    final Barcode? barcode = barcodes.isNotEmpty ? barcodes.first : null;

    if (barcode == null || barcode.rawValue == null) return;

    final now = DateTime.now();
    if (_lastScannedCode == barcode.rawValue && 
        _lastScanTime != null &&
        now.difference(_lastScanTime!).inSeconds < 3) {
      return; // Aynı QR kodu 3 saniye içinde tekrar taramayı engelle
    }

    _lastScannedCode = barcode.rawValue;
    _lastScanTime = now;

    await _processQRCode(barcode.rawValue!);
  }

  Future<void> _processQRCode(String qrData) async {
    setState(() => _isProcessing = true);

    try {
      // QR kod türünü belirle
      Map<String, dynamic> parsedData;
      
      try {
        parsedData = jsonDecode(qrData);
      } catch (e) {
        // Eski format QR kodları için
        parsedData = QRCodeGenerator.parseQRData(qrData);
      }

      if (parsedData['type'] == 'user_qr') {
        // Kullanıcı QR kodu okutuldu
        await _processUserQRCode(parsedData);
      } else {
        // Cihaz QR kodu okutuldu
        await _processDeviceQRCode(qrData, parsedData);
      }
    } catch (e) {
      _showErrorDialog('QR kod işlenirken bir hata oluştu: $e');
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  Future<void> _processUserQRCode(Map<String, dynamic> userData) async {
    _showInfoDialog(
      'Kullanıcı QR Kodu',
      'Kullanıcı: ${userData['user_name']}\n'
      'E-posta: ${userData['user_email']}\n'
      'Tarih: ${userData['timestamp']}',
    );
  }

  Future<void> _processDeviceQRCode(String qrData, Map<String, dynamic> parsedData) async {
    if (!parsedData['is_valid']) {
      _showErrorDialog(parsedData['error'] ?? 'Geçersiz QR kod');
      return;
    }

    final attendanceProvider = Provider.of<AttendanceProvider>(context, listen: false);
    
    // Giriş/çıkış durumunu belirle
    final type = attendanceProvider.hasCheckedInToday 
        ? (attendanceProvider.hasCheckedOutToday ? 'check_in' : 'check_out')
        : 'check_in';

    // QR kod verisini kaydet
    final success = await attendanceProvider.recordAttendance(
      qrData,
      type,
      deviceId: parsedData['device_id'],
      location: parsedData['location'],
    );

    if (success) {
      _showSuccessDialog(
        type == 'check_in' ? 'Giriş Başarılı' : 'Çıkış Başarılı',
        parsedData,
      );
    } else {
      _showErrorDialog(attendanceProvider.errorMessage ?? 'Bir hata oluştu');
    }
  }

  void _showSuccessDialog(String message, Map<String, dynamic> deviceInfo) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Başarılı'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(message),
            const SizedBox(height: 8),
            Text('Cihaz: ${deviceInfo['device_name']}'),
            Text('Konum: ${deviceInfo['location']}'),
            if (deviceInfo['timestamp'] != null)
              Text('Zaman: ${DateTime.parse(deviceInfo['timestamp']).toString()}'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  void _showErrorDialog(String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Hata'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  void _showInfoDialog(String title, String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    cameraController.dispose();
    super.dispose();
  }
} 