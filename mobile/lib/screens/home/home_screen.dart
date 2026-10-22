import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
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
import '../../repositories/device_repository.dart';
import '../../providers/preferred_device_provider.dart';
import '../../router/app_router.dart';
import '../../theme/app_theme.dart';
import '../../widgets/brand_mark.dart';
import '../../widgets/door_operation_recovery_dialog.dart';
import '../../widgets/cards/attendance_status_card.dart';
import '../../widgets/cards/quick_action_card.dart';
import '../../widgets/cards/section_header.dart';
import '../../widgets/responsive_card_grid.dart';
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
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: SafeArea(
            child: ResponsiveContainer(
              maxWidth: AppSpacing.contentMaxWidth,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildHeader(),
                    const SizedBox(height: 24),
                    _buildAttendanceStatusCard(),
                    const SizedBox(height: 24),
                    _buildQuickActions(),
                    const SizedBox(height: 24),
                    _buildMotivationalQuote(),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final l10n = AppLocalizations.of(context);
    return Consumer<AuthProvider>(
      builder: (context, authProvider, _) {
        final user = authProvider.currentUser;
        final firstName = user?.firstName ?? l10n.homeGreetingFallback;
        final localeTag = Localizations.localeOf(context).toLanguageTag();
        final today = DateFormat(
          'dd MMMM yyyy, EEEE',
          localeTag,
        ).format(AttendanceDate.businessTime(DateTime.now()));
        final greeting = _getGreeting(l10n);

        return Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primaryContainer,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              const BrandMark(size: 48),
              const SizedBox(width: 14),

              // Greeting and Date
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.homeGreetingLine(greeting, firstName),
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: Theme.of(context).colorScheme.onPrimaryContainer,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      today,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onPrimaryContainer,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAttendanceStatusCard() {
    return Consumer<AttendanceProvider>(
      builder: (context, attendanceProvider, _) {
        final error = attendanceProvider.summaryError;
        return AttendanceStatusCard(
          status: attendanceProvider.attendanceStatus,
          isLoading: attendanceProvider.isSummaryLoading,
          hasLoaded: attendanceProvider.hasSummaryLoaded,
          isStatusKnown: attendanceProvider.isTodayStatusKnown,
          errorMessage: error == null ? null : localizeAppError(context, error),
          updatedAt: attendanceProvider.summaryUpdatedAt,
          onRetry: () => unawaited(_loadData()),
          lastEntry: attendanceProvider.lastEntryToday,
          lastExit: attendanceProvider.lastExitToday,
          extraEntryCount: attendanceProvider.extraEntryMovementsToday,
          extraExitCount: attendanceProvider.extraExitMovementsToday,
          onScan: () => context.go(AppRoute.qr),
        );
      },
    );
  }

  Widget _buildQuickActions() {
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: l10n.homeQuickActions),
        const SizedBox(height: 12),
        Consumer3<PreferredDeviceProvider, DoorOperationProvider, AuthProvider>(
          builder: (context, preferred, commands, auth, _) {
            final preparing =
                _preparingCommand && _preparationEpoch == auth.sessionEpoch;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ResponsiveCardGrid(
                  children: [
                    QuickActionCard(
                      icon: Icons.lock_open,
                      label: l10n.quickActionUnlock,
                      subtitle: preferred.deviceName,
                      color: AppTheme.primaryBurgundy,
                      isBusy:
                          preparing ||
                          (!commands.hasUnresolvedOperation &&
                              (commands.isLoading || preferred.isSaving)),
                      busyLabel: preparing && commands.isLoading
                          ? l10n.homeCommandSending
                          : l10n.homeDataLoading,
                      onTap:
                          !auth.isAuthenticated ||
                              preparing ||
                              (!commands.hasUnresolvedOperation &&
                                  (commands.isLoading || preferred.isSaving))
                          ? null
                          : () => unawaited(
                              _handleQuickUnlock(preferred, commands),
                            ),
                    ),
                    QuickActionCard(
                      icon: Icons.person_add_alt_1,
                      label: l10n.quickActionVisitor,
                      color: AppTheme.info,
                      onTap: () => context.go(AppRoute.visitor),
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      ],
    );
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
      if (_recoveryOpen) return;
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
      return;
    }
    if (commands.isLoading || preferred.isSaving) {
      return;
    }
    if (!preferred.hasDevice) {
      _showDeviceSelectionNotice(preferred.wasInvalidated);
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

  Widget _buildMotivationalQuote() {
    final l10n = AppLocalizations.of(context);
    final quotes = <String>[
      l10n.homeQuote1,
      l10n.homeQuote2,
      l10n.homeQuote3,
      l10n.homeQuote4,
      l10n.homeQuote5,
      l10n.homeQuote6,
      l10n.homeQuote7,
      l10n.homeQuote8,
    ];

    final today = AttendanceDate.businessTime(DateTime.now());
    final quoteIndex = today.day % quotes.length;
    final quote = quotes[quoteIndex];

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: BoxDecoration(
        border: Border(
          left: BorderSide(
            color: Theme.of(context).colorScheme.primary,
            width: 4,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            quote,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              fontStyle: FontStyle.italic,
              fontWeight: FontWeight.w500,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            l10n.homeQuoteOfTheDay,
            style: TextStyle(
              color: Theme.of(context).colorScheme.primary,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ],
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
