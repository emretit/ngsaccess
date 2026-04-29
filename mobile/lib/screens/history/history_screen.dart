import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:table_calendar/table_calendar.dart';
import '../../providers/attendance_provider.dart';
import '../../theme/app_theme.dart';
import '../../models/attendance.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> with TickerProviderStateMixin {
  DateTime? _selectedDate;
  String? _selectedDevice;
  List<String> _deviceList = [];
  bool _isLoading = false;
  late TabController _tabController;
  
  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    
    try {
      final attendanceProvider = Provider.of<AttendanceProvider>(context, listen: false);
      await attendanceProvider.loadAttendanceRecords();
      
      // Benzersiz cihaz listesini oluştur
      final devices = attendanceProvider.attendanceRecords
          .where((record) => record.doorName.isNotEmpty)
          .map((record) => record.doorName)
          .toSet()
          .toList();
      
      setState(() {
        _deviceList = devices;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Veriler yüklenirken hata oluştu: $e'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Scaffold(
      backgroundColor: isDark ? AppTheme.darkBackground : Colors.grey[50],
      appBar: AppBar(
        title: const Text('Geçmiş'),
        elevation: 0,
        backgroundColor: isDark ? AppTheme.darkSurface : Colors.white,
        foregroundColor: isDark ? Colors.white : Colors.black,
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list_rounded),
            onPressed: _showFilterDialog,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.primaryColor,
          labelColor: isDark ? Colors.white : AppTheme.primaryColor,
          unselectedLabelColor: Colors.grey,
          tabs: const [
            Tab(text: 'Tümü', icon: Icon(Icons.list_rounded)),
            Tab(text: 'Bu Ay', icon: Icon(Icons.calendar_month_rounded)),
            Tab(text: 'İstatistik', icon: Icon(Icons.analytics_rounded)),
          ],
        ),
      ),
      body: _isLoading
          ? _buildLoadingState()
          : Consumer<AttendanceProvider>(
              builder: (context, attendanceProvider, child) {
                if (attendanceProvider.errorMessage != null) {
                  return _buildErrorState(attendanceProvider.errorMessage!);
                }
                
                return TabBarView(
                  controller: _tabController,
                  children: [
                    _buildAllRecordsTab(attendanceProvider),
                    _buildThisMonthTab(attendanceProvider),
                    _buildStatsTab(attendanceProvider),
                  ],
                );
              },
            ),
    );
  }

  Widget _buildLoadingState() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(),
          SizedBox(height: 16),
          Text('Veriler yükleniyor...'),
        ],
      ),
    );
  }

  Widget _buildErrorState(String errorMessage) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.red.withOpacity(0.1),
                borderRadius: BorderRadius.circular(50),
              ),
              child: Icon(
                Icons.error_outline_rounded,
                size: 48,
                color: Colors.red[400],
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Bir Hata Oluştu',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              errorMessage,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              onPressed: _loadData,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Tekrar Dene'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAllRecordsTab(AttendanceProvider provider) {
    return Column(
      children: [
        // Filtre çipleri
        if (_selectedDate != null || _selectedDevice != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (_selectedDate != null)
                  Chip(
                    label: Text(DateFormat('dd.MM.yyyy').format(_selectedDate!)),
                    deleteIcon: const Icon(Icons.close, size: 18),
                    onDeleted: () => setState(() => _selectedDate = null),
                    backgroundColor: AppTheme.primaryColor.withOpacity(0.1),
                    labelStyle: TextStyle(color: AppTheme.primaryColor),
                  ),
                if (_selectedDevice != null)
                  Chip(
                    label: Text(_selectedDevice!),
                    deleteIcon: const Icon(Icons.close, size: 18),
                    onDeleted: () => setState(() => _selectedDevice = null),
                    backgroundColor: AppTheme.primaryColor.withOpacity(0.1),
                    labelStyle: TextStyle(color: AppTheme.primaryColor),
                  ),
              ],
            ),
          ),
        
        // Kayıt listesi
        Expanded(
          child: _buildRecordsList(provider),
        ),
      ],
    );
  }

  Widget _buildThisMonthTab(AttendanceProvider provider) {
    final now = DateTime.now();
    final startOfMonth = DateTime(now.year, now.month, 1);
    final endOfMonth = DateTime(now.year, now.month + 1, 0);
    final thisMonthRecords = provider.attendanceRecords.where((record) {
      return record.timestamp.isAfter(startOfMonth.subtract(const Duration(days: 1))) && 
             record.timestamp.isBefore(endOfMonth.add(const Duration(days: 1)));
    }).toList();

    // Günlük katılım haritası oluştur
    final Map<DateTime, List<Attendance>> attendanceByDay = {};
    for (final record in thisMonthRecords) {
      final day = DateTime(record.timestamp.year, record.timestamp.month, record.timestamp.day);
      if (attendanceByDay[day] == null) {
        attendanceByDay[day] = [];
      }
      attendanceByDay[day]!.add(record);
    }

    return SingleChildScrollView(
      child: Column(
        children: [
          const SizedBox(height: 16),
          
          // Takvim widget'ı
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Theme.of(context).brightness == Brightness.dark 
                  ? AppTheme.darkSurface 
                  : Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Theme.of(context).brightness == Brightness.dark 
                      ? Colors.black.withOpacity(0.3) 
                      : Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.calendar_month_rounded,
                      color: AppTheme.primaryColor,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      DateFormat('MMMM yyyy', 'tr_TR').format(now),
                      style: TextStyle(
                        color: AppTheme.primaryColor,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                TableCalendar<Attendance>(
                  firstDay: startOfMonth,
                  lastDay: endOfMonth,
                  focusedDay: now,
                  calendarFormat: CalendarFormat.month,
                  locale: 'tr_TR',
                  eventLoader: (day) {
                    return attendanceByDay[day] ?? [];
                  },
                  startingDayOfWeek: StartingDayOfWeek.monday,
                  headerStyle: HeaderStyle(
                    formatButtonVisible: false,
                    titleCentered: true,
                    leftChevronIcon: Icon(
                      Icons.chevron_left,
                      color: Theme.of(context).brightness == Brightness.dark 
                          ? Colors.white 
                          : AppTheme.primaryColor,
                    ),
                    rightChevronIcon: Icon(
                      Icons.chevron_right,
                      color: Theme.of(context).brightness == Brightness.dark 
                          ? Colors.white 
                          : AppTheme.primaryColor,
                    ),
                    titleTextStyle: TextStyle(
                      color: Theme.of(context).brightness == Brightness.dark 
                          ? Colors.white 
                          : AppTheme.primaryColor,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  calendarStyle: CalendarStyle(
                    outsideDaysVisible: false,
                    weekendTextStyle: TextStyle(
                      color: Colors.red[400],
                    ),
                    defaultTextStyle: TextStyle(
                      color: Theme.of(context).brightness == Brightness.dark 
                          ? Colors.white 
                          : Colors.black87,
                    ),
                    todayDecoration: BoxDecoration(
                      color: AppTheme.primaryColor.withOpacity(0.5),
                      shape: BoxShape.circle,
                    ),
                    selectedDecoration: BoxDecoration(
                      color: AppTheme.primaryColor,
                      shape: BoxShape.circle,
                    ),
                    markerDecoration: BoxDecoration(
                      color: Colors.green[600],
                      shape: BoxShape.circle,
                    ),
                    markersMaxCount: 3,
                    markerSize: 6,
                    markersOffset: const PositionedOffset(bottom: 4),
                  ),
                  calendarBuilders: CalendarBuilders(
                    defaultBuilder: (context, day, focusedDay) {
                      final dayRecords = attendanceByDay[day] ?? [];
                      Color? dayColor;
                      
                      if (dayRecords.isNotEmpty) {
                        // Gün içindeki ilk giriş saatini kontrol et
                        final firstCheckIn = dayRecords
                            .where((r) => r.type == 'check_in')
                            .map((r) => r.timestamp)
                            .fold<DateTime?>(null, (earliest, current) => 
                                earliest == null || current.isBefore(earliest) ? current : earliest);
                        
                        if (firstCheckIn != null) {
                          final hour = firstCheckIn.hour;
                          final minute = firstCheckIn.minute;
                          
                          // Saat 9:00'dan önce gelirse erken, 9:30'dan sonra gelirse geç
                          if (hour < 9 || (hour == 9 && minute == 0)) {
                            dayColor = Colors.blue[100]; // Erken giriş
                          } else if (hour > 9 || (hour == 9 && minute > 30)) {
                            dayColor = Colors.orange[100]; // Geç giriş
                          } else {
                            dayColor = Colors.green[100]; // Normal giriş
                          }
                        }
                      }
                      
                      return Container(
                        decoration: BoxDecoration(
                          color: dayColor,
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            '${day.day}',
                            style: TextStyle(
                              color: Theme.of(context).brightness == Brightness.dark 
                                  ? Colors.white 
                                  : Colors.black87,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                  onDaySelected: (selectedDay, focusedDay) {
                    final dayRecords = attendanceByDay[selectedDay] ?? [];
                    if (dayRecords.isNotEmpty) {
                      _showDayDetailsDialog(selectedDay, dayRecords);
                    }
                  },
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 16),
          
          // Renk açıklamaları
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Theme.of(context).brightness == Brightness.dark 
                  ? AppTheme.darkSurface.withOpacity(0.5)
                  : Colors.grey.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: Theme.of(context).brightness == Brightness.dark 
                    ? Colors.grey.withOpacity(0.3)
                    : Colors.grey.withOpacity(0.2),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.palette_outlined,
                      color: Colors.grey[600],
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Renk Açıklamaları',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).brightness == Brightness.dark 
                            ? Colors.white 
                            : Colors.black87,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                
                // Renk açıklama öğeleri
                _buildColorLegend(
                  Colors.blue[100]!,
                  'Erken Giriş',
                  'Saat 09:00\'dan önce giriş yapılan günler',
                  Icons.schedule_rounded,
                ),
                const SizedBox(height: 8),
                _buildColorLegend(
                  Colors.green[100]!,
                  'Normal Giriş',
                  'Saat 09:00-09:30 arası giriş yapılan günler',
                  Icons.check_circle_outline,
                ),
                const SizedBox(height: 8),
                _buildColorLegend(
                  Colors.orange[100]!,
                  'Geç Giriş',
                  'Saat 09:30\'dan sonra giriş yapılan günler',
                  Icons.warning_amber_rounded,
                ),
                const SizedBox(height: 8),
                _buildColorLegend(
                  Colors.transparent,
                  'Katılım Yok',
                  'Hiç giriş-çıkış kaydı bulunmayan günler',
                  Icons.remove_circle_outline,
                ),
                
                const SizedBox(height: 12),
                
                // Ek bilgi
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.blue.withOpacity(0.2)),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.info_outline,
                        color: Colors.blue[600],
                        size: 16,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Günlere tıklayarak detayları görebilirsiniz. Yeşil noktalar ek katılım kayıtlarını gösterir.',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.blue[700],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildStatsTab(AttendanceProvider provider) {
    final records = provider.attendanceRecords;
    final checkIns = records.where((r) => r.type == 'check_in').length;
    final checkOuts = records.where((r) => r.type == 'check_out').length;
    
    // Bu ay istatistikleri
    final now = DateTime.now();
    final startOfMonth = DateTime(now.year, now.month, 1);
    final endOfMonth = DateTime(now.year, now.month + 1, 0);
    final thisMonthRecords = records.where((record) {
      return record.timestamp.isAfter(startOfMonth.subtract(const Duration(days: 1))) && 
             record.timestamp.isBefore(endOfMonth.add(const Duration(days: 1)));
    }).toList();
    
    // Günlük katılım haritası oluştur
    final Map<DateTime, List<Attendance>> attendanceByDay = {};
    for (final record in thisMonthRecords) {
      final day = DateTime(record.timestamp.year, record.timestamp.month, record.timestamp.day);
      if (attendanceByDay[day] == null) {
        attendanceByDay[day] = [];
      }
      attendanceByDay[day]!.add(record);
    }
    
    // Haftalık istatistikler
    final startOfWeek = now.subtract(Duration(days: now.weekday - 1));
    final weeklyRecords = records.where((record) {
      return record.timestamp.isAfter(startOfWeek) && record.timestamp.isBefore(now);
    }).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Bu ayın özeti
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppTheme.primaryColor, AppTheme.primaryColor.withOpacity(0.8)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primaryColor.withOpacity(0.3),
                  blurRadius: 10,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Bu Ay Özeti',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  DateFormat('MMMM yyyy', 'tr_TR').format(now),
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _buildMonthStat('Toplam Giriş', 
                      thisMonthRecords.where((r) => r.type == 'check_in').length.toString(),
                      Icons.login_rounded),
                    _buildMonthStat('Toplam Çıkış', 
                      thisMonthRecords.where((r) => r.type == 'check_out').length.toString(),
                      Icons.logout_rounded),
                    _buildMonthStat('Aktif Gün', 
                      attendanceByDay.keys.length.toString(),
                      Icons.calendar_today_rounded),
                  ],
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 24),
          
          // Genel istatistikler
          Text(
            'Genel İstatistikler',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          
          Row(
            children: [
              Expanded(
                child: _buildStatCard(
                  'Toplam Giriş',
                  checkIns.toString(),
                  Icons.login_rounded,
                  Colors.green,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildStatCard(
                  'Toplam Çıkış',
                  checkOuts.toString(),
                  Icons.logout_rounded,
                  Colors.red,
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 24),
          
          // Haftalık istatistikler
          Text(
            'Bu Hafta',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Theme.of(context).brightness == Brightness.dark 
                  ? AppTheme.darkSurface 
                  : Colors.blue.withOpacity(0.1),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.blue.withOpacity(0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.calendar_today, color: Colors.blue[600]),
                    const SizedBox(width: 8),
                    Text(
                      'Haftalık Özet',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.blue[800],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'Bu hafta toplam ${weeklyRecords.length} kayıt',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.blue[600],
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Giriş: ${weeklyRecords.where((r) => r.type == 'check_in').length}',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.blue[600],
                  ),
                ),
                Text(
                  'Çıkış: ${weeklyRecords.where((r) => r.type == 'check_out').length}',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.blue[600],
                  ),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 24),
          
          // Cihaz bazlı istatistikler
          if (_deviceList.isNotEmpty) ...[
            Text(
              'Cihaz Bazlı İstatistikler',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            
            ..._deviceList.map((device) {
              final deviceRecords = records.where((r) => r.doorName == device).length;
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Theme.of(context).brightness == Brightness.dark 
                      ? AppTheme.darkSurface 
                      : Colors.grey.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(Icons.devices_rounded, color: Colors.grey[600]),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        device,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        deviceRecords.toString(),
                        style: TextStyle(
                          color: AppTheme.primaryColor,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ],
        ],
      ),
    );
  }

  Widget _buildMonthStat(String title, String value, IconData icon) {
    return Column(
      children: [
        Icon(icon, color: Colors.white, size: 24),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 24,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          title,
          style: const TextStyle(
            color: Colors.white70,
            fontSize: 12,
          ),
        ),
      ],
    );
  }

  Widget _buildColorLegend(Color color, String title, String description, IconData icon) {
    return Row(
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: color == Colors.transparent ? Colors.grey.withOpacity(0.2) : color,
            shape: BoxShape.circle,
            border: color == Colors.transparent 
                ? Border.all(color: Colors.grey.withOpacity(0.5), width: 1)
                : null,
          ),
          child: color == Colors.transparent 
              ? Icon(icon, size: 12, color: Colors.grey[600])
              : null,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).brightness == Brightness.dark 
                      ? Colors.white 
                      : Colors.black87,
                ),
              ),
              Text(
                description,
                style: TextStyle(
                  fontSize: 12,
                  color: Theme.of(context).brightness == Brightness.dark 
                      ? Colors.grey[400] 
                      : Colors.grey[600],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.darkSurface : color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 24),
              const Spacer(),
              Text(
                value,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            title,
            style: TextStyle(
              fontSize: 14,
              color: color.withOpacity(0.8),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecordsList(AttendanceProvider provider) {
    final records = _getFilteredRecords();
    
    if (records.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadData,
        child: _buildEmptyState('Kayıt bulunamadı'),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: records.length,
        itemBuilder: (context, index) {
          return _buildModernAttendanceCard(records[index]);
        },
      ),
    );
  }

  Widget _buildEmptyState(String message) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.grey.withOpacity(0.1),
              borderRadius: BorderRadius.circular(50),
            ),
            child: Icon(
              Icons.history_rounded,
              size: 48,
              color: Colors.grey[400],
            ),
          ),
          const SizedBox(height: 24),
          Text(
            message,
            style: TextStyle(
              fontSize: 16,
              color: Colors.grey[600],
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Veriler yenilemek için aşağı çekin',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[500],
            ),
          ),
        ],
      ),
    );
  }

  List<Attendance> _getFilteredRecords() {
    final attendanceProvider = Provider.of<AttendanceProvider>(context);
    var records = attendanceProvider.attendanceRecords;

    if (_selectedDate != null) {
      final startOfDay = DateTime(
        _selectedDate!.year,
        _selectedDate!.month,
        _selectedDate!.day,
      );
      final endOfDay = startOfDay.add(const Duration(days: 1));

      records = records.where((record) {
        return record.timestamp.isAfter(startOfDay) && 
               record.timestamp.isBefore(endOfDay);
      }).toList();
    }

    if (_selectedDevice != null) {
      records = records.where((record) {
        return record.doorName == _selectedDevice;
      }).toList();
    }

    return records;
  }

  Widget _buildModernAttendanceCard(Attendance record) {
    final isCheckIn = record.type == 'check_in';
    final formattedTime = DateFormat('HH:mm').format(record.timestamp);
    final formattedDate = DateFormat('dd.MM.yyyy').format(record.timestamp);
    final deviceName = record.doorName.isNotEmpty ? record.doorName : 'Bilinmeyen Cihaz';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.darkSurface : Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: isDark ? Colors.black.withOpacity(0.3) : Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _showModernRecordDetails(record),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Sol taraf - Renkli ikon
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: isCheckIn 
                          ? [Colors.green[400]!, Colors.green[600]!]
                          : [Colors.red[400]!, Colors.red[600]!],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: (isCheckIn ? Colors.green : Colors.red).withOpacity(0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Icon(
                    isCheckIn ? Icons.login_rounded : Icons.logout_rounded,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                
                // Orta kısım - Ana bilgiler
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Giriş/Çıkış başlığı
                      Text(
                        isCheckIn ? 'Giriş Yapıldı' : 'Çıkış Yapıldı',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 4),
                      
                      // Cihaz ismi
                      Row(
                        children: [
                          Icon(
                            Icons.location_on_rounded,
                            size: 16,
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              deviceName,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: isDark ? Colors.grey[300] : Colors.grey[700],
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      
                      // Tarih ve saat
                      Row(
                        children: [
                          Icon(
                            Icons.access_time_rounded,
                            size: 16,
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '$formattedDate • $formattedTime',
                            style: TextStyle(
                              fontSize: 13,
                              color: isDark ? Colors.grey[400] : Colors.grey[600],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                
                // Sağ taraf - Durum ve ok ikonu
                Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: isCheckIn 
                            ? Colors.green.withOpacity(0.1)
                            : Colors.red.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        isCheckIn ? 'GİRİŞ' : 'ÇIKIŞ',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: isCheckIn ? Colors.green[700] : Colors.red[700],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 16,
                      color: isDark ? Colors.grey[600] : Colors.grey[400],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showModernRecordDetails(Attendance record) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: (record.type == 'check_in' ? Colors.green : Colors.red).withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                record.type == 'check_in' ? Icons.login_rounded : Icons.logout_rounded,
                color: record.type == 'check_in' ? Colors.green : Colors.red,
              ),
            ),
            const SizedBox(width: 12),
            Text(record.type == 'check_in' ? 'Giriş Detayları' : 'Çıkış Detayları'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildDetailRow(Icons.calendar_today_rounded, 'Tarih', 
                DateFormat('dd.MM.yyyy EEEE', 'tr_TR').format(record.timestamp)),
            _buildDetailRow(Icons.access_time_rounded, 'Saat', 
                DateFormat('HH:mm:ss').format(record.timestamp)),
            _buildDetailRow(Icons.location_on_rounded, 'Konum', 
                record.doorName.isNotEmpty ? record.doorName : 'Bilinmeyen Konum'),
            if (record.qrData != null && record.qrData!.isNotEmpty)
              _buildDetailRow(Icons.qr_code_rounded, 'QR Kod', record.qrData!),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Kapat'),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String title, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: Colors.grey[600]),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showFilterDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: const Row(
          children: [
            Icon(Icons.filter_list_rounded),
            SizedBox(width: 8),
            Text('Filtrele'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Tarih seçici
            ListTile(
              leading: const Icon(Icons.calendar_today_rounded),
              title: const Text('Tarih'),
              subtitle: Text(
                _selectedDate != null
                    ? DateFormat('dd.MM.yyyy').format(_selectedDate!)
                    : 'Tarih seçilmedi',
              ),
              onTap: () async {
                final date = await showDatePicker(
                  context: context,
                  initialDate: _selectedDate ?? DateTime.now(),
                  firstDate: DateTime(2020),
                  lastDate: DateTime.now(),
                );
                if (date != null) {
                  setState(() => _selectedDate = date);
                }
                Navigator.pop(context);
              },
            ),
            // Cihaz seçici
            if (_deviceList.isNotEmpty)
              ListTile(
                leading: const Icon(Icons.devices_rounded),
                title: const Text('Cihaz'),
                subtitle: Text(_selectedDevice ?? 'Cihaz seçilmedi'),
                onTap: () {
                  Navigator.pop(context);
                  _showDeviceSelectionDialog();
                },
              ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              setState(() {
                _selectedDate = null;
                _selectedDevice = null;
              });
              Navigator.pop(context);
            },
            child: const Text('Filtreleri Temizle'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  void _showDeviceSelectionDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: const Row(
          children: [
            Icon(Icons.devices_rounded),
            SizedBox(width: 8),
            Text('Cihaz Seç'),
          ],
        ),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: _deviceList.length,
            itemBuilder: (context, index) {
              final device = _deviceList[index];
              return ListTile(
                leading: const Icon(Icons.location_on_rounded),
                title: Text(device),
                selected: device == _selectedDevice,
                selectedTileColor: AppTheme.primaryColor.withOpacity(0.1),
                onTap: () {
                  setState(() => _selectedDevice = device);
                  Navigator.pop(context);
                },
              );
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('İptal'),
          ),
        ],
      ),
    );
  }

  void _showDayDetailsDialog(DateTime selectedDay, List<Attendance> dayRecords) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppTheme.primaryColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                Icons.calendar_today_rounded,
                color: AppTheme.primaryColor,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    DateFormat('dd MMMM yyyy', 'tr_TR').format(selectedDay),
                    style: const TextStyle(fontSize: 16),
                  ),
                  Text(
                    DateFormat('EEEE', 'tr_TR').format(selectedDay),
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        content: SizedBox(
          width: double.maxFinite,
          height: 300,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${dayRecords.length} Kayıt',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey[700],
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ListView.builder(
                  itemCount: dayRecords.length,
                  itemBuilder: (context, index) {
                    final record = dayRecords[index];
                    final isCheckIn = record.type == 'check_in';
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isCheckIn 
                            ? Colors.green.withOpacity(0.1)
                            : Colors.red.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isCheckIn 
                              ? Colors.green.withOpacity(0.3)
                              : Colors.red.withOpacity(0.3),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isCheckIn ? Icons.login_rounded : Icons.logout_rounded,
                            color: isCheckIn ? Colors.green[600] : Colors.red[600],
                            size: 20,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  isCheckIn ? 'Giriş' : 'Çıkış',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: isCheckIn ? Colors.green[700] : Colors.red[700],
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  record.doorName.isNotEmpty 
                                      ? record.doorName 
                                      : 'Bilinmeyen Konum',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey[600],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            DateFormat('HH:mm').format(record.timestamp),
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: isCheckIn ? Colors.green[700] : Colors.red[700],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Kapat'),
          ),
        ],
      ),
    );
  }
} 