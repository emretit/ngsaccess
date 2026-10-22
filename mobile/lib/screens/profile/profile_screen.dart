import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';

import '../../core/spacing.dart';
import '../../core/error_localizer.dart';
import '../../core/password_policy.dart';
import '../../core/safe_diagnostics.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/auth_provider.dart';
import '../../providers/locale_provider.dart';
import '../../providers/preferred_device_provider.dart';
import '../../providers/theme_provider.dart';
import '../../router/app_router.dart';
import '../../widgets/responsive_container.dart';

enum _ProfilePage { details, notifications, help, security, about, privacy }

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, this.packageInfoLoader, this.diagnostics});

  final Future<PackageInfo> Function()? packageInfoLoader;
  final SafeDiagnostics? diagnostics;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final Future<PackageInfo> _packageInfo;

  @override
  void initState() {
    super.initState();
    final loader = widget.packageInfoLoader;
    _packageInfo = loader == null ? PackageInfo.fromPlatform() : loader();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = Theme.of(context).colorScheme;
    final user = context.watch<AuthProvider>().currentUser;
    final firstName = user?.firstName.trim() ?? '';
    final fullName = [
      firstName,
      user?.lastName.trim() ?? '',
    ].where((value) => value.isNotEmpty).join(' ');
    final initial = firstName.isEmpty ? '?' : firstName.characters.first;
    final projectName = user?.projectId?.trim().isNotEmpty == true
        ? user?.projectName?.trim()
        : null;
    final preferred = context.watch<PreferredDeviceProvider>();
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.profileTitle),
        actions: [
          IconButton(
            tooltip: l10n.profileHelp,
            icon: const Icon(Icons.help_outline),
            onPressed: _showHelp,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: ResponsiveContainer(
          maxWidth: AppSpacing.contentMaxWidth,
          child: Column(
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: SizedBox(
                    width: double.infinity,
                    child: Column(
                      children: [
                        ExcludeSemantics(
                          child: CircleAvatar(
                            radius: 42,
                            backgroundColor: colors.primaryContainer,
                            foregroundColor: colors.onPrimaryContainer,
                            child: Text(
                              initial == 'i' &&
                                      Localizations.localeOf(
                                            context,
                                          ).languageCode ==
                                          'tr'
                                  ? 'İ'
                                  : initial.toUpperCase(),
                              style: Theme.of(context).textTheme.headlineLarge
                                  ?.copyWith(color: colors.onPrimaryContainer),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          fullName.isEmpty
                              ? l10n.homeGreetingFallback
                              : fullName,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          user?.email.isNotEmpty == true
                              ? user?.email ?? ''
                              : l10n.profileFallbackEmail,
                          textAlign: TextAlign.center,
                          style: TextStyle(color: colors.onSurfaceVariant),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          l10n.profileProject,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(color: colors.onSurfaceVariant),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          projectName?.isNotEmpty == true
                              ? projectName ?? ''
                              : l10n.profileProjectUnavailable,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 16),
                        OutlinedButton.icon(
                          icon: const Icon(Icons.badge_outlined),
                          label: Text(l10n.profileEditButton),
                          onPressed: () => _openContent(_ProfilePage.details),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Card(
                child: Column(
                  children: [
                    Consumer<ThemeProvider>(
                      builder: (context, theme, _) => _tile(
                        Icons.palette_outlined,
                        l10n.profileTheme,
                        _themeLabel(l10n, theme.themeMode),
                        _showTheme,
                      ),
                    ),
                    const Divider(height: 1),
                    Consumer<LocaleProvider>(
                      builder: (context, locale, _) => _tile(
                        Icons.language,
                        l10n.profileLanguage,
                        _localeLabel(l10n, locale.locale?.languageCode),
                        _showLanguage,
                      ),
                    ),
                    const Divider(height: 1),
                    _tile(
                      Icons.door_front_door_outlined,
                      l10n.profilePreferredDoor,
                      preferred.hasDevice
                          ? preferred.deviceName ?? l10n.historyUnknownDevice
                          : l10n.profilePreferredDoorEmpty,
                      () => context.push(AppRoute.selectDevice),
                    ),
                    const Divider(height: 1),
                    _tile(
                      Icons.security_outlined,
                      l10n.profileSecurity,
                      l10n.profileSecuritySubtitle,
                      _showSecurity,
                    ),
                    const Divider(height: 1),
                    _tile(
                      Icons.notifications_outlined,
                      l10n.profileNotifications,
                      l10n.profileNotificationsSubtitle,
                      () => _openContent(_ProfilePage.notifications),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Card(
                child: Column(
                  children: [
                    _tile(
                      Icons.help_outline,
                      l10n.profileHelp,
                      l10n.profileHelpSubtitle,
                      _showHelp,
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.info_outline),
                      title: Text(l10n.profileAboutApp),
                      subtitle: _VersionLabel(info: _packageInfo),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => _openContent(_ProfilePage.about),
                    ),
                    const Divider(height: 1),
                    _tile(
                      Icons.privacy_tip_outlined,
                      l10n.profilePrivacy,
                      l10n.profilePrivacySubtitle,
                      () => _openContent(_ProfilePage.privacy),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: Icon(Icons.logout, color: colors.error),
                      title: Text(
                        l10n.profileLogout,
                        style: TextStyle(color: colors.error),
                      ),
                      subtitle: Text(l10n.profileLogoutSubtitle),
                      onTap: _showLogout,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tile(
    IconData icon,
    String title,
    String subtitle,
    VoidCallback onTap,
  ) => ListTile(
    leading: Icon(icon),
    title: Text(title),
    subtitle: Text(subtitle),
    trailing: const Icon(Icons.chevron_right),
    onTap: onTap,
  );

  void _openContent(_ProfilePage page) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => _ProfileContentScreen(
          page: page,
          packageInfo: _packageInfo,
          diagnostics: widget.diagnostics ?? SafeDiagnostics.instance,
        ),
      ),
    );
  }

  void _showHelp() => _openContent(_ProfilePage.help);

  void _showSecurity() => _openContent(_ProfilePage.security);

  String _themeLabel(AppLocalizations l10n, ThemeMode mode) => switch (mode) {
    ThemeMode.light => l10n.profileThemeModeLight,
    ThemeMode.dark => l10n.profileThemeModeDark,
    ThemeMode.system => l10n.profileThemeModeSystem,
  };

  String _localeLabel(AppLocalizations l10n, String? code) => switch (code) {
    'tr' => l10n.profileLanguageValueTr,
    'en' => l10n.profileLanguageValueEn,
    _ => l10n.profileLanguageSystem,
  };

  void _showTheme() {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => Consumer<ThemeProvider>(
        builder: (context, provider, _) {
          final l10n = AppLocalizations.of(context);
          return AlertDialog(
            title: Text(l10n.profileTheme),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (provider.isSaving) const LinearProgressIndicator(),
                  RadioGroup<ThemeMode>(
                    groupValue: provider.themeMode,
                    onChanged: (mode) async {
                      if (mode == null || provider.isSaving) return;
                      final saved = await provider.setThemeMode(mode);
                      if (saved && dialogContext.mounted) {
                        Navigator.of(dialogContext).pop();
                      }
                    },
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        for (final mode in ThemeMode.values)
                          RadioListTile<ThemeMode>(
                            value: mode,
                            title: Text(_themeLabel(l10n, mode)),
                            enabled: !provider.isSaving,
                          ),
                      ],
                    ),
                  ),
                  if (provider.error != null)
                    Semantics(
                      liveRegion: true,
                      child: Text(
                        l10n.preferenceSaveFailed,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: provider.isSaving
                    ? null
                    : () => Navigator.of(dialogContext).pop(),
                child: Text(l10n.commonClose),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showLanguage() {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => Consumer<LocaleProvider>(
        builder: (context, provider, _) {
          final l10n = AppLocalizations.of(context);
          return AlertDialog(
            title: Text(l10n.profileLanguage),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(l10n.profileLanguageScope),
                  if (provider.isSaving) const LinearProgressIndicator(),
                  RadioGroup<String>(
                    groupValue: provider.locale?.languageCode ?? 'system',
                    onChanged: (code) async {
                      if (code == null || provider.isSaving) return;
                      final saved = await provider.setLocale(
                        code == 'system' ? null : Locale(code),
                      );
                      if (saved && dialogContext.mounted) {
                        Navigator.of(dialogContext).pop();
                      }
                    },
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        for (final code in ['system', 'tr', 'en'])
                          RadioListTile<String>(
                            value: code,
                            title: Text(_localeLabel(l10n, code)),
                            enabled: !provider.isSaving,
                          ),
                      ],
                    ),
                  ),
                  if (provider.error != null)
                    Semantics(
                      liveRegion: true,
                      child: Text(
                        l10n.preferenceSaveFailed,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: provider.isSaving
                    ? null
                    : () => Navigator.of(dialogContext).pop(),
                child: Text(l10n.commonClose),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showLogout() {
    final l10n = AppLocalizations.of(context);
    final auth = context.read<AuthProvider>();
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.profileLogoutConfirmTitle),
        content: Text(l10n.profileLogoutConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(l10n.commonCancel),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(dialogContext).pop();
              await auth.signOut();
            },
            style: TextButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.error,
            ),
            child: Text(l10n.profileLogout),
          ),
        ],
      ),
    );
  }
}

class _ProfileContentScreen extends StatelessWidget {
  const _ProfileContentScreen({
    required this.page,
    required this.packageInfo,
    required this.diagnostics,
  });
  final _ProfilePage page;
  final Future<PackageInfo> packageInfo;
  final SafeDiagnostics diagnostics;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final user = context.watch<AuthProvider>().currentUser;
    final projectName = user?.projectId?.trim().isNotEmpty == true
        ? user?.projectName?.trim()
        : null;
    final (title, children) = switch (page) {
      _ProfilePage.details => (
        l10n.profileEditButton,
        <Widget>[
          Text(l10n.profileEditDialogBody),
          const SizedBox(height: 24),
          Text('${l10n.profileFirstName}: ${user?.firstName ?? ''}'),
          Text('${l10n.profileLastName}: ${user?.lastName ?? ''}'),
          Text('${l10n.loginEmailLabel}: ${user?.email ?? ''}'),
          Text(
            '${l10n.profileProject}: ${projectName?.isNotEmpty == true ? projectName : l10n.profileProjectUnavailable}',
          ),
        ],
      ),
      _ProfilePage.notifications => (
        l10n.profileNotifications,
        <Widget>[Text(l10n.profileNotificationsDialogBody)],
      ),
      _ProfilePage.help => (
        l10n.profileHelpDialogTitle,
        <Widget>[
          Text(l10n.profileHelpDialogBody),
          const SizedBox(height: 24),
          _SupportDiagnostics(diagnostics: diagnostics),
        ],
      ),
      _ProfilePage.security => (
        l10n.profileSecurityDialogTitle,
        <Widget>[
          Text(l10n.profileSecurityDialogBody),
          const SizedBox(height: 16),
          Text(l10n.passwordResetAdminInfo),
          const SizedBox(height: 24),
          const _ChangePasswordForm(),
        ],
      ),
      _ProfilePage.about => (
        l10n.profileAboutDialogTitle,
        <Widget>[
          Text(l10n.profileAboutLine1),
          const SizedBox(height: 16),
          _VersionLabel(info: packageInfo),
          const SizedBox(height: 16),
          Text(l10n.profileAboutLine4),
        ],
      ),
      _ProfilePage.privacy => (
        l10n.profilePrivacyDialogTitle,
        <Widget>[Text(l10n.profilePrivacyDialogBody)],
      ),
    };
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ResponsiveContainer(
            maxWidth: AppSpacing.contentMaxWidth,
            child: SelectionArea(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: children,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SupportDiagnostics extends StatefulWidget {
  const _SupportDiagnostics({required this.diagnostics});
  final SafeDiagnostics diagnostics;

  @override
  State<_SupportDiagnostics> createState() => _SupportDiagnosticsState();
}

enum _SupportFeedback { copied, copyFailed, cleared }

class _SupportDiagnosticsState extends State<_SupportDiagnostics> {
  bool _copying = false;
  _SupportFeedback? _feedback;

  Future<void> _copy() async {
    if (_copying) return;
    setState(() {
      _copying = true;
      _feedback = null;
    });
    var copied = false;
    try {
      await Clipboard.setData(
        ClipboardData(text: widget.diagnostics.exportJson()),
      );
      copied = true;
    } catch (_) {
      // Platform failure details may contain private data. Show fixed copy only.
    }
    if (!mounted) return;
    setState(() {
      _copying = false;
      _feedback = copied
          ? _SupportFeedback.copied
          : _SupportFeedback.copyFailed;
    });
  }

  void _clear() {
    widget.diagnostics.clear();
    setState(() => _feedback = _SupportFeedback.cleared);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final feedback = switch (_feedback) {
      _SupportFeedback.copied => l10n.profileDiagnosticsCopied,
      _SupportFeedback.copyFailed => l10n.profileDiagnosticsCopyFailed,
      _SupportFeedback.cleared => l10n.profileDiagnosticsCleared,
      null => null,
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l10n.profileDiagnosticsTitle,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 12),
        Text(l10n.profileDiagnosticsBody),
        const SizedBox(height: 12),
        if (widget.diagnostics.events.isEmpty)
          Text(l10n.profileDiagnosticsEmpty),
        if (feedback != null) ...[
          const SizedBox(height: 12),
          Semantics(liveRegion: true, child: Text(feedback)),
        ],
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: _copying ? null : _copy,
          icon: const Icon(Icons.copy_outlined),
          label: Text(l10n.profileDiagnosticsCopy),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _copying ? null : _clear,
          icon: const Icon(Icons.delete_outline),
          label: Text(l10n.profileDiagnosticsClear),
        ),
      ],
    );
  }
}

class _ChangePasswordForm extends StatefulWidget {
  const _ChangePasswordForm();

  @override
  State<_ChangePasswordForm> createState() => _ChangePasswordFormState();
}

class _ChangePasswordFormState extends State<_ChangePasswordForm> {
  final _form = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _repeat = TextEditingController();
  bool _showPasswords = false;

  @override
  void initState() {
    super.initState();
    // A login failure must not be presented as a password-change failure.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<AuthProvider>().clearError();
    });
  }

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _repeat.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final auth = context.read<AuthProvider>();
    if (auth.isChangingPassword || _form.currentState?.validate() != true) {
      return;
    }
    final saved = await auth.changePassword(
      currentPassword: _current.text,
      newPassword: _next.text,
    );
    if (!mounted || !saved) return;
    _current.clear();
    _next.clear();
    _repeat.clear();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(AppLocalizations.of(context).profilePasswordChanged),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final auth = context.watch<AuthProvider>();
    final busy = auth.isChangingPassword;
    final error = auth.lastError;
    return Form(
      key: _form,
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.profileChangePassword,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            Text(l10n.profilePasswordRules),
            const SizedBox(height: 16),
            TextFormField(
              controller: _current,
              enabled: !busy,
              obscureText: !_showPasswords,
              autocorrect: false,
              enableSuggestions: false,
              autofillHints: const [AutofillHints.password],
              decoration: InputDecoration(
                labelText: l10n.profileCurrentPassword,
              ),
              validator: (value) => value == null || value.isEmpty
                  ? l10n.profilePasswordRequired
                  : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _next,
              enabled: !busy,
              obscureText: !_showPasswords,
              autocorrect: false,
              enableSuggestions: false,
              autofillHints: const [AutofillHints.newPassword],
              decoration: InputDecoration(labelText: l10n.profileNewPassword),
              validator: (value) {
                if (value == null ||
                    !isAcceptableNewPassword(value, current: _current.text)) {
                  return l10n.profilePasswordInvalid;
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _repeat,
              enabled: !busy,
              obscureText: !_showPasswords,
              autocorrect: false,
              enableSuggestions: false,
              autofillHints: const [AutofillHints.newPassword],
              decoration: InputDecoration(
                labelText: l10n.profileRepeatPassword,
              ),
              onFieldSubmitted: (_) => _submit(),
              validator: (value) =>
                  value != _next.text || value == null || value.isEmpty
                  ? l10n.profilePasswordInvalid
                  : null,
            ),
            const SizedBox(height: 8),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              value: _showPasswords,
              onChanged: busy
                  ? null
                  : (value) => setState(() => _showPasswords = value ?? false),
              title: Text(l10n.loginShowPassword),
            ),
            if (error != null)
              Semantics(
                liveRegion: true,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    localizeAppError(context, error),
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              ),
            if (busy) const LinearProgressIndicator(),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: busy ? null : _submit,
              child: Text(l10n.profileChangePassword),
            ),
          ],
        ),
      ),
    );
  }
}

class _VersionLabel extends StatelessWidget {
  const _VersionLabel({required this.info});
  final Future<PackageInfo> info;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return FutureBuilder<PackageInfo>(
      future: info,
      builder: (context, snapshot) {
        final data = snapshot.data;
        if (data == null || data.version.isEmpty || data.buildNumber.isEmpty) {
          return Text(l10n.profileVersionUnavailable);
        }
        return Text(l10n.profileVersionBuild(data.version, data.buildNumber));
      },
    );
  }
}
