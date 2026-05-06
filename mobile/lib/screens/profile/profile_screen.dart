import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/spacing.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/auth_provider.dart';
import '../../providers/preferred_device_provider.dart';
import '../../providers/theme_provider.dart';
import '../../router/app_router.dart';
import '../../theme/app_theme.dart';
import '../../widgets/responsive_container.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: isDark ? AppTheme.darkBackground : Colors.grey[50],
      appBar: AppBar(
        title: Text(l10n.profileTitle),
        backgroundColor: Colors.transparent,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => _showSettingsDialog(context),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: ResponsiveContainer(
          maxWidth: AppSpacing.contentMaxWidth,
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
      ),
    );
  }

  Widget _buildProfileHeader(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Consumer<AuthProvider>(
      builder: (context, authProvider, _) {
        final user = authProvider.currentUser;
        final firstName = user?.firstName ?? l10n.homeGreetingFallback;
        final lastName = user?.lastName ?? '';
        final email = user?.email ?? l10n.profileFallbackEmail;

        return Container(
          width: double.infinity,
          margin: const EdgeInsets.all(16),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                children: [
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
                  Text(
                    '$firstName $lastName'.trim(),
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    email,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: () => _showEditProfileDialog(context),
                    icon: const Icon(Icons.edit),
                    label: Text(l10n.profileEditButton),
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
    final l10n = AppLocalizations.of(context);
    final localeTag = Localizations.localeOf(context).languageCode;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Card(
        child: Column(
          children: [
            _buildOptionTile(
              context,
              Icons.notifications_outlined,
              l10n.profileNotifications,
              l10n.profileNotificationsSubtitle,
              () => _showNotificationsDialog(context),
            ),
            const Divider(height: 1),
            _buildOptionTile(
              context,
              Icons.security_outlined,
              l10n.profileSecurity,
              l10n.profileSecuritySubtitle,
              () => _showSecurityDialog(context),
            ),
            const Divider(height: 1),
            Consumer<ThemeProvider>(
              builder: (context, themeProvider, _) => _buildOptionTile(
                context,
                Icons.dark_mode_outlined,
                l10n.profileTheme,
                _themeModeLabel(l10n, themeProvider.themeMode),
                () => _showThemeDialog(context),
              ),
            ),
            const Divider(height: 1),
            _buildOptionTile(
              context,
              Icons.language_outlined,
              l10n.profileLanguage,
              localeTag == 'tr' ? l10n.profileLanguageValueTr : l10n.profileLanguageValueEn,
              () => _showLanguageDialog(context),
            ),
            const Divider(height: 1),
            Consumer<PreferredDeviceProvider>(
              builder: (context, preferred, _) => _buildOptionTile(
                context,
                Icons.door_front_door_outlined,
                l10n.profilePreferredDoor,
                preferred.deviceName ?? l10n.profilePreferredDoorEmpty,
                () => context.push(AppRoute.selectDevice),
              ),
            ),
            const Divider(height: 1),
            _buildOptionTile(
              context,
              Icons.help_outline,
              l10n.profileHelp,
              l10n.profileHelpSubtitle,
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
    final l10n = AppLocalizations.of(context);
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Card(
        child: Column(
          children: [
            _buildOptionTile(
              context,
              Icons.info_outline,
              l10n.profileAboutApp,
              l10n.profileAppVersion,
              () => _showAboutDialog(context),
            ),
            const Divider(height: 1),
            _buildOptionTile(
              context,
              Icons.privacy_tip_outlined,
              l10n.profilePrivacy,
              l10n.profilePrivacySubtitle,
              () => _showPrivacyDialog(context),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: Text(
                l10n.profileLogout,
                style: const TextStyle(color: Colors.red),
              ),
              subtitle: Text(l10n.profileLogoutSubtitle),
              onTap: () => _showLogoutDialog(context),
            ),
          ],
        ),
      ),
    );
  }

  void _showEditProfileDialog(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.profileEditButton),
        content: Text(l10n.profileEditDialogBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.commonOk),
          ),
        ],
      ),
    );
  }

  void _showNotificationsDialog(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.profileNotificationsDialogTitle),
        content: Text(l10n.profileNotificationsDialogBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.commonOk),
          ),
        ],
      ),
    );
  }

  void _showSecurityDialog(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.profileSecurityDialogTitle),
        content: Text(l10n.profileSecurityDialogBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.commonOk),
          ),
        ],
      ),
    );
  }

  void _showThemeDialog(BuildContext context) {
    final themeProvider = context.read<ThemeProvider>();
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: Text(l10n.profileTheme),
          contentPadding: const EdgeInsets.symmetric(vertical: 12),
          content: RadioGroup<ThemeMode>(
            groupValue: themeProvider.themeMode,
            onChanged: (selected) {
              if (selected == null) return;
              themeProvider.setThemeMode(selected);
              Navigator.pop(dialogContext);
            },
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final mode in ThemeMode.values)
                  RadioListTile<ThemeMode>(
                    title: Text(_themeModeLabel(l10n, mode)),
                    value: mode,
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text(l10n.commonClose),
            ),
          ],
        );
      },
    );
  }

  String _themeModeLabel(AppLocalizations l10n, ThemeMode mode) {
    switch (mode) {
      case ThemeMode.light:
        return l10n.profileThemeModeLight;
      case ThemeMode.dark:
        return l10n.profileThemeModeDark;
      case ThemeMode.system:
        return l10n.profileThemeModeSystem;
    }
  }

  void _showLanguageDialog(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.profileLanguageDialogTitle),
        content: Text(l10n.profileLanguageDialogBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.commonOk),
          ),
        ],
      ),
    );
  }

  void _showHelpDialog(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.profileHelpDialogTitle),
        content: Text(l10n.profileHelpDialogBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.commonOk),
          ),
        ],
      ),
    );
  }

  void _showAboutDialog(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.profileAboutDialogTitle),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.profileAboutLine1),
            const SizedBox(height: 8),
            Text(l10n.profileAboutLine2),
            const SizedBox(height: 8),
            Text(l10n.profileAboutLine3),
            const SizedBox(height: 8),
            Text(l10n.profileAboutLine4),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.commonOk),
          ),
        ],
      ),
    );
  }

  void _showPrivacyDialog(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.profilePrivacyDialogTitle),
        content: Text(l10n.profilePrivacyDialogBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.commonOk),
          ),
        ],
      ),
    );
  }

  void _showSettingsDialog(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.profileSettings),
        content: Text(l10n.profileSettingsBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.commonOk),
          ),
        ],
      ),
    );
  }

  void _showLogoutDialog(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.profileLogoutConfirmTitle),
        content: Text(l10n.profileLogoutConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.commonCancel),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context); // Close dialog
              // signOut → state clear → notifyListeners → router redirect → /login.
              await context.read<AuthProvider>().signOut();
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: Text(l10n.profileLogout),
          ),
        ],
      ),
    );
  }
}
