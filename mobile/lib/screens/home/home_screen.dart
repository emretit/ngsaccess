import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/spacing.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/attendance_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/preferred_device_provider.dart';
import '../../router/app_router.dart';
import '../../theme/app_theme.dart';
import '../../widgets/cards/attendance_status_card.dart';
import '../../widgets/cards/quick_action_card.dart';
import '../../widgets/cards/section_header.dart';
import '../../widgets/responsive_container.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  Future<void> _loadData() async {
    final attendanceProvider = Provider.of<AttendanceProvider>(context, listen: false);
    await attendanceProvider.loadAttendanceRecords();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Scaffold(
      backgroundColor: isDark ? AppTheme.darkBackground : Colors.grey[50],
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
        final today = DateFormat('dd MMMM yyyy, EEEE', localeTag).format(DateTime.now());
        final greeting = _getGreeting(l10n);

        return Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                AppTheme.primaryBurgundy.withValues(alpha: 0.1),
                AppTheme.primaryBurgundy.withValues(alpha: 0.05),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              // NGS+ Logo
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.primaryBurgundy.withValues(alpha: 0.3),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: ClipOval(
                  child: SvgPicture.asset(
                    'assets/images/ngs_logo.svg',
                    width: 48,
                    height: 48,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
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
                            color: AppTheme.primaryBurgundy,
                          ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      today,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.grey[600],
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
        return AttendanceStatusCard(
          status: attendanceProvider.attendanceStatus,
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
        Consumer<PreferredDeviceProvider>(
          builder: (context, preferred, _) => Row(
            children: [
              Expanded(
                child: QuickActionCard(
                  icon: Icons.lock_open,
                  label: l10n.quickActionUnlock,
                  subtitle: preferred.deviceName,
                  color: AppTheme.primaryBurgundy,
                  onTap: () => _handleQuickUnlock(preferred),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: QuickActionCard(
                  icon: Icons.person_add_alt_1,
                  label: l10n.quickActionVisitor,
                  color: AppTheme.info,
                  onTap: () => context.go(AppRoute.visitor),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: QuickActionCard(
                  icon: Icons.history,
                  label: l10n.quickActionHistory,
                  color: AppTheme.success,
                  onTap: () => context.go(AppRoute.history),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: QuickActionCard(
                  icon: Icons.person_outline,
                  label: l10n.quickActionProfile,
                  color: AppTheme.warning,
                  onTap: () => context.go(AppRoute.profile),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _handleQuickUnlock(PreferredDeviceProvider preferred) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final attendanceProvider = context.read<AttendanceProvider>();

    if (!preferred.hasDevice) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(l10n.unlockNoDeviceSelected),
          action: SnackBarAction(
            label: l10n.quickActionProfile,
            onPressed: () {
              if (mounted) context.go(AppRoute.profile);
            },
          ),
        ),
      );
      return;
    }

    final granted = await attendanceProvider.quickUnlock(preferred.deviceId!);
    if (!mounted) return;

    final deviceName = preferred.deviceName ?? '';
    messenger.showSnackBar(
      SnackBar(
        backgroundColor: granted ? AppTheme.success : AppTheme.warning,
        content: Text(
          granted
              ? '${l10n.unlockGranted} — $deviceName'
              : l10n.unlockDenied,
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
        ),
        duration: const Duration(seconds: 2),
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

    final today = DateTime.now();
    final quoteIndex = today.day % quotes.length;
    final quote = quotes[quoteIndex];
    
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: BoxDecoration(
        border: Border(
          left: BorderSide(
            color: AppTheme.primaryBurgundy,
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
            style: const TextStyle(
              color: AppTheme.primaryBurgundy,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  String _getGreeting(AppLocalizations l10n) {
    final hour = DateTime.now().hour;
    if (hour < 12) {
      return l10n.homeGreetingMorning;
    } else if (hour < 17) {
      return l10n.homeGreetingDay;
    } else {
      return l10n.homeGreetingEvening;
    }
  }

}
