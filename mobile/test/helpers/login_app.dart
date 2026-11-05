import 'package:flutter/material.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/screens/auth/login_screen.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:provider/provider.dart';

Widget wrapLogin(
  AuthProvider auth, {
  Locale locale = const Locale('tr'),
  Brightness brightness = Brightness.light,
  double textScale = 1,
}) => MaterialApp(
  debugShowCheckedModeBanner: false,
  theme: brightness == Brightness.dark
      ? AppTheme.darkTheme
      : AppTheme.lightTheme,
  builder: (context, child) => MediaQuery(
    data: MediaQuery.of(
      context,
    ).copyWith(textScaler: TextScaler.linear(textScale)),
    child: child ?? const SizedBox.shrink(),
  ),
  locale: locale,
  supportedLocales: AppLocalizations.supportedLocales,
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  home: ChangeNotifierProvider<AuthProvider>.value(
    value: auth,
    child: const LoginScreen(),
  ),
);
