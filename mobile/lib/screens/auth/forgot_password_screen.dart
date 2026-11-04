import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/spacing.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/ui/ui.dart';

/// Mobile passwords are set using an administrator-issued setup link.
/// This screen prepares a request to share; it never claims to send an email.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  bool _copying = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<AuthProvider>().clearError();
    });
  }

  Future<void> _copyRequest(
    String request,
    String copiedMessage,
    String failedMessage,
  ) async {
    if (_copying) return;
    setState(() => _copying = true);
    var success = false;
    try {
      await Clipboard.setData(ClipboardData(text: request));
      success = true;
    } catch (_) {
      // Clipboard can be unavailable on managed devices.
    }
    if (!mounted) return;
    setState(() => _copying = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(success ? copiedMessage : failedMessage)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final request = l10n.passwordHelpRequest;
    return AppScaffold(
      header: AppPageHeader(title: l10n.passwordHelpTitle, showBack: true),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              maxWidth: AppSpacing.formMaxWidth,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AppListGroup(
                  children: [
                    AppListRow(
                      title: l10n.passwordHelpAdminTitle,
                      subtitle: l10n.passwordHelpAdminBody,
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                AppDataNotice(message: l10n.passwordHelpNoEmail),
                const SizedBox(height: 24),
                AppSurface(child: SelectableText(request)),
                const SizedBox(height: 24),
                AppPrimaryButton(
                  label: l10n.passwordHelpCopy,
                  icon: Icons.copy_outlined,
                  busy: _copying,
                  onPressed: () => _copyRequest(
                    request,
                    l10n.passwordHelpCopied,
                    l10n.passwordHelpCopyFailed,
                  ),
                ),
                const SizedBox(height: 12),
                AppSecondaryButton(
                  expanded: true,
                  label: l10n.startupUseLogin,
                  onPressed: () => context.pop(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
