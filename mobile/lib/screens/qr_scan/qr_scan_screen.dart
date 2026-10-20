import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/error_localizer.dart';
import '../../l10n/app_localizations.dart';
import '../../models/qr_code_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/qr_provider.dart';
import '../../repositories/qr_repository.dart';

class QRScanScreen extends StatefulWidget {
  const QRScanScreen({
    super.key,
    this.isActive = true,
    this.repository,
    this.cameraController,
    this.requestCameraPermission,
    this.cameraPermissionStatus,
    this.openSettings,
  });

  /// The navigation shell must update this for its retained QR branch.
  final bool isActive;
  final QrRepository? repository;

  /// Caller-owned controllers must have autoStart:false. The screen starts and
  /// stops them, but only disposes controllers it creates itself.
  final MobileScannerController? cameraController;
  final Future<PermissionStatus> Function()? requestCameraPermission;
  final Future<PermissionStatus> Function()? cameraPermissionStatus;
  final Future<bool> Function()? openSettings;

  @override
  State<QRScanScreen> createState() => _QRScanScreenState();
}

class _QRScanScreenState extends State<QRScanScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final TabController _tabs;
  late MobileScannerController _camera;
  late bool _ownsCamera;
  final _gate = QrScanGate();
  QrRepository? _repository;
  QrProvider? _tokens;
  PermissionStatus? _permission;
  bool _permissionBusy = false;
  bool _resumed = true;
  String? _cameraError;
  ModalRoute<Object?>? _route;
  Future<void> _cameraQueue = Future<void>.value();
  DialogRoute<void>? _dialog;
  NavigatorState? _dialogNavigator;
  int _operationEpoch = 0;

  bool get _visible => widget.isActive && (_route?.isCurrent ?? true);
  bool get _scanSelected => _tabs.index == 1 && !_tabs.indexIsChanging;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _resumed =
        (WidgetsBinding.instance.lifecycleState ?? AppLifecycleState.resumed) ==
        AppLifecycleState.resumed;
    _tabs = TabController(length: 2, vsync: this)
      ..addListener(_activityChanged);
    _attachCamera();
  }

  void _attachCamera() {
    _ownsCamera = widget.cameraController == null;
    _camera =
        widget.cameraController ??
        MobileScannerController(
          autoStart: false,
          formats: const [BarcodeFormat.qrCode],
          detectionSpeed: DetectionSpeed.unrestricted,
        );
    assert(
      !_camera.autoStart,
      'QR camera controllers must use autoStart:false',
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _route = ModalRoute.of(context);
    // Observe auth changes so a retained branch drops the previous account's QR.
    context.watch<AuthProvider?>();
    final repository = widget.repository ?? context.watch<QrRepository?>();
    if (!identical(repository, _repository)) {
      _tokens?.removeListener(_tokenChanged);
      _tokens?.dispose();
      _repository = repository;
      _tokens = repository == null ? null : QrProvider(repository: repository);
      _tokens?.addListener(_tokenChanged);
    }
    _scheduleActivity();
  }

  @override
  void didUpdateWidget(covariant QRScanScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isActive != widget.isActive) {
      _operationEpoch++;
      if (!widget.isActive) _dismissDialog();
    }
    if (!identical(oldWidget.cameraController, widget.cameraController)) {
      final old = _camera;
      final owned = _ownsCamera;
      _cameraQueue = _cameraQueue
          .then((_) async {
            try {
              await old.stop();
            } finally {
              if (owned) await old.dispose();
            }
          })
          .catchError((Object _) {});
      _attachCamera();
    }
    if (!identical(oldWidget.repository, widget.repository)) {
      _tokens?.removeListener(_tokenChanged);
      _tokens?.dispose();
      _repository = widget.repository ?? context.read<QrRepository?>();
      final repository = _repository;
      _tokens = repository == null ? null : QrProvider(repository: repository);
      _tokens?.addListener(_tokenChanged);
    }
    _scheduleActivity();
  }

  void _tokenChanged() {
    if (mounted) setState(() {});
  }

  void _scheduleActivity() {
    // Stop permission/detection eligibility immediately, reconcile platform
    // operations after build so the scanner has attached its controller.
    _updateGate();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _activityChanged();
    });
  }

  void _updateGate() {
    _gate.resumed = _resumed;
    _gate.routeVisible = _visible;
    _gate.scanSelected = _scanSelected;
  }

  void _activityChanged() {
    if (!mounted) return;
    _updateGate();
    _tokens?.synchronizeSession();
    _tokens?.setVisible(
      _resumed && _visible && !_scanSelected && !_gate.modalOpen,
    );
    if (_gate.cameraAllowed &&
        _permission == null &&
        !_permissionBusy &&
        _cameraError == null) {
      unawaited(_checkPermission(request: true));
    }
    _reconcileCamera();
    setState(() {});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _resumed = state == AppLifecycleState.resumed;
    _updateGate();
    if (_resumed && _visible && _scanSelected) {
      unawaited(_checkPermission());
    }
    _activityChanged();
  }

  Future<void> _checkPermission({bool request = false}) async {
    if (_permissionBusy || !mounted) return;
    _permissionBusy = true;
    try {
      final status = request
          ? await (widget.requestCameraPermission?.call() ??
                Permission.camera.request())
          : await (widget.cameraPermissionStatus?.call() ??
                Permission.camera.status);
      if (!mounted) return;
      _permission = status;
      _cameraError = null;
    } catch (_) {
      if (!mounted) return;
      _cameraError = AppLocalizations.of(context).qrCameraUnavailableRetry;
    } finally {
      _permissionBusy = false;
      if (mounted) _activityChanged();
    }
  }

  void _reconcileCamera() {
    final camera = _camera;
    _cameraQueue = _cameraQueue
        .then((_) async {
          final allowed =
              mounted &&
              identical(camera, _camera) &&
              _gate.cameraAllowed &&
              _permission == PermissionStatus.granted &&
              !_permissionBusy &&
              _cameraError == null;
          if (!allowed) {
            await camera.stop();
            return;
          }
          if (!camera.value.isRunning) await camera.start();
          // The app may have paused while start() awaited the platform.
          if (!mounted ||
              !_gate.cameraAllowed ||
              _permissionBusy ||
              _permission != PermissionStatus.granted ||
              !identical(camera, _camera)) {
            await camera.stop();
          }
        })
        .catchError((Object _) async {
          try {
            await camera.stop();
          } catch (_) {
            /* Native recovery is retryable. */
          }
          if (!mounted || !identical(camera, _camera)) return;
          setState(
            () =>
                _cameraError = AppLocalizations.of(context).qrCameraInUseRetry,
          );
        });
  }

  Future<void> _openSettings() async {
    try {
      final opened = await (widget.openSettings?.call() ?? openAppSettings());
      if (!mounted || opened) return;
    } catch (_) {
      if (!mounted) return;
    }
    setState(
      () => _cameraError = AppLocalizations.of(context).qrSettingsUnavailable,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.qrTabTitle),
        bottom: TabBar(
          controller: _tabs,
          tabs: [
            Tab(icon: const Icon(Icons.qr_code), text: l10n.qrTabMyQr),
            Tab(icon: const Icon(Icons.camera_alt), text: l10n.qrTabScan),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [_buildMyQr(), _buildScanner()],
      ),
    );
  }

  Widget _buildMyQr() {
    final l10n = AppLocalizations.of(context);
    final tokens = _tokens;
    final token = tokens?.token;
    final error = tokens?.error;
    final statusError = tokens?.statusError;
    final status = tokens?.status ?? QrViewStatus.empty;
    final canDisplay = tokens?.canDisplay ?? false;
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = math.min(280.0, math.max(1.0, constraints.maxWidth - 80));
        return SingleChildScrollView(
          key: const Key('qr-token-scroll'),
          padding: const EdgeInsets.all(24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (tokens == null)
                    Text(AppLocalizations.of(context).qrServiceUnavailable),
                  if ((tokens?.isRefreshing ?? false) ||
                      (tokens?.isVerifying ?? false))
                    const Padding(
                      padding: EdgeInsets.all(16),
                      child: CircularProgressIndicator(),
                    ),
                  if (token != null && canDisplay)
                    Semantics(
                      label: AppLocalizations.of(context).qrPersonalCode,
                      image: true,
                      child: Container(
                        color: Colors.white,
                        padding: const EdgeInsets.all(16),
                        child: QrImageView(
                          data: token.value,
                          size: size,
                          backgroundColor: Colors.white,
                          errorCorrectionLevel: QrErrorCorrectLevel.M,
                        ),
                      ),
                    )
                  else if (token != null)
                    Padding(
                      padding: const EdgeInsets.all(24),
                      child: Icon(
                        status == QrViewStatus.consumed
                            ? Icons.check_circle_outline
                            : Icons.qr_code_2,
                        size: 88,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  const SizedBox(height: 16),
                  if (canDisplay) ...[
                    LinearProgressIndicator(value: tokens?.progress),
                    const SizedBox(height: 12),
                    Text(
                      l10n.qrRemainingSeconds(tokens?.remaining.inSeconds ?? 0),
                    ),
                  ],
                  if (token?.status == QrTokenStatus.consumed)
                    Text(AppLocalizations.of(context).qrConsumedHint),
                  if (token != null &&
                      token.status != QrTokenStatus.consumed &&
                      (tokens?.remaining == Duration.zero ||
                          token.status == QrTokenStatus.expired))
                    Text(AppLocalizations.of(context).qrExpiredHint),
                  if (error != null) ...[
                    Text(
                      AppLocalizations.of(context).qrRefreshFailed,
                      key: const Key('qr-refresh-error'),
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                    Text(
                      localizeAppError(context, error),
                      textAlign: TextAlign.center,
                    ),
                  ],
                  if (statusError != null) ...[
                    Text(
                      AppLocalizations.of(context).qrStatusUnavailable,
                      key: const Key('qr-status-error'),
                    ),
                    TextButton(
                      onPressed: tokens?.checkStatus,
                      child: Text(l10n.qrTryAgain),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Text(
                    AppLocalizations.of(context).qrReaderHint,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    key: const Key('qr-refresh'),
                    onPressed: tokens == null || tokens.isRefreshing
                        ? null
                        : tokens.refresh,
                    icon: const Icon(Icons.refresh),
                    label: Text(l10n.qrRefresh),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildScanner() {
    final l10n = AppLocalizations.of(context);
    final granted = _permission == PermissionStatus.granted;
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = math.max(
          0.0,
          math.min(
            400.0,
            math.min(constraints.maxWidth - 48, constraints.maxHeight - 160),
          ),
        );
        final scanWindow = Rect.fromCenter(
          center: constraints.biggest.center(Offset.zero),
          width: size,
          height: size,
        );
        return ColoredBox(
          color: Colors.black,
          child: Stack(
            children: [
              if (granted && _scanSelected && widget.isActive)
                MobileScanner(
                  key: ObjectKey(_camera),
                  controller: _camera,
                  useAppLifecycleState: false,
                  scanWindow: size > 0 ? scanWindow : null,
                  onDetect: _onDetect,
                  errorBuilder: (context, error) => _cameraRecovery(),
                ),
              if (granted && _cameraError == null && size > 0)
                Positioned.fromRect(
                  rect: scanWindow,
                  child: IgnorePointer(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.white, width: 3),
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                ),
              if (!granted || _cameraError != null)
                Positioned.fill(child: _cameraRecovery())
              else ...[
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 16,
                  child: Text(
                    l10n.qrFrameHint,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      backgroundColor: Colors.black,
                    ),
                  ),
                ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: ValueListenableBuilder<MobileScannerState>(
                    valueListenable: _camera,
                    builder: (context, value, _) => Wrap(
                      children: [
                        IconButton.filled(
                          tooltip: AppLocalizations.of(context).qrSwitchCamera,
                          onPressed:
                              _gate.cameraAllowed &&
                                  value.isRunning &&
                                  (value.availableCameras ?? 0) > 1
                              ? () => _cameraAction(_camera.switchCamera)
                              : null,
                          icon: const Icon(Icons.flip_camera_android),
                        ),
                        IconButton.filled(
                          tooltip: AppLocalizations.of(context).qrFlashlight,
                          onPressed:
                              _gate.cameraAllowed &&
                                  value.isRunning &&
                                  value.torchState != TorchState.unavailable
                              ? () => _cameraAction(_camera.toggleTorch)
                              : null,
                          icon: Icon(
                            value.torchState == TorchState.on
                                ? Icons.flash_on
                                : Icons.flash_off,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              if (_gate.busy)
                const Positioned.fill(
                  child: ColoredBox(
                    color: Colors.black54,
                    child: Center(child: CircularProgressIndicator()),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _cameraRecovery() {
    final permanent =
        _permission == PermissionStatus.permanentlyDenied ||
        _permission == PermissionStatus.restricted;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.camera_alt_outlined,
              color: Colors.white,
              size: 48,
            ),
            const SizedBox(height: 16),
            Text(
              _cameraError ??
                  AppLocalizations.of(context).qrCameraPermissionRequired,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _permissionBusy
                  ? null
                  : () {
                      if (permanent) {
                        unawaited(_openSettings());
                      } else {
                        unawaited(_checkPermission(request: true));
                      }
                    },
              child: Text(
                permanent
                    ? AppLocalizations.of(context).qrOpenSettings
                    : AppLocalizations.of(context).qrTryAgain,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _cameraAction(Future<void> Function() action) async {
    final camera = _camera;
    _cameraQueue = _cameraQueue
        .then((_) async {
          if (!mounted || !_gate.cameraAllowed || !identical(camera, _camera)) {
            return;
          }
          await action();
          // switchCamera can restart internally after an async platform call.
          if (!mounted || !_gate.cameraAllowed || !identical(camera, _camera)) {
            await camera.stop();
          }
        })
        .catchError((Object _) async {
          try {
            await camera.stop();
          } catch (_) {
            /* Keep the recovery UI usable. */
          }
          if (!mounted || !identical(camera, _camera)) return;
          setState(
            () => _cameraError = AppLocalizations.of(
              context,
            ).qrCameraControlUnavailable,
          );
        });
    await _cameraQueue;
  }

  void _onDetect(BarcodeCapture capture) {
    _updateGate();
    if (_permissionBusy ||
        _permission != PermissionStatus.granted ||
        !_camera.value.isRunning) {
      return;
    }
    final code = _gate.observe(
      capture.barcodes.map((barcode) => barcode.rawValue).whereType<String>(),
    );
    if (code == null) return;
    unawaited(_process(code));
  }

  Future<void> _process(String raw) async {
    final l10n = AppLocalizations.of(context);
    final epoch = _operationEpoch;
    _activityChanged();
    try {
      final payload = QrPayloadParser.parse(raw);
      final message = switch (payload) {
        QrDeviceIdentity() => l10n.qrDeviceIdentityOnly,
        QrEmployeeIdentity() => l10n.qrEmployeeIdentityOnly,
        QrDeviceChallenge() => l10n.qrChallengeUnsupported,
        QrInvalid(reason: QrParseError.expired) => l10n.qrScanExpired,
        QrInvalid(reason: QrParseError.invalidDate) => l10n.qrInvalidDate,
        QrInvalid(reason: QrParseError.unsupportedVersion) =>
          l10n.qrUnsupportedVersion,
        QrInvalid() => l10n.qrInvalidCode,
      };
      if (!mounted || !_visible || epoch != _operationEpoch) return;
      _gate.modalOpen = true;
      _reconcileCamera();
      final navigator = Navigator.of(context);
      final route = DialogRoute<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(l10n.qrTabTitle),
          content: SingleChildScrollView(child: Text(message)),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: Text(l10n.commonOk),
            ),
          ],
        ),
      );
      _dialog = route;
      _dialogNavigator = navigator;
      await navigator.push(route);
    } finally {
      _dialog = null;
      _dialogNavigator = null;
      _gate.modalOpen = false;
      _gate.busy = false;
      if (mounted) _activityChanged();
    }
  }

  void _dismissDialog() {
    final route = _dialog;
    final navigator = _dialogNavigator;
    if (route == null || navigator == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (navigator.mounted && route.isActive) navigator.removeRoute(route);
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _operationEpoch++;
    _gate.routeVisible = false;
    _dismissDialog();
    _tabs.removeListener(_activityChanged);
    _tabs.dispose();
    _tokens?.removeListener(_tokenChanged);
    _tokens?.dispose();
    final camera = _camera;
    final owned = _ownsCamera;
    unawaited(
      _cameraQueue
          .then((_) async {
            try {
              await camera.stop();
            } finally {
              if (owned) await camera.dispose();
            }
          })
          .catchError((Object _) {}),
    );
    super.dispose();
  }
}
