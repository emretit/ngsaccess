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
import '../../router/qr_open_intent.dart';
import '../../widgets/ui/ui.dart';

export '../../router/qr_open_intent.dart' show QrTab;

class QRScanScreen extends StatefulWidget {
  const QRScanScreen({
    super.key,
    this.isActive = true,
    this.initialTab = QrTab.code,
    this.scanRequestRevision = 0,
    this.repository,
    this.cameraController,
    this.requestCameraPermission,
    this.cameraPermissionStatus,
    this.openSettings,
  });

  /// The navigation shell must update this for its retained QR branch.
  final bool isActive;
  final QrTab initialTab;
  final int scanRequestRevision;
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
  int? _sessionEpoch;

  bool get _visible => widget.isActive && (_route?.isCurrent ?? true);
  bool get _scanSelected => _tabs.index == 1 && !_tabs.indexIsChanging;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _resumed =
        (WidgetsBinding.instance.lifecycleState ?? AppLifecycleState.resumed) ==
        AppLifecycleState.resumed;
    _tabs = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.initialTab.index,
    )..addListener(_activityChanged);
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
    final auth = context.watch<AuthProvider?>();
    final epoch = auth?.sessionEpoch;
    if (_sessionEpoch != null && epoch != _sessionEpoch) {
      _operationEpoch++;
      _tabs.index = QrTab.code.index;
      _dismissDialog();
    }
    _sessionEpoch = epoch;
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
    if (widget.scanRequestRevision != oldWidget.scanRequestRevision &&
        widget.initialTab == QrTab.scan &&
        widget.scanRequestRevision != 0) {
      _tabs.index = QrTab.scan.index;
    }
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
    return AppScaffold(
      consumeBottomInset: false,
      header: Column(
        children: [
          AppPageHeader(title: l10n.navQr),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: AppSegmentControl<QrTab>(
              segments: [
                AppSegment(value: QrTab.code, label: l10n.qrTabMyQr),
                AppSegment(value: QrTab.scan, label: l10n.qrTabScan),
              ],
              selected: QrTab.values[_tabs.index],
              onChanged: (value) => _tabs.animateTo(value.index),
            ),
          ),
          const SizedBox(height: 16),
        ],
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
    final user = context.watch<AuthProvider?>()?.currentUser;
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = math.min(
          224.0,
          math.max(176.0, constraints.maxWidth - 88),
        );
        return SingleChildScrollView(
          key: const Key('qr-token-scroll'),
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (user != null) ...[
                    Text(
                      '${user.firstName} ${user.lastName}',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    if (user.projectName case final project?)
                      Text(
                        project,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    const SizedBox(height: 24),
                  ],
                  if (tokens == null)
                    AppDataNotice(message: l10n.qrServiceUnavailable),
                  if (token == null && (tokens?.isRefreshing ?? false))
                    AppSkeleton(
                      semanticLabel: l10n.commonLoading,
                      kind: AppSkeletonKind.qr,
                      itemCount: 1,
                    )
                  else if (token != null && canDisplay)
                    Semantics(
                      label: l10n.qrPersonalCode,
                      image: true,
                      child: AppSurface(
                        kind: AppSurfaceKind.qr,
                        padding: const EdgeInsets.all(24),
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
                  const SizedBox(height: 24),
                  if (canDisplay) ...[
                    // Seconds are visual updates, not live-region announcements.
                    SizedBox(
                      width: size + 48,
                      child: Text(
                        l10n.qrRemainingSeconds(
                          tokens?.remaining.inSeconds ?? 0,
                        ),
                        textAlign: TextAlign.end,
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: size + 48,
                      child: LinearProgressIndicator(value: tokens?.progress),
                    ),
                  ],
                  if (token?.status == QrTokenStatus.consumed)
                    AppDataNotice(message: l10n.qrConsumedHint),
                  if (token != null &&
                      token.status != QrTokenStatus.consumed &&
                      (tokens?.remaining == Duration.zero ||
                          token.status == QrTokenStatus.expired))
                    AppDataNotice(message: l10n.qrExpiredHint),
                  if (error != null)
                    AppDataNotice(
                      key: const Key('qr-refresh-error'),
                      title: l10n.qrRefreshFailed,
                      message: localizeAppError(context, error),
                      tone: AppStatusTone.danger,
                    ),
                  if (statusError != null)
                    AppDataNotice(
                      key: const Key('qr-status-error'),
                      message: l10n.qrStatusUnavailable,
                      actionLabel: l10n.qrTryAgain,
                      onAction: tokens?.checkStatus,
                    ),
                  const SizedBox(height: 24),
                  Text(l10n.qrReaderHint, textAlign: TextAlign.center),
                  const SizedBox(height: 20),
                  AppSecondaryButton(
                    key: const Key('qr-refresh'),
                    expanded: true,
                    label: l10n.qrRefresh,
                    icon: Icons.refresh,
                    busy: tokens?.isRefreshing ?? false,
                    onPressed: tokens == null || tokens.isRefreshing
                        ? null
                        : tokens.refresh,
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
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Column(
            children: [
              LayoutBuilder(
                builder: (context, constraints) {
                  final side = math.min(350.0, constraints.maxWidth);
                  final scanWindow = Rect.fromCenter(
                    center: Offset(side / 2, side / 2),
                    width: math.min(224.0, math.max(0, side - 64)),
                    height: math.min(224.0, math.max(0, side - 64)),
                  );
                  return SizedBox(
                    height: side,
                    width: side,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: ColoredBox(
                        color: granted && _cameraError == null
                            ? Colors.black
                            : Theme.of(context).colorScheme.surface,
                        child: Stack(
                          children: [
                            if (granted && _scanSelected && widget.isActive)
                              MobileScanner(
                                key: ObjectKey(_camera),
                                controller: _camera,
                                useAppLifecycleState: false,
                                scanWindow: scanWindow,
                                onDetect: _onDetect,
                                errorBuilder: (context, error) =>
                                    _cameraRecovery(
                                      message:
                                          error.errorCode ==
                                              MobileScannerErrorCode
                                                  .permissionDenied
                                          ? l10n.qrCameraPermissionRequired
                                          : l10n.qrCameraUnavailableRetry,
                                    ),
                              ),
                            if (granted && _cameraError == null)
                              Positioned.fromRect(
                                rect: scanWindow,
                                child: const IgnorePointer(
                                  child: CustomPaint(
                                    painter: _ScanFramePainter(),
                                  ),
                                ),
                              ),
                            if (!granted || _cameraError != null)
                              Positioned.fill(child: _cameraRecovery()),
                            if (_gate.busy)
                              const Positioned.fill(
                                child: ColoredBox(
                                  color: Colors.black54,
                                  child: Center(
                                    child: CircularProgressIndicator(),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 24),
              Text(l10n.qrFrameHint, textAlign: TextAlign.center),
              if (granted && _cameraError == null) ...[
                const SizedBox(height: 16),
                ValueListenableBuilder<MobileScannerState>(
                  valueListenable: _camera,
                  builder: (context, value, _) => Wrap(
                    spacing: 16,
                    children: [
                      IconButton.outlined(
                        tooltip: l10n.qrSwitchCamera,
                        onPressed:
                            _gate.cameraAllowed &&
                                value.isRunning &&
                                (value.availableCameras ?? 0) > 1
                            ? () => _cameraAction(_camera.switchCamera)
                            : null,
                        icon: const Icon(Icons.flip_camera_android),
                      ),
                      IconButton.outlined(
                        tooltip: l10n.qrFlashlight,
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
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _cameraRecovery({String? message}) {
    final permanent =
        _permission == PermissionStatus.permanentlyDenied ||
        _permission == PermissionStatus.restricted;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.camera_alt_outlined,
              color: AppUiTokens.of(context).accent,
              size: 48,
            ),
            const SizedBox(height: 16),
            Text(
              message ??
                  _cameraError ??
                  AppLocalizations.of(context).qrCameraPermissionRequired,
              textAlign: TextAlign.center,
              style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
            ),
            const SizedBox(height: 16),
            AppPrimaryButton(
              onPressed: _permissionBusy
                  ? null
                  : () {
                      if (permanent) {
                        unawaited(_openSettings());
                      } else {
                        unawaited(_checkPermission(request: true));
                      }
                    },
              label: permanent
                  ? AppLocalizations.of(context).qrOpenSettings
                  : _cameraError != null || message != null
                  ? AppLocalizations.of(context).qrTryAgain
                  : AppLocalizations.of(context).qrGrantCameraPermission,
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
        builder: (dialogContext) => AppDialog(
          title: l10n.qrTabTitle,
          body: Text(message),
          confirmLabel: l10n.commonOk,
          onConfirm: () => Navigator.of(dialogContext).pop(),
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

/// The scan window is a camera overlay, independent of the shared UI surfaces.
class _ScanFramePainter extends CustomPainter {
  const _ScanFramePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;
    const radius = 12.0;
    const arm = 28.0;
    for (final corner in [
      Offset.zero,
      Offset(size.width, 0),
      Offset(size.width, size.height),
      Offset(0, size.height),
    ]) {
      final dx = corner.dx == 0 ? 1.0 : -1.0;
      final dy = corner.dy == 0 ? 1.0 : -1.0;
      final path = Path()
        ..moveTo(corner.dx, corner.dy + dy * arm)
        ..lineTo(corner.dx, corner.dy + dy * radius)
        ..quadraticBezierTo(
          corner.dx,
          corner.dy,
          corner.dx + dx * radius,
          corner.dy,
        )
        ..lineTo(corner.dx + dx * arm, corner.dy);
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _ScanFramePainter oldDelegate) => false;
}
