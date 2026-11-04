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
import '../../widgets/ui/ui.dart';

enum _ProfilePage {
  details,
  notifications,
  help,
  security,
  about,
  privacy,
  diagnostics,
}

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
    return AppScaffold(
      header: AppPageHeader(title: l10n.profileTitle),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: ResponsiveContainer(
          maxWidth: AppSpacing.contentMaxWidth,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  ExcludeSemantics(
                    child: CircleAvatar(
                      radius: 24,
                      backgroundColor: AppUiTokens.of(context).subtle,
                      foregroundColor: colors.onSurface,
                      child: Text(
                        initial == 'i' &&
                                Localizations.localeOf(context).languageCode ==
                                    'tr'
                            ? 'İ'
                            : initial.toUpperCase(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          fullName.isEmpty
                              ? l10n.homeGreetingFallback
                              : fullName,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        Text(
                          user?.email.isNotEmpty == true
                              ? user?.email ?? ''
                              : l10n.profileFallbackEmail,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: colors.onSurfaceVariant),
                        ),
                        Semantics(
                          label: l10n.profileProject,
                          child: Text(
                            projectName?.isNotEmpty == true
                                ? projectName ?? ''
                                : l10n.profileProjectUnavailable,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: colors.onSurfaceVariant),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              AppListGroup(
                title: l10n.profileAccountSection,
                children: [
                  AppListRow(
                    leadingIcon: Icons.badge_outlined,
                    title: l10n.profileEditButton,
                    showChevron: true,
                    onTap: () => _openContent(_ProfilePage.details),
                  ),
                  AppListRow(
                    leadingIcon: Icons.security_outlined,
                    title: l10n.profileChangePassword,
                    showChevron: true,
                    onTap: _showSecurity,
                  ),
                ],
              ),
              const SizedBox(height: 24),
              AppListGroup(
                title: l10n.profilePreferencesSection,
                children: [
                  Consumer<ThemeProvider>(
                    builder: (context, theme, _) => _tile(
                      Icons.palette_outlined,
                      l10n.profileTheme,
                      _themeLabel(l10n, theme.themeMode),
                      _showTheme,
                    ),
                  ),
                  Consumer<LocaleProvider>(
                    builder: (context, locale, _) => _tile(
                      Icons.language,
                      l10n.profileLanguage,
                      _localeLabel(l10n, locale.locale?.languageCode),
                      _showLanguage,
                    ),
                  ),
                  _tile(
                    Icons.door_front_door_outlined,
                    l10n.profilePreferredDoor,
                    preferred.hasDevice
                        ? preferred.deviceName ?? l10n.historyUnknownDevice
                        : l10n.profilePreferredDoorEmpty,
                    () => context.push(AppRoute.selectDevice),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              AppListGroup(
                title: l10n.profileSupportSection,
                children: [
                  _tile(
                    Icons.notifications_outlined,
                    l10n.profileNotifications,
                    l10n.profileNotificationsSubtitle,
                    () => _openContent(_ProfilePage.notifications),
                  ),
                  _tile(
                    Icons.help_outline,
                    l10n.profileHelp,
                    l10n.profileHelpSubtitle,
                    _showHelp,
                  ),
                  AppListRow(
                    leadingIcon: Icons.assignment_outlined,
                    title: l10n.profileDiagnosticsTitle,
                    showChevron: true,
                    onTap: () => _openContent(_ProfilePage.diagnostics),
                  ),
                  AppListRow(
                    leadingIcon: Icons.info_outline,
                    title: l10n.profileAboutApp,
                    trailing: _VersionLabel(info: _packageInfo),
                    showChevron: true,
                    onTap: () => _openContent(_ProfilePage.about),
                  ),
                  _tile(
                    Icons.privacy_tip_outlined,
                    l10n.profilePrivacy,
                    l10n.profilePrivacySubtitle,
                    () => _openContent(_ProfilePage.privacy),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              AppListRow(
                title: l10n.profileLogout,
                leadingIcon: Icons.logout,
                tone: AppStatusTone.danger,
                onTap: _showLogout,
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
  ) => AppListRow(
    leadingIcon: icon,
    title: title,
    subtitle: subtitle,
    showChevron: true,
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
    showAppSheet<void>(
      context: context,
      builder: (sheetContext) => Consumer<ThemeProvider>(
        builder: (context, provider, _) {
          final l10n = AppLocalizations.of(context);
          return AppSheet(
            title: l10n.profileTheme,
            busy: provider.isSaving,
            body: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AppListGroup(
                  children: [
                    for (final mode in ThemeMode.values)
                      AppListRow(
                        title: _themeLabel(l10n, mode),
                        selected: provider.themeMode == mode,
                        leadingIcon: switch (mode) {
                          ThemeMode.system => Icons.phone_android_outlined,
                          ThemeMode.light => Icons.light_mode_outlined,
                          ThemeMode.dark => Icons.dark_mode_outlined,
                        },
                        trailing: ExcludeSemantics(
                          child: Align(
                            alignment: Alignment.centerRight,
                            child: Icon(
                              provider.themeMode == mode
                                  ? Icons.radio_button_checked
                                  : Icons.radio_button_unchecked,
                              color: provider.themeMode == mode
                                  ? AppUiTokens.of(context).accent
                                  : Theme.of(context).colorScheme.outline,
                            ),
                          ),
                        ),
                        enabled: !provider.isSaving,
                        onTap: () async {
                          if (provider.isSaving) return;
                          final saved = await provider.setThemeMode(mode);
                          if (saved && sheetContext.mounted) {
                            Navigator.of(sheetContext).pop();
                          }
                        },
                      ),
                  ],
                ),
                if (provider.error != null)
                  AppDataNotice(
                    message: l10n.preferenceSaveFailed,
                    tone: AppStatusTone.danger,
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showLanguage() {
    showAppSheet<void>(
      context: context,
      builder: (sheetContext) => Consumer<LocaleProvider>(
        builder: (context, provider, _) {
          final l10n = AppLocalizations.of(context);
          return AppSheet(
            title: l10n.profileLanguage,
            busy: provider.isSaving,
            body: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(l10n.profileLanguageScope),
                const SizedBox(height: 12),
                AppListGroup(
                  children: [
                    for (final code in ['system', 'tr', 'en'])
                      AppListRow(
                        title: _localeLabel(l10n, code),
                        selected:
                            (provider.locale?.languageCode ?? 'system') == code,
                        leadingIcon: Icons.language,
                        trailing: ExcludeSemantics(
                          child: Align(
                            alignment: Alignment.centerRight,
                            child: Icon(
                              (provider.locale?.languageCode ?? 'system') ==
                                      code
                                  ? Icons.radio_button_checked
                                  : Icons.radio_button_unchecked,
                              color:
                                  (provider.locale?.languageCode ?? 'system') ==
                                      code
                                  ? AppUiTokens.of(context).accent
                                  : Theme.of(context).colorScheme.outline,
                            ),
                          ),
                        ),
                        enabled: !provider.isSaving,
                        onTap: () async {
                          if (provider.isSaving) return;
                          final saved = await provider.setLocale(
                            code == 'system' ? null : Locale(code),
                          );
                          if (saved && sheetContext.mounted) {
                            Navigator.of(sheetContext).pop();
                          }
                        },
                      ),
                  ],
                ),
                if (provider.error != null)
                  AppDataNotice(
                    message: l10n.preferenceSaveFailed,
                    tone: AppStatusTone.danger,
                  ),
              ],
            ),
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
      builder: (dialogContext) => AppDialog(
        title: l10n.profileLogoutConfirmTitle,
        body: Text(l10n.profileLogoutConfirmBody),
        cancelLabel: l10n.commonCancel,
        confirmLabel: l10n.profileLogout,
        destructive: true,
        onCancel: () => Navigator.of(dialogContext).pop(),
        onConfirm: () async {
          Navigator.of(dialogContext).pop();
          await auth.signOut();
        },
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
      _ProfilePage.diagnostics => (
        l10n.profileDiagnosticsTitle,
        <Widget>[
          _SupportDiagnostics(diagnostics: diagnostics, showTitle: false),
        ],
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
        l10n.profileChangePassword,
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
    return AppScaffold(
      header: AppPageHeader(title: title, showBack: true),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
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
    );
  }
}

class _SupportDiagnostics extends StatefulWidget {
  const _SupportDiagnostics({required this.diagnostics, this.showTitle = true});
  final SafeDiagnostics diagnostics;
  final bool showTitle;

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
        if (widget.showTitle) ...[
          Text(
            l10n.profileDiagnosticsTitle,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
        ],
        Text(l10n.profileDiagnosticsBody),
        const SizedBox(height: 12),
        if (widget.diagnostics.events.isEmpty)
          Text(l10n.profileDiagnosticsEmpty),
        if (feedback != null) ...[
          const SizedBox(height: 12),
          Semantics(liveRegion: true, child: Text(feedback)),
        ],
        const SizedBox(height: 12),
        AppPrimaryButton(
          onPressed: _copy,
          busy: _copying,
          icon: Icons.copy_outlined,
          label: l10n.profileDiagnosticsCopy,
        ),
        const SizedBox(height: 8),
        AppSecondaryButton(
          expanded: true,
          onPressed: _copying ? null : _clear,
          icon: Icons.delete_outline,
          label: l10n.profileDiagnosticsClear,
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
            Text(l10n.profilePasswordRules),
            const SizedBox(height: 16),
            AppTextField(
              controller: _current,
              enabled: !busy,
              obscureText: !_showPasswords,
              autocorrect: false,
              enableSuggestions: false,
              autofillHints: const [AutofillHints.password],
              label: l10n.profileCurrentPassword,
              floatingLabelBehavior: FloatingLabelBehavior.always,
              errorMaxLines: 4,
              validator: (value) => value == null || value.isEmpty
                  ? l10n.profilePasswordRequired
                  : null,
            ),
            const SizedBox(height: 16),
            AppTextField(
              controller: _next,
              enabled: !busy,
              obscureText: !_showPasswords,
              autocorrect: false,
              enableSuggestions: false,
              autofillHints: const [AutofillHints.newPassword],
              label: l10n.profileNewPassword,
              floatingLabelBehavior: FloatingLabelBehavior.always,
              errorMaxLines: 4,
              validator: (value) {
                if (value == null ||
                    !isAcceptableNewPassword(value, current: _current.text)) {
                  return l10n.profilePasswordInvalid;
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            AppTextField(
              controller: _repeat,
              enabled: !busy,
              obscureText: !_showPasswords,
              autocorrect: false,
              enableSuggestions: false,
              autofillHints: const [AutofillHints.newPassword],
              label: l10n.profileRepeatPassword,
              floatingLabelBehavior: FloatingLabelBehavior.always,
              errorMaxLines: 4,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _submit(),
              validator: (value) =>
                  value != _next.text || value == null || value.isEmpty
                  ? l10n.profilePasswordInvalid
                  : null,
            ),
            const SizedBox(height: 8),
            AppCheckboxRow(
              label: l10n.loginShowPassword,
              value: _showPasswords,
              onChanged: busy
                  ? null
                  : (value) => setState(() => _showPasswords = value ?? false),
            ),
            if (error != null)
              AppDataNotice(
                message: localizeAppError(context, error),
                tone: AppStatusTone.danger,
              ),
            const SizedBox(height: 12),
            AppFormActionBar(
              primaryAction: AppPrimaryButton(
                label: l10n.profileChangePassword,
                busy: busy,
                onPressed: _submit,
              ),
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
