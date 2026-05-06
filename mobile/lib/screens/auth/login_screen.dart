import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/error_localizer.dart';
import '../../core/spacing.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/auth_provider.dart';
import '../../router/app_router.dart';
import '../../theme/app_theme.dart';
import '../../widgets/responsive_container.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _rememberMe = false;
  
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
    final prefs = await SharedPreferences.getInstance();
    final rememberMe = prefs.getBool('remember_me') ?? false;
    if (rememberMe) {
      setState(() {
        _rememberMe = true;
        _emailController.text = prefs.getString('remembered_email') ?? '';
        _passwordController.text = prefs.getString('remembered_password') ?? '';
      });
    }
  }

  Future<void> _signIn() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    bool success = await authProvider.signIn(
      _emailController.text.trim(),
      _passwordController.text,
    );

    // Beni Hatırla seçiliyse kaydet
    final prefs = await SharedPreferences.getInstance();
    if (success && _rememberMe) {
      await prefs.setBool('remember_me', true);
      await prefs.setString('remembered_email', _emailController.text.trim());
      await prefs.setString('remembered_password', _passwordController.text);
    } else {
      await prefs.remove('remember_me');
      await prefs.remove('remembered_email');
      await prefs.remove('remembered_password');
    }

    if (success && mounted) {
      // Provider notifyListeners → router redirect → /home; manuel push gerekmez.
      context.go(AppRoute.home);
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
      backgroundColor: isDark ? AppTheme.darkBackground : const Color(0xFFF9F9FB),
      body: SafeArea(
        child: ResponsiveContainer(
          maxWidth: AppSpacing.formMaxWidth,
          child: SingleChildScrollView(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SizedBox(height: 32),
                SvgPicture.asset(
                  'assets/images/ngs_logo.svg',
                  width: 96,
                  height: 96,
                ),
                const SizedBox(height: 24),
                Text(
                  l10n.pdksSubtitle,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                ),
                const SizedBox(height: 40),
                Card(
                  elevation: 8,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                  ),
                  margin: const EdgeInsets.symmetric(horizontal: 24),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 32),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            l10n.loginTitle,
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black87,
                                ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            l10n.loginPrompt,
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: Colors.grey[600],
                                ),
                          ),
                          const SizedBox(height: 24),
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            decoration: InputDecoration(
                              labelText: l10n.loginEmailLabel,
                              prefixIcon: const Icon(Icons.email_outlined),
                              border: const OutlineInputBorder(),
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
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            decoration: InputDecoration(
                              labelText: l10n.loginPasswordLabel,
                              prefixIcon: const Icon(Icons.lock_outlined),
                              border: const OutlineInputBorder(),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword ? Icons.visibility_off : Icons.visibility,
                                ),
                                onPressed: () {
                                  setState(() {
                                    _obscurePassword = !_obscurePassword;
                                  });
                                },
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
                          const SizedBox(height: 24),
                          Row(
                            children: [
                              Checkbox(
                                value: _rememberMe,
                                onChanged: (value) {
                                  setState(() {
                                    _rememberMe = value ?? false;
                                  });
                                },
                              ),
                              Text(l10n.loginRememberMe),
                            ],
                          ),
                          SizedBox(
                            height: 48,
                            child: ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.primaryBurgundy,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                              onPressed: _signIn,
                              child: Text(
                                l10n.loginTitle,
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              GestureDetector(
                                onTap: () => context.push(AppRoute.forgotPassword),
                                child: Text(
                                  l10n.loginForgotPassword,
                                  style: TextStyle(
                                    color: AppTheme.primaryBurgundy,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ),
    );
  }
} 