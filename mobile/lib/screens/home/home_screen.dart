import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/attendance_date.dart';
import '../../core/spacing.dart';
import '../../core/error_localizer.dart';
import '../../core/errors.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/attendance_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/door_operation_provider.dart';
import '../../models/device.dart';
import '../../models/door_operation.dart';
import '../../repositories/device_repository.dart';
import '../../providers/preferred_device_provider.dart';
import '../../router/route_paths.dart';
import '../../router/qr_open_intent.dart';
import '../../widgets/ui/ui.dart';
import '../../widgets/brand_mark.dart';
import '../../widgets/door_operation_recovery_dialog.dart';
import '../../widgets/cards/attendance_status_card.dart';
import '../../widgets/cards/door_command_status_card.dart';
import '../../widgets/responsive_container.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  Timer? _clockTimer;
  bool _preparingCommand = false;
  bool _recoveryOpen = false;
  int? _preparationEpoch;
  int _preparationAttempt = 0;
  bool _isAppActive = true;
  String _businessDay = AttendanceDate.instantKey(DateTime.now());
  @override
  void initState() {
    super.initState();
    _isAppActive =
        WidgetsBinding.instance.lifecycleState == null ||
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;
    WidgetsBinding.instance.addObserver(this);
    _clockTimer = Timer.periodic(
      const Duration(minutes: 1),
      (_) => _updateClock(),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(_loadData());
    });
  }

  void _updateClock() {
    if (!mounted || !_isAppActive) return;
    final day = AttendanceDate.instantKey(DateTime.now());
    if (day != _businessDay) {
      _businessDay = day;
      unawaited(_loadData());
    }
    setState(() {});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _isAppActive = state == AppLifecycleState.resumed;
    if (_isAppActive) _updateClock();
  }

  @override
  void dispose() {
    _clockTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _loadData() async {
    if (!mounted) return;
    final commands = context.read<DoorOperationProvider>();
    await Future.wait([
      context.read<AttendanceProvider>().loadDailySummary(),
      if (commands.hasUnresolvedOperation) commands.checkStatus(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      brandedSystemBar: true,
      consumeBottomInset: false,
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildHeader(),
              ResponsiveContainer(
                maxWidth: AppSpacing.contentMaxWidth,
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: _buildQuickActions(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final l10n = AppLocalizations.of(context);
    final user = context.watch<AuthProvider>().currentUser;
    final name = user == null
        ? l10n.homeGreetingFallback
        : '${user.firstName} ${user.lastName}'.trim();
    final now = DateTime.now();
    return AppBrandBand(
      brandMark: const BrandMark.band(),
      consumeTopInset: false,
      title: l10n.homeGreetingLine(_getGreeting(l10n), name),
      subtitle: user?.projectName,
      trailing: user == null
          ? null
          : CircleAvatar(
              radius: 16,
              backgroundColor: AppUiTokens.of(context).bandAvatarBackground,
              foregroundColor: AppUiTokens.of(context).onBand,
              child: Text(
                [
                  if (user.firstName.isNotEmpty)
                    user.firstName.characters.first,
                  if (user.lastName.isNotEmpty) user.lastName.characters.first,
                ].join(),
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: AppUiTokens.of(context).onBand,
                ),
              ),
            ),
      dateLabel: AppDateFormat(
        locale: Localizations.localeOf(context),
        now: now,
      ).headingDate(now),
      overlapChild: _buildAttendanceStatusCard(),
    );
  }

  Widget _buildAttendanceStatusCard() {
    final attendance = context.watch<AttendanceProvider>();
    final error = attendance.summaryError;
    return AttendanceStatusCard(
      status: attendance.attendanceStatus,
      isLoading: attendance.isSummaryLoading,
      hasLoaded: attendance.hasSummaryLoaded,
      isStatusKnown: attendance.isTodayStatusKnown,
      errorMessage: error == null ? null : localizeAppError(context, error),
      updatedAt: attendance.summaryUpdatedAt,
      onRetry: () => unawaited(_loadData()),
      firstEntry: attendance.firstEntryToday,
      firstEntryDoorName: _movementDoor(
        attendance,
        attendance.firstEntryToday,
        entry: true,
      ),
      lastEntryDoorName: _movementDoor(
        attendance,
        attendance.lastEntryToday,
        entry: true,
      ),
      lastExitDoorName: _movementDoor(
        attendance,
        attendance.lastExitToday,
        entry: false,
      ),
      lastEntry: attendance.lastEntryToday,
      lastExit: attendance.lastExitToday,
      extraEntryCount: attendance.extraEntryMovementsToday,
      extraExitCount: attendance.extraExitMovementsToday,
    );
  }

  String? _movementDoor(
    AttendanceProvider attendance,
    DateTime? time, {
    required bool entry,
  }) {
    if (time == null) return null;
    for (final movement in attendance.attendanceRecords) {
      if (movement.granted &&
          movement.accessTime.isAtSameMomentAs(time) &&
          (entry ? movement.isEntry : movement.isExit) &&
          movement.doorName.trim().isNotEmpty) {
        return movement.doorName;
      }
    }
    return null;
  }

  Widget _buildQuickActions() {
    final l10n = AppLocalizations.of(context);
    final preferred = context.watch<PreferredDeviceProvider>();
    final commands = context.watch<DoorOperationProvider>();
    final auth = context.watch<AuthProvider>();
    final preparing =
        _preparingCommand && _preparationEpoch == auth.sessionEpoch;
    final busy =
        preparing ||
        (!commands.hasUnresolvedOperation &&
            (commands.isLoading || preferred.isSaving));
    final uncertain =
        commands.operation?.status == DoorOperationStatus.unknown ||
        (commands.hasUnresolvedOperation &&
            commands.operation == null &&
            !commands.isLoading);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppPrimaryButton(
          label: l10n.homeScanQr,
          icon: Icons.qr_code_scanner,
          onPressed: () => context.go(
            AppRoute.qr,
            extra: QrOpenIntent.requestScan(sessionEpoch: auth.sessionEpoch),
          ),
        ),
        const SizedBox(height: 12),
        if (commands.operation != null || commands.hasUnresolvedOperation) ...[
          DoorCommandStatusCard(
            operation: commands.operation,
            hasUnresolvedOperation: commands.hasUnresolvedOperation,
            isLoading: commands.isLoading,
            isSending: preparing && commands.isLoading,
            error: commands.error,
            onCheckStatus: () => unawaited(_showRecovery(commands, auth)),
            onRetrySameRequest: () => unawaited(_showRecovery(commands, auth)),
          ),
          const SizedBox(height: 12),
        ],
        AppListGroup(
          children: [
            AppListRow(
              key: const Key('home-open-door'),
              leadingIcon: Icons.door_front_door_outlined,
              title: l10n.quickActionUnlock,
              subtitle: uncertain
                  ? l10n.homeCommandUnknown
                  : busy
                  ? (preparing && commands.isLoading
                        ? l10n.homeCommandSending
                        : l10n.homeDataLoading)
                  : preferred.deviceName ?? l10n.homeChooseDoor,
              enabled: auth.isAuthenticated && !busy,
              showChevron: true,
              onTap: () => unawaited(_handleQuickUnlock(preferred, commands)),
            ),
          ],
        ),
        const SizedBox(height: 16),
        AppListGroup(
          children: [
            AppListRow(
              leadingIcon: Icons.assignment_outlined,
              title: l10n.requestsTitle,
              showChevron: true,
              onTap: () => context.push(AppRoute.requests),
            ),
            AppListRow(
              leadingIcon: Icons.person_add_alt_1,
              title: l10n.visitorAddButton,
              showChevron: true,
              onTap: () => context.go(AppRoute.visitor),
            ),
          ],
        ),
      ],
    );
  }

  Future<void> _showRecovery(
    DoorOperationProvider commands,
    AuthProvider auth,
  ) async {
    if (!auth.isAuthenticated || _recoveryOpen) return;
    _recoveryOpen = true;
    try {
      await showDialog<void>(
        context: context,
        builder: (_) =>
            DoorOperationRecoveryDialog(commands: commands, auth: auth),
      );
    } finally {
      _recoveryOpen = false;
    }
  }

  Future<void> _handleQuickUnlock(
    PreferredDeviceProvider preferred,
    DoorOperationProvider commands,
  ) async {
    final auth = context.read<AuthProvider>();
    final epoch = auth.sessionEpoch;
    final sessionToken = auth.sessionToken;
    if (!auth.isAuthenticated) return;
    if (_preparingCommand && _preparationEpoch == epoch) return;
    if (commands.hasUnresolvedOperation) {
      await _showRecovery(commands, auth);
      return;
    }
    if (commands.isLoading || preferred.isSaving) {
      return;
    }
    if (!preferred.hasDevice) {
      if (preferred.wasInvalidated) {
        _showDeviceSelectionNotice(true);
      } else {
        await context.push(AppRoute.selectDevice);
      }
      return;
    }
    final generation = preferred.identityGeneration;
    final selectedDevice = preferred.deviceId;
    final selectedDoor = preferred.doorId;
    final selectedTarget = preferred.targetId;
    bool sameSelection() =>
        preferred.deviceId == selectedDevice &&
        preferred.doorId == selectedDoor &&
        (selectedTarget == null || preferred.targetId == selectedTarget);
    final attempt = ++_preparationAttempt;
    final devices = context.read<DeviceRepository>();
    bool owns() =>
        mounted &&
        attempt == _preparationAttempt &&
        epoch == auth.sessionEpoch &&
        generation == preferred.identityGeneration;
    setState(() {
      _preparationEpoch = epoch;
      _preparingCommand = true;
    });
    try {
      final available = await devices.listForEmployee();
      if (!mounted) return;
      if (!owns() || !sameSelection()) return;
      final saved = await preferred.revalidate(available);
      if (!mounted) return;
      if (!owns()) return;
      if (!preferred.hasDevice) {
        _showDeviceSelectionNotice(true);
        return;
      }
      if (!sameSelection() || preferred.isSaving) return;
      if (!saved) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocalizations.of(context).preferenceSaveFailed),
          ),
        );
        return;
      }
      Device? target;
      for (final device in available) {
        if (device.id == preferred.deviceId &&
            device.doorId == preferred.doorId &&
            device.targetId == preferred.targetId) {
          target = device;
          break;
        }
      }
      if (target == null || target.canOpen != true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocalizations.of(context).homeNoOpenableDoor),
          ),
        );
        return;
      }
      await commands.open(deviceId: target.id, doorId: target.doorId);
    } catch (error, stack) {
      if (!mounted || !owns()) return;
      final mapped = AppError.fromException(error, stack);
      if (mapped is AuthExpiredError) {
        await auth.handleAuthExpiry(
          reason: mapped,
          sessionToken: sessionToken,
          sessionEpoch: epoch,
        );
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(localizeAppError(context, mapped))),
      );
    } finally {
      if (owns()) setState(() => _preparingCommand = false);
    }
  }

  void _showDeviceSelectionNotice(bool invalidated) {
    final l10n = AppLocalizations.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          invalidated ? l10n.homeDoorUnavailable : l10n.unlockNoDeviceSelected,
        ),
        action: SnackBarAction(
          label: l10n.quickActionProfile,
          onPressed: () {
            if (mounted) context.go(AppRoute.profile);
          },
        ),
      ),
    );
  }

  String _getGreeting(AppLocalizations l10n) {
    final hour = AttendanceDate.businessTime(DateTime.now()).hour;
    if (hour < 12) {
      return l10n.homeGreetingMorning;
    } else if (hour < 17) {
      return l10n.homeGreetingDay;
    } else {
      return l10n.homeGreetingEvening;
    }
  }
}
