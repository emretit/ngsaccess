import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/spacing.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/responsive_container.dart';

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
    return Scaffold(
      appBar: AppBar(title: Text(l10n.passwordHelpTitle)),
      body: SafeArea(
        child: ResponsiveContainer(
          maxWidth: AppSpacing.formMaxWidth,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.manage_accounts_outlined, size: 64),
                const SizedBox(height: 24),
                Text(
                  l10n.passwordHelpAdminTitle,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 16),
                Text(l10n.passwordHelpAdminBody),
                const SizedBox(height: 16),
                Text(l10n.passwordHelpNoEmail),
                const SizedBox(height: 24),
                SelectableText(request),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: _copying
                      ? null
                      : () => _copyRequest(
                          request,
                          l10n.passwordHelpCopied,
                          l10n.passwordHelpCopyFailed,
                        ),
                  icon: const Icon(Icons.copy_outlined),
                  label: Text(l10n.passwordHelpCopy),
                ),
                TextButton(
                  onPressed: () => context.pop(),
                  child: Text(l10n.forgotPasswordBackToLogin),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
