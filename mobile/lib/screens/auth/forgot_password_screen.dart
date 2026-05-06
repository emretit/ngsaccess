import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/error_localizer.dart';
import '../../core/spacing.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/auth_provider.dart';
import '../../theme/app_theme.dart';
import '../../widgets/responsive_container.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _emailSent = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _resetPassword() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    
    final success = await authProvider.resetPassword(_emailController.text.trim());

    if (success && mounted) {
      setState(() {
        _emailSent = true;
      });
    } else if (mounted && (authProvider.lastError != null || authProvider.errorMessage != null)) {
      final message = authProvider.lastError != null
          ? localizeAppError(context, authProvider.lastError!)
          : authProvider.errorMessage!;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: isDark ? AppTheme.darkBackground : Colors.white,
      appBar: AppBar(
        title: Text(l10n.forgotPasswordTitle),
        backgroundColor: Colors.transparent,
      ),
      body: SafeArea(
        child: ResponsiveContainer(
          maxWidth: AppSpacing.formMaxWidth,
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: _emailSent ? _buildSuccessView() : _buildFormView(),
          ),
        ),
      ),
    );
  }

  Widget _buildFormView() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final l10n = AppLocalizations.of(context);

    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 32),
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: AppTheme.primaryBurgundy.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.lock_reset,
              size: 40,
              color: isDark ? AppTheme.primaryBurgundy2 : AppTheme.primaryBurgundy,
            ),
          ),
          const SizedBox(height: 24),
          Text(
            l10n.forgotPasswordHeadline,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            l10n.forgotPasswordPrompt,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: isDark ? Colors.grey[300] : Colors.grey[600],
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 48),
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(
              labelText: l10n.loginEmailLabel,
              prefixIcon: const Icon(Icons.email_outlined),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              filled: true,
              fillColor: isDark ? Colors.grey[800] : Colors.grey[50],
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return l10n.loginEmailRequired;
              }
              if (!value.contains('@')) {
                return l10n.loginEmailInvalid;
              }
              return null;
            },
          ),
          const SizedBox(height: 24),
          Consumer<AuthProvider>(
            builder: (context, authProvider, _) {
              return ElevatedButton(
                onPressed: authProvider.isLoading ? null : _resetPassword,
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 56),
                ),
                child: authProvider.isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : Text(l10n.forgotPasswordSendButton),
              );
            },
          ),
          const SizedBox(height: 24),
          TextButton(
            onPressed: () => context.pop(),
            child: Text(
              l10n.forgotPasswordBackToLogin,
              style: TextStyle(
                color: isDark ? AppTheme.primaryBurgundy2 : AppTheme.primaryBurgundy,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccessView() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final l10n = AppLocalizations.of(context);

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          width: 100,
          height: 100,
          decoration: BoxDecoration(
            color: Colors.green.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.check_circle_outline,
            size: 50,
            color: Colors.green,
          ),
        ),
        const SizedBox(height: 24),
        Text(
          l10n.forgotPasswordSuccessTitle,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : Colors.black87,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        Text(
          l10n.forgotPasswordSuccessBody(_emailController.text),
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
            color: isDark ? Colors.grey[300] : Colors.grey[600],
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 48),
        ElevatedButton(
          onPressed: () => context.pop(),
          style: ElevatedButton.styleFrom(
            minimumSize: const Size(double.infinity, 56),
          ),
          child: Text(l10n.forgotPasswordSuccessButton),
        ),
      ],
    );
  }
} 