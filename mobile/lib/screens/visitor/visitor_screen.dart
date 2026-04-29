import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../theme/app_theme.dart';

class VisitorScreen extends StatefulWidget {
  const VisitorScreen({super.key});

  @override
  State<VisitorScreen> createState() => _VisitorScreenState();
}

class _VisitorScreenState extends State<VisitorScreen> {
  // Demo data - gerçek uygulamada Supabase'den gelecek
  final List<Visitor> _visitors = [
    Visitor(
      id: '1',
      name: 'Ahmet Yılmaz',
      company: 'ABC Şirket',
      purpose: 'İş toplantısı',
      visitDate: DateTime.now().subtract(const Duration(hours: 2)),
      status: VisitorStatus.checkedIn,
      contactPerson: 'Mehmet Demir',
    ),
    Visitor(
      id: '2',
      name: 'Elif Kaya',
      company: 'XYZ Teknoloji',
      purpose: 'Proje sunumu',
      visitDate: DateTime.now().subtract(const Duration(days: 1)),
      status: VisitorStatus.checkedOut,
      contactPerson: 'Ayşe Öz',
    ),
    Visitor(
      id: '3',
      name: 'Can Özkan',
      company: 'Freelancer',
      purpose: 'Müşteri görüşmesi',
      visitDate: DateTime.now().add(const Duration(hours: 2)),
      status: VisitorStatus.expected,
      contactPerson: 'Ali Veli',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Scaffold(
      backgroundColor: isDark ? AppTheme.darkBackground : Colors.grey[50],
      appBar: AppBar(
        title: const Text('Ziyaretçi Yönetimi'),
        backgroundColor: Colors.transparent,
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: _showFilterDialog,
          ),
        ],
      ),
      body: Column(
        children: [
          _buildStatsRow(),
          Expanded(
            child: _visitors.isEmpty 
                ? _buildEmptyState()
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _visitors.length,
                    itemBuilder: (context, index) {
                      final visitor = _visitors[index];
                      return _buildVisitorCard(visitor);
                    },
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddVisitorDialog,
        icon: const Icon(Icons.person_add),
        label: const Text('Ziyaretçi Ekle'),
        backgroundColor: Theme.of(context).brightness == Brightness.dark
            ? AppTheme.primaryBurgundy2
            : AppTheme.primaryBurgundy,
      ),
    );
  }

  Widget _buildStatsRow() {
    final checkedIn = _visitors.where((v) => v.status == VisitorStatus.checkedIn).length;
    final expected = _visitors.where((v) => v.status == VisitorStatus.expected).length;
    final total = _visitors.length;

    return Container(
      margin: const EdgeInsets.all(16),
      child: Row(
        children: [
          Expanded(
            child: _buildStatCard('Toplam', total.toString(), Colors.blue),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _buildStatCard('İçeride', checkedIn.toString(), Colors.green),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _buildStatCard('Beklenen', expected.toString(), Colors.orange),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(String title, String value, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.people_outline,
            size: 80,
            color: Colors.grey[400],
          ),
          const SizedBox(height: 16),
          Text(
            'Henüz ziyaretçi kaydı yok',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: Colors.grey[600],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Yeni ziyaretçi eklemek için + butonuna tıklayın',
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: Colors.grey[500],
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildVisitorCard(Visitor visitor) {
    final statusColor = _getStatusColor(visitor.status);
    final statusText = _getStatusText(visitor.status);
    final statusIcon = _getStatusIcon(visitor.status);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        visitor.name,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (visitor.company.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          visitor.company,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(statusIcon, size: 16, color: statusColor),
                      const SizedBox(width: 4),
                      Text(
                        statusText,
                        style: TextStyle(
                          color: statusColor,
                          fontWeight: FontWeight.w500,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            
            Row(
              children: [
                Icon(Icons.schedule, size: 16, color: Colors.grey[600]),
                const SizedBox(width: 8),
                Text(
                  DateFormat('dd/MM/yyyy HH:mm').format(visitor.visitDate),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            
            Row(
              children: [
                Icon(Icons.work_outline, size: 16, color: Colors.grey[600]),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    visitor.purpose,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.grey[600],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            
            Row(
              children: [
                Icon(Icons.person_outline, size: 16, color: Colors.grey[600]),
                const SizedBox(width: 8),
                Text(
                  'İletişim: ${visitor.contactPerson}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
            
            if (visitor.status == VisitorStatus.checkedIn) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _checkOutVisitor(visitor),
                  icon: const Icon(Icons.logout, size: 16),
                  label: const Text('Çıkış Yap'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                ),
              ),
            ] else if (visitor.status == VisitorStatus.expected) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _checkInVisitor(visitor),
                  icon: const Icon(Icons.login, size: 16),
                  label: const Text('Giriş Yap'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Color _getStatusColor(VisitorStatus status) {
    switch (status) {
      case VisitorStatus.expected:
        return Colors.orange;
      case VisitorStatus.checkedIn:
        return Colors.green;
      case VisitorStatus.checkedOut:
        return Colors.grey;
    }
  }

  String _getStatusText(VisitorStatus status) {
    switch (status) {
      case VisitorStatus.expected:
        return 'Bekleniyor';
      case VisitorStatus.checkedIn:
        return 'İçeride';
      case VisitorStatus.checkedOut:
        return 'Çıktı';
    }
  }

  IconData _getStatusIcon(VisitorStatus status) {
    switch (status) {
      case VisitorStatus.expected:
        return Icons.schedule;
      case VisitorStatus.checkedIn:
        return Icons.check_circle;
      case VisitorStatus.checkedOut:
        return Icons.exit_to_app;
    }
  }

  void _checkInVisitor(Visitor visitor) {
    setState(() {
      visitor.status = VisitorStatus.checkedIn;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${visitor.name} giriş yaptı'),
        backgroundColor: Colors.green,
      ),
    );
  }

  void _checkOutVisitor(Visitor visitor) {
    setState(() {
      visitor.status = VisitorStatus.checkedOut;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${visitor.name} çıkış yaptı'),
        backgroundColor: Colors.red,
      ),
    );
  }

  void _showFilterDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Filtrele'),
        content: const Text('Filtreleme seçenekleri buraya gelecek.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Kapat'),
          ),
        ],
      ),
    );
  }

  void _showAddVisitorDialog() {
    final nameController = TextEditingController();
    final companyController = TextEditingController();
    final purposeController = TextEditingController();
    final contactController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Yeni Ziyaretçi'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: 'Ad Soyad',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: companyController,
                decoration: const InputDecoration(
                  labelText: 'Şirket',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: purposeController,
                decoration: const InputDecoration(
                  labelText: 'Ziyaret Amacı',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: contactController,
                decoration: const InputDecoration(
                  labelText: 'İletişim Kişisi',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('İptal'),
          ),
          TextButton(
            onPressed: () {
              if (nameController.text.isNotEmpty) {
                setState(() {
                  _visitors.add(Visitor(
                    id: DateTime.now().millisecondsSinceEpoch.toString(),
                    name: nameController.text,
                    company: companyController.text,
                    purpose: purposeController.text,
                    visitDate: DateTime.now(),
                    status: VisitorStatus.expected,
                    contactPerson: contactController.text,
                  ));
                });
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Ziyaretçi eklendi'),
                    backgroundColor: Colors.green,
                  ),
                );
              }
            },
            child: const Text('Ekle'),
          ),
        ],
      ),
    );
  }
}

class Visitor {
  final String id;
  final String name;
  final String company;
  final String purpose;
  final DateTime visitDate;
  VisitorStatus status;
  final String contactPerson;

  Visitor({
    required this.id,
    required this.name,
    required this.company,
    required this.purpose,
    required this.visitDate,
    required this.status,
    required this.contactPerson,
  });
}

enum VisitorStatus {
  expected,
  checkedIn,
  checkedOut,
} 