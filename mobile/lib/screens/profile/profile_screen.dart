import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../theme/app_theme.dart';
import '../auth/login_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Scaffold(
      backgroundColor: isDark ? AppTheme.darkBackground : Colors.grey[50],
      appBar: AppBar(
        title: const Text('Profil'),
        backgroundColor: Colors.transparent,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => _showSettingsDialog(context),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildProfileHeader(context),
            const SizedBox(height: 24),
            _buildProfileOptions(context),
            const SizedBox(height: 24),
            _buildAppInfo(context),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileHeader(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, authProvider, _) {
        final user = authProvider.currentUser;
        final firstName = user?.firstName ?? 'Kullanıcı';
        final lastName = user?.lastName ?? '';
        final email = user?.email ?? 'email@example.com';
        
        return Container(
          width: double.infinity,
          margin: const EdgeInsets.all(16),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                children: [
                  // Profile picture placeholder
                  Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Theme.of(context).brightness == Brightness.dark
                          ? AppTheme.primaryBurgundy2
                          : AppTheme.primaryBurgundy,
                      boxShadow: [
                        BoxShadow(
                          color: (Theme.of(context).brightness == Brightness.dark
                                  ? AppTheme.primaryBurgundy2
                                  : AppTheme.primaryBurgundy)
                              .withValues(alpha: 0.3),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Text(
                        firstName.isNotEmpty ? firstName[0].toUpperCase() : 'U',
                        style: const TextStyle(
                          fontSize: 40,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  // User name
                  Text(
                    '$firstName $lastName'.trim(),
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  
                  // Email
                  Text(
                    email,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  // Edit profile button
                  ElevatedButton.icon(
                    onPressed: () => _showEditProfileDialog(context),
                    icon: const Icon(Icons.edit),
                    label: const Text('Profili Düzenle'),
                    style: ElevatedButton.styleFrom(
                      foregroundColor: Theme.of(context).brightness == Brightness.dark
                          ? AppTheme.primaryBurgundy2
                          : AppTheme.primaryBurgundy,
                      backgroundColor: Colors.transparent,
                      elevation: 0,
                      side: BorderSide(
                        color: Theme.of(context).brightness == Brightness.dark
                            ? AppTheme.primaryBurgundy2
                            : AppTheme.primaryBurgundy,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildProfileOptions(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Card(
        child: Column(
          children: [
            _buildOptionTile(
              context,
              Icons.notifications_outlined,
              'Bildirimler',
              'Bildirim ayarlarını yönet',
              () => _showNotificationsDialog(context),
            ),
            const Divider(height: 1),
            _buildOptionTile(
              context,
              Icons.security_outlined,
              'Güvenlik',
              'Şifre ve güvenlik ayarları',
              () => _showSecurityDialog(context),
            ),
            const Divider(height: 1),
            _buildOptionTile(
              context,
              Icons.dark_mode_outlined,
              'Tema',
              isDark ? 'Koyu tema aktif' : 'Açık tema aktif',
              () => _showThemeDialog(context),
            ),
            const Divider(height: 1),
            _buildOptionTile(
              context,
              Icons.language_outlined,
              'Dil',
              'Türkçe',
              () => _showLanguageDialog(context),
            ),
            const Divider(height: 1),
            _buildOptionTile(
              context,
              Icons.help_outline,
              'Yardım & Destek',
              'SSS ve destek',
              () => _showHelpDialog(context),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOptionTile(
    BuildContext context,
    IconData icon,
    String title,
    String subtitle,
    VoidCallback onTap,
  ) {
    return ListTile(
      leading: Icon(icon),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }

  Widget _buildAppInfo(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Card(
        child: Column(
          children: [
            _buildOptionTile(
              context,
              Icons.info_outline,
              'Uygulama Hakkında',
              'Versiyon 1.0.0',
              () => _showAboutDialog(context),
            ),
            const Divider(height: 1),
            _buildOptionTile(
              context,
              Icons.privacy_tip_outlined,
              'Gizlilik Politikası',
              'Veri kullanım politikası',
              () => _showPrivacyDialog(context),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: const Text(
                'Çıkış Yap',
                style: TextStyle(color: Colors.red),
              ),
              subtitle: const Text('Hesabınızdan çıkış yapın'),
              onTap: () => _showLogoutDialog(context),
            ),
          ],
        ),
      ),
    );
  }

  void _showEditProfileDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Profili Düzenle'),
        content: const Text('Profil düzenleme özelliği yakında eklenecek.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  void _showNotificationsDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Bildirim Ayarları'),
        content: const Text('Bildirim ayarları yakında eklenecek.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  void _showSecurityDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Güvenlik Ayarları'),
        content: const Text('Güvenlik ayarları yakında eklenecek.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  void _showThemeDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Tema Ayarları'),
        content: const Text('Tema ayarları yakında eklenecek.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  void _showLanguageDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Dil Ayarları'),
        content: const Text('Dil ayarları yakında eklenecek.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  void _showHelpDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Yardım & Destek'),
        content: const Text('Yardım ve destek sayfası yakında eklenecek.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  void _showAboutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('NGS Plus Hakkında'),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('NGS Plus Yoklama Takip Sistemi'),
            SizedBox(height: 8),
            Text('Versiyon: 1.0.0'),
            SizedBox(height: 8),
            Text('Geliştirici: NGS Team'),
            SizedBox(height: 8),
            Text('QR kod tabanlı yoklama takip uygulaması.'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  void _showPrivacyDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Gizlilik Politikası'),
        content: const Text('Gizlilik politikası yakında eklenecek.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  void _showSettingsDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Ayarlar'),
        content: const Text('Gelişmiş ayarlar yakında eklenecek.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  void _showLogoutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Çıkış Yap'),
        content: const Text('Hesabınızdan çıkış yapmak istediğinizden emin misiniz?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('İptal'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context); // Close dialog
              
              final authProvider = Provider.of<AuthProvider>(context, listen: false);
              await authProvider.signOut();
              
              if (context.mounted) {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                  (route) => false,
                );
              }
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Çıkış Yap'),
          ),
        ],
      ),
    );
  }
} 