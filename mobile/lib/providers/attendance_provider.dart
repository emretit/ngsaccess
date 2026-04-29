import 'package:flutter/material.dart';
import '../config/supabase_config.dart';
import '../models/attendance.dart';
import '../models/qr_code_model.dart';
import 'auth_provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AttendanceProvider extends ChangeNotifier {
  List<Attendance> _attendanceRecords = [];
  bool _isLoading = false;
  String? _errorMessage;
  Attendance? _todayAttendance;
  AuthProvider? _authProvider;

  List<Attendance> get attendanceRecords => _attendanceRecords;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  Attendance? get todayAttendance => _todayAttendance;

  bool get hasCheckedInToday => _todayAttendance?.checkInTime != null;
  bool get hasCheckedOutToday => _todayAttendance?.checkOutTime != null;

  void setAuthProvider(AuthProvider authProvider) {
    _authProvider = authProvider;
  }

  Future<void> loadAttendanceRecords() async {
    try {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();

      final currentUser = _authProvider?.currentUser;
      print('DEBUG: currentUser = ${currentUser?.id}, userType = ${currentUser?.userType}');
      
      if (currentUser == null) {
        print('DEBUG: No current user, returning');
        _isLoading = false;
        notifyListeners();
        return;
      }

      // Çalışanlar için card_readings tablosundan veri çek (devices tablosuyla join)
      if (currentUser.userType == UserType.employee) {
        print('DEBUG: Loading card_readings for employee ID: ${currentUser.id}');
        
        final employeeId = int.parse(currentUser.id);
        print('DEBUG: Looking for employee_id = $employeeId');
        
        try {
          // Debug: Employee ID'sini kontrol et
          print('DEBUG: Searching for employee_id = $employeeId in card_readings table');
          
          // Test: Employee'ın gerçekten var olup olmadığını kontrol et
          final employeeCheck = await supabase
              .from('employees')
              .select('id, email, first_name, last_name')
              .eq('id', employeeId)
              .maybeSingle();
          
          print('DEBUG: Employee check result: $employeeCheck');
          
          // Önce basit bir sorgu ile test et
          final simpleResponse = await supabase
              .from('card_readings')
              .select('*')
              .eq('employee_id', employeeId)
              .order('access_time', ascending: false)
              .limit(10);

          print('DEBUG: Simple query returned ${simpleResponse.length} records');

          if (simpleResponse.isNotEmpty) {
            print('DEBUG: First record: ${simpleResponse[0]}');
            
            // Şimdi devices ile join'li sorguyu dene
            final filteredResponse = await supabase
                .from('card_readings')
                .select('''
                  *,
                  devices!card_readings_device_id_fkey (
                    id,
                    name,
                    description
                  )
                ''')
                .eq('employee_id', employeeId)
                .order('access_time', ascending: false)
                .limit(100);

            print('DEBUG: Joined query returned ${filteredResponse.length} records');

            _attendanceRecords = filteredResponse
                .map((record) {
                  try {
                    // Devices tablosundan kapı bilgisini al
                    final device = record['devices'];
                    final doorName = device != null 
                        ? '${device['name']}${device['description'] != null ? ' - ${device['description']}' : ''}'
                        : 'Bilinmeyen Kapı';
                    
                    // raw_data'dan giriş/çıkış tipini belirle
                    String attendanceType = 'check_in';
                    if (record['raw_data'] != null && record['raw_data'] is String) {
                      final rawData = record['raw_data'] as String;
                      if (rawData.toLowerCase().contains('check_out') || 
                          rawData.toLowerCase().contains('çıkış')) {
                        attendanceType = 'check_out';
                      }
                    }
                    
                    // Card readings formatını Attendance formatına dönüştür
                    final formattedRecord = {
                      'id': record['id']?.toString() ?? '',
                      'user_id': record['employee_id']?.toString() ?? '',
                      'type': attendanceType,
                      'created_at': record['access_time']?.toString() ?? DateTime.now().toIso8601String(),
                      'door_name': doorName,
                      'qr_data': record['card_no'], // QR kod verisini ekle
                      // Ek bilgiler
                      'employee_name': record['employee_name'],
                      'device_id': record['device_id'],
                      'access_status': record['access_status'],
                    };
                    
                    print('DEBUG: Formatted record: $formattedRecord');
                    return Attendance.fromJson(formattedRecord);
                  } catch (e) {
                    print('DEBUG: Error parsing record: $e');
                    print('DEBUG: Record data: $record');
                    return null;
                  }
                })
                .where((record) => record != null)
                .cast<Attendance>()
                .take(50)
                .toList();
          } else {
            print('DEBUG: No records found for employee_id: $employeeId');
            _attendanceRecords = [];
          }
        } catch (dbError) {
          print('DEBUG: Database error: $dbError');
          _attendanceRecords = [];
          _errorMessage = 'Veritabanı hatası: $dbError';
        }
            
        print('DEBUG: Parsed ${_attendanceRecords.length} attendance records');
      } else {
        // Adminler için direkt veritabanı sorgusu
        print('DEBUG: Loading for admin user');
        final response = await supabase
            .from('pdks_records')
            .select()
            .order('created_at', ascending: false)
            .limit(50);

        _attendanceRecords = (response as List)
            .map((record) => Attendance.fromJson(record))
            .toList();
      }

      await _loadTodayAttendance();

      _isLoading = false;
      notifyListeners();
    } catch (error) {
      print('DEBUG: General error in loadAttendanceRecords: $error');
      _isLoading = false;
      _errorMessage = error.toString();
      notifyListeners();
    }
  }

  Future<void> _loadTodayAttendance() async {
    final currentUser = _authProvider?.currentUser;
    if (currentUser == null) return;

    final today = DateTime.now();
    final startOfDay = DateTime(today.year, today.month, today.day);
    final endOfDay = startOfDay.add(const Duration(days: 1));

    List<dynamic> response;

    if (currentUser.userType == UserType.employee) {
      // Çalışanlar için bugünkü card_readings kayıtlarını al (devices tablosuyla join)
      final employeeId = int.parse(currentUser.id);
      final filteredCardReadings = await supabase
          .from('card_readings')
          .select('''
            *,
            devices!card_readings_device_id_fkey (
              id,
              name,
              description
            )
          ''')
          .eq('employee_id', employeeId)  // Doğrudan veritabanında filtrele
          .gte('access_time', startOfDay.toIso8601String())
          .lt('access_time', endOfDay.toIso8601String())
          .order('access_time', ascending: true);

      response = filteredCardReadings.map((record) {
        // Devices tablosundan kapı bilgisini al
        final device = record['devices'];
        final doorName = device != null 
            ? '${device['name']}${device['description'] != null ? ' - ${device['description']}' : ''}'
            : 'Bilinmeyen Kapı';
            
        // raw_data'dan giriş/çıkış tipini belirle
        String attendanceType = 'check_in';
        if (record['raw_data'] != null && record['raw_data'] is String) {
          final rawData = record['raw_data'] as String;
          if (rawData.toLowerCase().contains('check_out') || 
              rawData.toLowerCase().contains('çıkış')) {
            attendanceType = 'check_out';
          }
        }
            
        return {
          'id': record['id']?.toString() ?? '',
          'user_id': record['employee_id']?.toString() ?? '',
          'type': attendanceType,
          'created_at': record['access_time']?.toString() ?? DateTime.now().toIso8601String(),
          'door_name': doorName,
          'qr_data': record['card_no'], // QR kod verisini ekle
          // Ek bilgiler
          'employee_name': record['employee_name'],
          'device_id': record['device_id'],
          'access_status': record['access_status'],
        };
      }).toList();
    } else {
      // Adminler için direkt veritabanı sorgusu
      response = await supabase
          .from('pdks_records')
          .select()
          .gte('date', startOfDay.toIso8601String().split('T')[0])
          .lt('date', endOfDay.toIso8601String().split('T')[0])
          .order('entry_time', ascending: true);
    }

    final todayRecords = (response as List)
        .map((record) => Attendance.fromJson(record))
        .toList();

    if (todayRecords.isNotEmpty) {
      final checkIn = todayRecords.firstWhere(
        (record) => record.type == 'check_in',
        orElse: () => Attendance(
          id: '',
          userId: currentUser.id,
          type: 'check_in',
          timestamp: DateTime.now(),
          doorName: '',
        ),
      );

      final checkOut = todayRecords.firstWhere(
        (record) => record.type == 'check_out',
        orElse: () => Attendance(
          id: '',
          userId: currentUser.id,
          type: 'check_out',
          timestamp: DateTime.now(),
          doorName: '',
        ),
      );

      _todayAttendance = Attendance(
        id: checkIn.id,
        userId: currentUser.id,
        type: 'check_in',
        timestamp: checkIn.timestamp,
        doorName: checkIn.doorName,
        checkInTime: checkIn.type == 'check_in' ? checkIn.timestamp : null,
        checkOutTime: checkOut.type == 'check_out' ? checkOut.timestamp : null,
      );
    } else {
      _todayAttendance = null;
    }
  }

  Future<bool> recordAttendance(
    String qrData, 
    String type, {
    int? deviceId,
    String? location,
  }) async {
    try {
      _isLoading = true;
      notifyListeners();

      final currentUser = _authProvider?.currentUser;
      if (currentUser == null) return false;

      // QR kod verisini doğrula
      print('DEBUG: Raw QR data: $qrData');
      final parsedData = QRCodeGenerator.parseQRData(qrData);
      print('DEBUG: Parsed QR data: $parsedData');
      
      if (!parsedData['is_valid']) {
        _errorMessage = 'Geçersiz QR kod formatı: ${parsedData['error'] ?? 'Bilinmeyen hata'}';
        return false;
      }
      
      print('DEBUG: About to insert into card_readings table');

      // Çalışanlar için card_readings tablosuna kaydet
      if (currentUser.userType == UserType.employee) {
        // Employee ID'yi string'den int'e çevir - bu zaten employee tablosundaki gerçek ID
        final employeeId = int.parse(currentUser.id);
        
        // Device ID'yi serial number'dan bul
        int finalDeviceId = 1; // Varsayılan device_id
        
        // QR kod verisindeki büyük sayı serial number olabilir
        String? serialNumber;
        if (parsedData['device_id'] != null) {
          serialNumber = parsedData['device_id'].toString();
        } else if (qrData.isNotEmpty) {
          // QR kod direkt serial number olabilir
          serialNumber = qrData;
        }
        
        print('DEBUG: Looking for serial number: $serialNumber');
        
        // Serial number'dan device_id'yi bul
        if (serialNumber != null && serialNumber.isNotEmpty) {
          try {
            final deviceResponse = await supabase
                .from('devices')
                .select('id, name, device_serial')
                .eq('device_serial', serialNumber)
                .eq('is_active', true)
                .maybeSingle();
            
            if (deviceResponse != null) {
              finalDeviceId = deviceResponse['id'];
              print('DEBUG: Found device: ${deviceResponse['name']} with ID: $finalDeviceId');
            } else {
              print('DEBUG: Serial number not found in devices table, using default device_id: 1');
            }
          } catch (e) {
            print('DEBUG: Error looking up device: $e, using default device_id: 1');
          }
        }
        
        print('DEBUG: Final device_id: $finalDeviceId');
        print('DEBUG: Employee ID = $employeeId');
        print('DEBUG: Employee Name = ${currentUser.firstName} ${currentUser.lastName}');

        final insertData = {
          'card_no': qrData,
          'access_status': 'izin_verildi',
          'employee_id': employeeId,
          'employee_name': '${currentUser.firstName} ${currentUser.lastName}',
          'device_id': finalDeviceId,
          'access_time': DateTime.now().toIso8601String(),
          'raw_data': type,
          'project_id': 1, // Ana proje ID'si
        };
        
        print('DEBUG: Insert data: $insertData');
        
        final response = await supabase.from('card_readings').insert(insertData).select();

        if (response.isNotEmpty) {
          await loadAttendanceRecords();
          _isLoading = false;
          notifyListeners();
          return true;
        }
      } else {
        // Adminler için önce employee_auth tablosundan employee_id'yi al
        final authUserId = _authProvider?.supabaseUser?.id;
        if (authUserId == null) return false;
        
        // Auth user'ın employee_auth kaydından employee_id'yi al
        final employeeAuthResponse = await supabase
            .from('employee_auth')
            .select('employee_id, employee:employees(first_name, last_name)')
            .eq('id', authUserId)
            .maybeSingle();

        int? employeeId;
        String employeeName = '${currentUser.firstName} ${currentUser.lastName}';
        
        if (employeeAuthResponse != null) {
          employeeId = employeeAuthResponse['employee_id'];
          final employeeData = employeeAuthResponse['employee'];
          if (employeeData != null) {
            employeeName = '${employeeData['first_name']} ${employeeData['last_name']}';
          }
        }
        
        // Device ID'yi serial number'dan bul
        int finalDeviceId = 1; // Varsayılan device_id
        
        // QR kod verisindeki büyük sayı serial number olabilir
        String? serialNumber;
        if (parsedData['device_id'] != null) {
          serialNumber = parsedData['device_id'].toString();
        } else if (qrData.isNotEmpty) {
          // QR kod direkt serial number olabilir
          serialNumber = qrData;
        }
        
        print('DEBUG: Looking for serial number: $serialNumber');
        
        // Serial number'dan device_id'yi bul
        if (serialNumber != null && serialNumber.isNotEmpty) {
          try {
            final deviceResponse = await supabase
                .from('devices')
                .select('id, name, device_serial')
                .eq('device_serial', serialNumber)
                .eq('is_active', true)
                .maybeSingle();
            
            if (deviceResponse != null) {
              finalDeviceId = deviceResponse['id'];
              print('DEBUG: Found device: ${deviceResponse['name']} with ID: $finalDeviceId');
            } else {
              print('DEBUG: Serial number not found in devices table, using default device_id: 1');
            }
          } catch (e) {
            print('DEBUG: Error looking up device: $e, using default device_id: 1');
          }
        }
        
        print('DEBUG: Final device_id: $finalDeviceId');

        final response = await supabase.from('card_readings').insert({
          'card_no': qrData,
          'access_status': 'izin_verildi',
          'employee_id': employeeId, // Null olabilir, admin için
          'employee_name': employeeName,
          'device_id': finalDeviceId,
          'access_time': DateTime.now().toIso8601String(),
          'raw_data': type,
          'project_id': 1,
        }).select();

        if (response.isNotEmpty) {
          await loadAttendanceRecords();
          _isLoading = false;
          notifyListeners();
          return true;
        }
      }

      _isLoading = false;
      notifyListeners();
      return false;
    } catch (error) {
      _isLoading = false;
      _errorMessage = error.toString();
      notifyListeners();
      return false;
    }
  }

  // İstatistikler için yardımcı metodlar
  int get totalDaysThisMonth {
    final now = DateTime.now();
    final lastDayOfMonth = DateTime(now.year, now.month + 1, 0);
    
    return lastDayOfMonth.day;
  }

  int get daysPresent {
    final now = DateTime.now();
    final firstDayOfMonth = DateTime(now.year, now.month, 1);
    
    return _attendanceRecords
        .where((record) => 
            record.type == 'check_in' && 
            record.timestamp.isAfter(firstDayOfMonth) &&
            record.timestamp.isBefore(now))
        .length;
  }

  int get timesLate {
    // 09:00'dan sonra gelen kayıtları geç sayıyoruz
    const lateTime = Duration(hours: 9);
    
    return _attendanceRecords
        .where((record) => 
            record.type == 'check_in' && 
            Duration(hours: record.timestamp.hour, minutes: record.timestamp.minute) > lateTime)
        .length;
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
} 