import 'package:flutter/material.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/providers/visitor_provider.dart';
import 'package:ngsplusapp/screens/visitor/visitor_screen.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:provider/provider.dart';

Widget app(
  VisitorProvider state, {
  Locale locale = const Locale('en'),
  double textScale = 1,
  ThemeMode themeMode = ThemeMode.light,
  bool nested = false,
}) => ChangeNotifierProvider.value(
  value: state,
  child: MaterialApp(
    locale: locale,
    theme: AppTheme.lightTheme,
    darkTheme: AppTheme.darkTheme,
    themeMode: themeMode,
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(
        context,
      ).copyWith(textScaler: TextScaler.linear(textScale)),
      child: child ?? const SizedBox.shrink(),
    ),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: nested
        ? Scaffold(
            bottomNavigationBar: const SizedBox(
              key: Key('visitor-outer-nav'),
              height: 80,
            ),
            body: Navigator(
              onGenerateRoute: (_) => MaterialPageRoute<void>(
                builder: (_) => const VisitorScreen(),
              ),
            ),
          )
        : const VisitorScreen(),
  ),
);
