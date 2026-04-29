import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../providers/auth_provider.dart';
import '../../providers/attendance_provider.dart';
import '../../theme/app_theme.dart';
import '../qr_scan/qr_scan_screen.dart';

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
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildHeader(),
                  const SizedBox(height: 24),
                  _buildAttendanceStatusCard(),
                  const SizedBox(height: 24),
                  _buildStatsCards(),
                  const SizedBox(height: 24),
                  _buildMotivationalQuote(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Consumer<AuthProvider>(
      builder: (context, authProvider, _) {
        final user = authProvider.currentUser;
        final firstName = user?.firstName ?? 'Kullanıcı';
        final today = DateFormat('dd MMMM yyyy, EEEE', 'tr_TR').format(DateTime.now());
        final greeting = _getGreeting();
        
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
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.primaryBurgundy.withValues(alpha: 0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                    BoxShadow(
                      color: Colors.white.withValues(alpha: 0.1),
                      blurRadius: 6,
                      offset: const Offset(0, -2),
                    ),
                  ],
                ),
                child: ClipOval(
                  child: SvgPicture.asset(
                    'assets/images/ngs_logo.svg',
                    width: 60,
                    height: 60,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              
              // Greeting and Date
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$greeting, $firstName!',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryBurgundy,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      today,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
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
        final hasCheckedIn = attendanceProvider.hasCheckedInToday;
        final hasCheckedOut = attendanceProvider.hasCheckedOutToday;
        final todayAttendance = attendanceProvider.todayAttendance;
        
        return Card(
          elevation: 4,
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: _getStatusColor(hasCheckedIn, hasCheckedOut).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        _getStatusIcon(hasCheckedIn, hasCheckedOut),
                        color: _getStatusColor(hasCheckedIn, hasCheckedOut),
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Text(
                        'Yoklama Durumu',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                
                if (!hasCheckedIn) ...[
                  Text(
                    'Bugün henüz giriş yapmadınız.',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const QRScanScreen(),
                          ),
                        );
                      },
                      icon: const Icon(Icons.qr_code_scanner, size: 24),
                      label: const Text(
                        'QR Kod Tara - Giriş Yap',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryBurgundy,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ] else if (!hasCheckedOut) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.green.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.login, color: Colors.green, size: 24),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Giriş saati: ${DateFormat('HH:mm').format(todayAttendance!.checkInTime!)}',
                            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              color: Colors.green[700],
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const QRScanScreen(),
                          ),
                        );
                      },
                      icon: const Icon(Icons.qr_code_scanner, size: 24),
                      label: const Text(
                        'QR Kod Tara - Çıkış Yap',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.orange[600],
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ] else ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.blue.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.blue.withValues(alpha: 0.3)),
                    ),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.login, color: Colors.green, size: 20),
                            const SizedBox(width: 8),
                            Text(
                              'Giriş: ${DateFormat('HH:mm').format(todayAttendance!.checkInTime!)}',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: Colors.green[700],
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(Icons.logout, color: Colors.red, size: 20),
                            const SizedBox(width: 8),
                            Text(
                              'Çıkış: ${DateFormat('HH:mm').format(todayAttendance.checkOutTime!)}',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: Colors.red[700],
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    height: 56,
                    decoration: BoxDecoration(
                      color: Colors.grey[300],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle, color: Colors.grey[600]),
                          const SizedBox(width: 8),
                          Text(
                            'Bugün için yoklama tamamlandı',
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStatsCards() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Bu Ayki Özet',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 16),
        Consumer<AttendanceProvider>(
          builder: (context, attendanceProvider, _) {
            return Row(
              children: [
                Expanded(
                  child: _buildStatCard(
                    'Toplam Gün',
                    attendanceProvider.totalDaysThisMonth.toString(),
                    Icons.calendar_month,
                    AppTheme.primaryBurgundy,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildStatCard(
                    'Mevcut Günler',
                    attendanceProvider.daysPresent.toString(),
                    Icons.check_circle_outline,
                    AppTheme.primaryBurgundy,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildStatCard(
                    'Geç Kalma',
                    attendanceProvider.timesLate.toString(),
                    Icons.schedule,
                    AppTheme.primaryBurgundy,
                  ),
                ),
              ],
            );
          },
        ),
      ],
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color) {
    return Card(
      elevation: 3,
      child: Container(
        padding: const EdgeInsets.all(16.0),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: LinearGradient(
            colors: [
              color.withValues(alpha: 0.05),
              color.withValues(alpha: 0.02),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                icon,
                size: 24,
                color: color,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              value,
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey[600],
                fontWeight: FontWeight.w500,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMotivationalQuote() {
    const quotes = [
      "Başarı, hazırlık ile fırsatın buluştuğu andır.",
      "Her yeni gün, yeni bir başlangıçtır.",
      "Disiplin, özgürlüğün köprüsüdür.",
      "Küçük adımlar büyük değişimler yaratır.",
      "Bugün dün düşündüğünüz yarındır.",
      "Zaman en değerli hazinedir, onu akıllıca kullan.",
      "İyi alışkanlıklar, başarının anahtarıdır.",
      "Her gün kendini geliştirme fırsatıdır.",
    ];
    
    final today = DateTime.now();
    final quoteIndex = today.day % quotes.length;
    final quote = quotes[quoteIndex];
    
    return Card(
      elevation: 2,
      child: Container(
        padding: const EdgeInsets.all(24.0),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: LinearGradient(
            colors: [
              AppTheme.primaryBurgundy.withValues(alpha: 0.05),
              AppTheme.primaryBurgundy.withValues(alpha: 0.02),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppTheme.primaryBurgundy.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(
                Icons.format_quote,
                size: 24,
                color: AppTheme.primaryBurgundy,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              quote,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                fontStyle: FontStyle.italic,
                fontWeight: FontWeight.w500,
                height: 1.4,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            const Text(
              '💫 Günün Sözü',
              style: TextStyle(
                color: AppTheme.primaryBurgundy,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) {
      return 'Günaydın';
    } else if (hour < 17) {
      return 'İyi günler';
    } else {
      return 'İyi akşamlar';
    }
  }

  Color _getStatusColor(bool hasCheckedIn, bool hasCheckedOut) {
    if (!hasCheckedIn) return Colors.orange;
    if (hasCheckedIn && !hasCheckedOut) return Colors.green;
    return Colors.blue;
  }

  IconData _getStatusIcon(bool hasCheckedIn, bool hasCheckedOut) {
    if (!hasCheckedIn) return Icons.access_time;
    if (hasCheckedIn && !hasCheckedOut) return Icons.login;
    return Icons.check_circle;
  }
} 