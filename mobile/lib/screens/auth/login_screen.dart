import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/error_localizer.dart';
import '../../core/errors.dart';
import '../../core/spacing.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/auth_provider.dart';
import '../../router/app_router.dart';
import '../../theme/app_theme.dart';
import '../../widgets/brand_mark.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _rememberMe = false;
  bool _submitting = false;
  bool _emailEdited = false;

  @override
  void initState() {
    super.initState();
    _loadRememberedUser();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _loadRememberedUser() async {
    final auth = context.read<AuthProvider>();
    final epoch = auth.sessionEpoch;
    try {
      final email = await auth.rememberedEmail();
      if (!mounted ||
          _emailEdited ||
          _submitting ||
          epoch != auth.sessionEpoch ||
          email == null) {
        return;
      }
      setState(() {
        _rememberMe = true;
        _emailController.text = email;
      });
    } catch (_) {
      // Remembered email is optional. Login itself reports persistence failures.
    }
  }

  Future<void> _signIn() async {
    if (_submitting || _formKey.currentState?.validate() != true) return;
    final auth = context.read<AuthProvider>();
    if (auth.isLoading) return;
    // Snapshot all widget values before provider notifications can remove it.
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    final rememberEmail = _rememberMe;
    setState(() => _submitting = true);
    final success = await auth.signIn(
      email,
      password,
      rememberEmail: rememberEmail,
    );
    if (!mounted) return;
    setState(() => _submitting = false);
    if (success) {
      _passwordController.clear();
      // The router restores the original protected destination after auth notify.
      return;
    }
    final error = auth.lastError;
    final fallback = auth.errorMessage;
    // EmploymentEndedError is already shown inline above the login card.
    if (error is EmploymentEndedError) return;
    if (error != null || fallback != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error != null ? localizeAppError(context, error) : fallback ?? '',
          ),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final l10n = AppLocalizations.of(context);
    final auth = context.watch<AuthProvider>();
    final busy = auth.isLoading || _submitting;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFF460E22),
        body: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isDark
                  ? const [
                      Color(0xFF6E1A35),
                      Color(0xFF460E22),
                      Color(0xFF270B16),
                    ]
                  : const [
                      AppTheme.primaryBurgundy2,
                      AppTheme.primaryBurgundy,
                      Color(0xFF460E22),
                    ],
              stops: const [0, 0.45, 1],
            ),
          ),
          child: SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final horizontalPadding = constraints.maxWidth < 360
                    ? 18.0
                    : 24.0;
                return SingleChildScrollView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: EdgeInsets.fromLTRB(
                    horizontalPadding,
                    24,
                    horizontalPadding,
                    24,
                  ),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: (constraints.maxHeight - 48).clamp(
                        0.0,
                        double.infinity,
                      ),
                    ),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(
                          maxWidth: AppSpacing.formMaxWidth,
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                const BrandMark(size: 44, onDark: true),
                                const SizedBox(width: 12),
                                Flexible(
                                  child: Text(
                                    l10n.appName,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 23,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: -0.4,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 26),
                            Semantics(
                              header: true,
                              child: Text(
                                l10n.loginWelcomeTitle,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 36,
                                  fontWeight: FontWeight.w700,
                                  height: 1.12,
                                  letterSpacing: -1,
                                ),
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              l10n.pdksSubtitle,
                              style: const TextStyle(
                                color: Color(0xFFEDD7DF),
                                fontSize: 15,
                                height: 1.4,
                              ),
                            ),
                            const SizedBox(height: 28),
                            if (auth.lastError is EmploymentEndedError) ...[
                              Semantics(
                                liveRegion: true,
                                child: Text(
                                  l10n.errorEmploymentEnded,
                                  style: const TextStyle(color: Colors.white),
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],
                            _buildLoginCard(context, busy: busy),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLoginCard(BuildContext context, {required bool busy}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final l10n = AppLocalizations.of(context);
    final ink = isDark ? const Color(0xFFF7EDF1) : const Color(0xFF241C21);
    final muted = isDark ? const Color(0xFFC9B8C0) : const Color(0xFF71626A);
    final accent = isDark ? const Color(0xFFF3A8BD) : AppTheme.primaryBurgundy;

    InputDecoration fieldDecoration(String label, IconData icon) {
      final border = OutlineInputBorder(
        borderRadius: BorderRadius.circular(15),
        borderSide: BorderSide(
          color: isDark ? const Color(0xFF51404A) : const Color(0xFFE5DDE1),
        ),
      );
      return InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: muted),
        floatingLabelStyle: TextStyle(color: accent),
        prefixIcon: Icon(icon, size: 21, color: muted),
        filled: true,
        fillColor: isDark ? const Color(0xFF30252C) : const Color(0xFFF8F5F6),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 18,
        ),
        border: border,
        enabledBorder: border,
        disabledBorder: border,
        focusedBorder: border.copyWith(
          borderSide: BorderSide(color: accent, width: 1.6),
        ),
        errorMaxLines: 3,
      );
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(22, 24, 22, 16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF211A20) : Colors.white,
        borderRadius: BorderRadius.circular(28),
        boxShadow: const [
          BoxShadow(
            color: Color(0x400F0308),
            blurRadius: 34,
            spreadRadius: -8,
            offset: Offset(0, 18),
          ),
        ],
      ),
      child: Material(
        type: MaterialType.transparency,
        child: AutofillGroup(
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  l10n.loginTitle,
                  style: TextStyle(
                    color: ink,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  l10n.loginPrompt,
                  style: TextStyle(color: muted, fontSize: 14, height: 1.45),
                ),
                const SizedBox(height: 22),
                TextFormField(
                  controller: _emailController,
                  enabled: !busy,
                  style: TextStyle(color: ink, fontSize: 16),
                  autofillHints: const [
                    AutofillHints.username,
                    AutofillHints.email,
                  ],
                  onChanged: (_) => _emailEdited = true,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  autocorrect: false,
                  enableSuggestions: false,
                  decoration: fieldDecoration(
                    l10n.loginEmailLabel,
                    Icons.mail_outline_rounded,
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
                const SizedBox(height: 14),
                TextFormField(
                  controller: _passwordController,
                  enabled: !busy,
                  style: TextStyle(color: ink, fontSize: 16),
                  autofillHints: const [AutofillHints.password],
                  autocorrect: false,
                  enableSuggestions: false,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _signIn(),
                  obscureText: _obscurePassword,
                  decoration:
                      fieldDecoration(
                        l10n.loginPasswordLabel,
                        Icons.lock_outline_rounded,
                      ).copyWith(
                        suffixIcon: IconButton(
                          constraints: const BoxConstraints(
                            minWidth: 48,
                            minHeight: 48,
                          ),
                          color: muted,
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            size: 21,
                          ),
                          tooltip: _obscurePassword
                              ? l10n.loginShowPassword
                              : l10n.loginHidePassword,
                          onPressed: busy
                              ? null
                              : () => setState(
                                  () => _obscurePassword = !_obscurePassword,
                                ),
                        ),
                      ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return l10n.loginPasswordRequired;
                    }
                    if (value.length < 6) {
                      return l10n.loginPasswordTooShort;
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 8),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  activeColor: accent,
                  checkColor: isDark ? const Color(0xFF460E22) : Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  value: _rememberMe,
                  onChanged: busy
                      ? null
                      : (value) {
                          setState(() {
                            _emailEdited = true;
                            _rememberMe = value ?? false;
                          });
                        },
                  title: Text(
                    l10n.loginRememberEmail,
                    style: TextStyle(color: muted, fontSize: 14),
                  ),
                ),
                const SizedBox(height: 12),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryBurgundy,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: isDark
                        ? const Color(0xFF5C2B3B)
                        : const Color(0xFFE8D5DC),
                    disabledForegroundColor: isDark
                        ? Colors.white70
                        : const Color(0xFF78606A),
                    minimumSize: const Size(48, 56),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 16,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  onPressed: busy ? null : _signIn,
                  child: busy
                      ? SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: isDark
                                ? Colors.white
                                : AppTheme.primaryBurgundy,
                          ),
                        )
                      : Text(
                          l10n.loginTitle,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
                const SizedBox(height: 4),
                TextButton(
                  style: TextButton.styleFrom(
                    foregroundColor: accent,
                    minimumSize: const Size(48, 48),
                  ),
                  onPressed: busy
                      ? null
                      : () {
                          context.read<AuthProvider>().clearError();
                          context.push(AppRoute.forgotPassword);
                        },
                  child: Text(
                    l10n.loginForgotPassword,
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
