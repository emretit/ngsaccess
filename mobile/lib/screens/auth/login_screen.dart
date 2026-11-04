import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/error_localizer.dart';
import '../../core/spacing.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/auth_provider.dart';
import '../../router/app_router.dart';
import '../../widgets/ui/ui.dart';
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
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();
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
    _emailFocus.dispose();
    _passwordFocus.dispose();
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
    if (_submitting) return;
    if (_formKey.currentState?.validate() != true) {
      final email = _emailController.text;
      if (email.isEmpty || !email.contains('@')) {
        _emailFocus.requestFocus();
      } else {
        _passwordFocus.requestFocus();
      }
      return;
    }
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
    // Provider errors remain visible with the form so retry preserves input.
  }

  @override
  Widget build(BuildContext context) {
    final t = AppUiTokens.of(context);
    final l10n = AppLocalizations.of(context);
    final auth = context.watch<AuthProvider>();
    final busy = auth.isLoading || _submitting;
    final error = auth.lastError;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: t.bandBackground,
        body: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                t.bandBackground,
                t.bandBackground,
                t.bandAvatarBackground,
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
                                const BrandMark.band(size: 44),
                                const SizedBox(width: 12),
                                Flexible(
                                  child: Text(
                                    l10n.appName,
                                    style: TextStyle(
                                      color: t.onBand,
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
                                style: TextStyle(
                                  color: t.onBand,
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
                              style: TextStyle(
                                color: t.onBandMuted,
                                fontSize: 15,
                                height: 1.4,
                              ),
                            ),
                            const SizedBox(height: 28),
                            if (error != null || auth.errorMessage != null) ...[
                              AppDataNotice(
                                tone: AppStatusTone.danger,
                                message: error != null
                                    ? localizeAppError(context, error)
                                    : auth.errorMessage ?? '',
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
    final theme = Theme.of(context);
    final c = theme.colorScheme;
    final t = AppUiTokens.of(context);
    final l10n = AppLocalizations.of(context);
    final ink = c.onSurface;
    final muted = c.onSurfaceVariant;
    final accent = t.accent;

    InputDecoration fieldDecoration(String label, IconData icon) {
      final border = OutlineInputBorder(
        borderRadius: BorderRadius.circular(15),
        borderSide: BorderSide(color: c.outlineVariant),
      );
      return InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: muted),
        floatingLabelStyle: TextStyle(color: accent),
        prefixIcon: Icon(icon, size: 21, color: muted),
        filled: true,
        fillColor: busy ? t.disabledBackground : t.subtle,
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
        errorMaxLines: 4,
      );
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(22, 24, 22, 16),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: c.shadow.withValues(alpha: 0.25),
            blurRadius: 34,
            spreadRadius: -8,
            offset: const Offset(0, 18),
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
                  key: const ValueKey('login-email'),
                  focusNode: _emailFocus,
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
                  key: const ValueKey('login-password'),
                  focusNode: _passwordFocus,
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
                  minTileHeight: 56,
                  activeColor: accent,
                  checkColor: c.surface,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  title: Text(
                    l10n.loginRememberEmail,
                    style: TextStyle(color: muted, fontSize: 14),
                  ),
                  value: _rememberMe,
                  onChanged: busy
                      ? null
                      : (value) => setState(() {
                          _emailEdited = true;
                          _rememberMe = value ?? false;
                        }),
                ),
                const SizedBox(height: 12),
                Theme(
                  data: theme.copyWith(
                    filledButtonTheme: FilledButtonThemeData(
                      style: theme.filledButtonTheme.style?.copyWith(
                        minimumSize: const WidgetStatePropertyAll(Size(48, 56)),
                        padding: const WidgetStatePropertyAll(
                          EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                        ),
                        shape: WidgetStatePropertyAll(
                          RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                      ),
                    ),
                  ),
                  child: AppPrimaryButton(
                    key: const ValueKey('login-submit'),
                    label: l10n.loginTitle,
                    busyLabel: l10n.loginSigningIn,
                    busy: busy,
                    onPressed: _signIn,
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
