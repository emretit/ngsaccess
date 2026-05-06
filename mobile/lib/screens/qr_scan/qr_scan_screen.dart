import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../config/convex_config.dart';
import '../../core/error_localizer.dart';
import '../../core/errors.dart';
import '../../l10n/app_localizations.dart';
import '../../models/qr_code_model.dart';
import '../../providers/attendance_provider.dart';

class QRScanScreen extends StatefulWidget {
  const QRScanScreen({super.key});

  @override
  State<QRScanScreen> createState() => _QRScanScreenState();
}

class _QRScanScreenState extends State<QRScanScreen> with TickerProviderStateMixin {
  late TabController _tabController;
  MobileScannerController cameraController = MobileScannerController();
  bool _isProcessing = false;
  String? _lastScannedCode;
  DateTime? _lastScanTime;

  // Dinamik check-in token state (10 sn geçerli, cihaz QR'ı kart gibi okur)
  String? _checkInToken;
  DateTime? _checkInExpiresAt;
  DateTime? _checkInIssuedAt;
  bool _tokenLoading = false;
  String? _tokenError;
  Timer? _tokenTicker;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _refreshCheckInToken();
  }

  Future<void> _refreshCheckInToken() async {
    if (!mounted) return;
    setState(() {
      _tokenLoading = true;
      _tokenError = null;
    });
    try {
      final raw = await convex.employeeMutation(
        name: 'employeeCheckIn:createMyCheckInToken',
        args: const {},
      );
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) {
        throw Exception(
          mounted ? AppLocalizations.of(context).qrInvalidResponse : 'Invalid response',
        );
      }
      final token = decoded['token'] as String?;
      final expiresAtStr = decoded['expiresAt'] as String?;
      if (token == null || expiresAtStr == null) {
        throw Exception(
          mounted ? AppLocalizations.of(context).qrTokenMissing : 'Token missing',
        );
      }
      if (!mounted) return;
      setState(() {
        _checkInToken = token;
        _checkInExpiresAt = DateTime.parse(expiresAtStr);
        _checkInIssuedAt = DateTime.now();
        _tokenLoading = false;
      });
      _ensureTokenTicker();
    } catch (e) {
      if (!mounted) return;
      final message = e is AppError ? e.userMessage : e.toString().replaceFirst('Exception: ', '');
      setState(() {
        _tokenLoading = false;
        _tokenError = message;
      });
    }
  }

  void _ensureTokenTicker() {
    _tokenTicker?.cancel();
    _tokenTicker = Timer.periodic(const Duration(milliseconds: 100), (_) {
      if (!mounted) return;
      // Süre dolduysa ticker'ı durdur (gereksiz redraw yok)
      if (_isTokenExpired()) {
        _tokenTicker?.cancel();
      }
      setState(() {});
    });
  }

  bool _isTokenExpired() {
    final expiresAt = _checkInExpiresAt;
    if (expiresAt == null) return false;
    return !DateTime.now().isBefore(expiresAt);
  }

  double _tokenProgress() {
    final issuedAt = _checkInIssuedAt;
    final expiresAt = _checkInExpiresAt;
    if (issuedAt == null || expiresAt == null) return 0;
    final total = expiresAt.difference(issuedAt).inMilliseconds;
    if (total <= 0) return 0;
    final remaining = expiresAt.difference(DateTime.now()).inMilliseconds;
    return (remaining / total).clamp(0.0, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.qrTabTitle),
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(
              icon: const Icon(Icons.qr_code),
              text: l10n.qrTabMyQr,
            ),
            Tab(
              icon: const Icon(Icons.camera_alt),
              text: l10n.qrTabScan,
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildMyQRTab(),
          _buildScannerTab(),
        ],
      ),
    );
  }

  Widget _buildScannerTab() {
    final l10n = AppLocalizations.of(context);
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
        // QR Overlay — tablet/landscape'de 400px'i geçmesin.
        Center(
          child: Container(
            width: math.min(MediaQuery.of(context).size.width * 0.8, 400),
            height: math.min(MediaQuery.of(context).size.width * 0.8, 400),
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
            child: Text(
              l10n.qrFrameHint,
              textAlign: TextAlign.center,
              style: const TextStyle(
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

  Widget _buildQrWithExpiry(String token) {
    final l10n = AppLocalizations.of(context);
    final expired = _isTokenExpired();
    return Stack(
      alignment: Alignment.center,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.1),
                blurRadius: 10,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Opacity(
            opacity: expired ? 0.25 : 1.0,
            child: QrImageView(
              data: token,
              version: QrVersions.auto,
              size: 250.0,
              backgroundColor: Colors.white,
              eyeStyle: const QrEyeStyle(
                eyeShape: QrEyeShape.square,
                color: Colors.black,
              ),
              dataModuleStyle: const QrDataModuleStyle(
                dataModuleShape: QrDataModuleShape.square,
                color: Colors.black,
              ),
              errorCorrectionLevel: QrErrorCorrectLevel.M,
            ),
          ),
        ),
        if (expired)
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: _tokenLoading ? null : _refreshCheckInToken,
              borderRadius: BorderRadius.circular(80),
              child: Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  color: Theme.of(context).primaryColor,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Theme.of(context)
                          .primaryColor
                          .withValues(alpha: 0.4),
                      blurRadius: 20,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: _tokenLoading
                    ? const Center(
                        child: SizedBox(
                          width: 32,
                          height: 32,
                          child: CircularProgressIndicator(
                            strokeWidth: 3,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        ),
                      )
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.refresh,
                            color: Colors.white,
                            size: 40,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            l10n.qrRefresh,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildMyQRTab() {
    final l10n = AppLocalizations.of(context);
    final token = _checkInToken;
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (_tokenLoading && token == null)
            const Padding(
              padding: EdgeInsets.all(40),
              child: CircularProgressIndicator(),
            )
          else if (_tokenError != null && token == null)
            Column(
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                const SizedBox(height: 12),
                Text(
                  _tokenError!,
                  style: const TextStyle(color: Colors.red),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: _refreshCheckInToken,
                  icon: const Icon(Icons.refresh),
                  label: Text(l10n.qrTryAgain),
                ),
              ],
            )
          else if (token != null) ...[
            _buildQrWithExpiry(token),
            const SizedBox(height: 20),
            // Daralan progress bar
            SizedBox(
              width: 250,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: LinearProgressIndicator(
                  value: _tokenProgress(),
                  minHeight: 8,
                  backgroundColor: Colors.grey.withValues(alpha: 0.2),
                  valueColor: AlwaysStoppedAnimation<Color>(
                    _isTokenExpired()
                        ? Colors.red
                        : Theme.of(context).primaryColor,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.grey.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                l10n.qrTokenHint,
                style: const TextStyle(fontSize: 14, color: Colors.black87),
                textAlign: TextAlign.center,
              ),
            ),
          ]
          else
            Column(
              children: [
                const Icon(Icons.qr_code_2, size: 64, color: Colors.grey),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: _refreshCheckInToken,
                  icon: const Icon(Icons.refresh),
                  label: Text(l10n.qrRefresh),
                ),
              ],
            ),
        ],
      ),
    );
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
    final l10n = AppLocalizations.of(context);
    setState(() => _isProcessing = true);

    try {
      Map<String, dynamic> parsedData;

      try {
        parsedData = jsonDecode(qrData);
      } catch (e) {
        parsedData = QRCodeGenerator.parseQRData(qrData);
      }

      if (parsedData['type'] == 'user_qr') {
        await _processUserQRCode(parsedData);
      } else {
        await _processDeviceQRCode(qrData, parsedData);
      }
    } catch (e) {
      _showErrorDialog(l10n.qrProcessError(e.toString()));
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  Future<void> _processUserQRCode(Map<String, dynamic> userData) async {
    final l10n = AppLocalizations.of(context);
    _showInfoDialog(
      l10n.qrUserCodeTitle,
      l10n.qrUserCodeBody(
        (userData['user_name'] ?? '-').toString(),
        (userData['user_email'] ?? '-').toString(),
        (userData['timestamp'] ?? '-').toString(),
      ),
    );
  }

  Future<void> _processDeviceQRCode(String qrData, Map<String, dynamic> parsedData) async {
    final l10n = AppLocalizations.of(context);
    if (!parsedData['is_valid']) {
      _showErrorDialog(parsedData['error'] ?? l10n.qrInvalidCode);
      return;
    }

    final attendanceProvider = Provider.of<AttendanceProvider>(context, listen: false);
    final success = await attendanceProvider.recordAttendance(qrData);

    if (!mounted) return;
    if (success) {
      _showSuccessDialog(l10n.qrAccessGranted, parsedData);
    } else {
      final msg = attendanceProvider.lastError != null
          ? localizeAppError(context, attendanceProvider.lastError!)
          : (attendanceProvider.errorMessage ?? l10n.qrUnknownError);
      _showErrorDialog(msg);
    }
  }

  void _showSuccessDialog(String message, Map<String, dynamic> deviceInfo) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.commonSuccess),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(message),
            const SizedBox(height: 8),
            Text(l10n.qrDeviceLine((deviceInfo['deviceName'] ?? '-').toString())),
            Text(l10n.qrLocationLine((deviceInfo['location'] ?? '-').toString())),
            if (deviceInfo['timestamp'] != null)
              Text(l10n.qrTimeLine(DateTime.parse(deviceInfo['timestamp'].toString()).toString())),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.commonOk),
          ),
        ],
      ),
    );
  }

  void _showErrorDialog(String message) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.commonError),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.commonOk),
          ),
        ],
      ),
    );
  }

  void _showInfoDialog(String title, String message) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.commonOk),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _tokenTicker?.cancel();
    _tabController.dispose();
    cameraController.dispose();
    super.dispose();
  }
}
