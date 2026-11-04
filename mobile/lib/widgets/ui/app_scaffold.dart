import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app_ui_tokens.dart';

class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    required this.body,
    this.header,
    this.bottomBar,
    this.consumeTopInset = false,
    this.consumeBottomInset = true,
    this.brandedSystemBar = false,
    this.resizeToAvoidBottomInset = true,
  });
  final Widget body;
  final Widget? header;
  final Widget? bottomBar;
  final bool consumeTopInset;
  final bool consumeBottomInset;
  final bool brandedSystemBar;
  final bool resizeToAvoidBottomInset;
  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: brandedSystemBar || Theme.of(context).brightness == Brightness.dark
          ? SystemUiOverlayStyle.light
          : SystemUiOverlayStyle.dark,
      child: Scaffold(
        resizeToAvoidBottomInset: resizeToAvoidBottomInset,
        body: Column(
          children: [
            if (brandedSystemBar)
              SizedBox(
                height: top,
                width: double.infinity,
                child: ColoredBox(
                  color: AppUiTokens.of(context).bandBackground,
                ),
              ),
            Expanded(
              child: MediaQuery.removePadding(
                context: context,
                removeTop: brandedSystemBar,
                child: SafeArea(
                  top: consumeTopInset && !brandedSystemBar,
                  bottom: consumeBottomInset && bottomBar == null,
                  child: Column(
                    children: [
                      ?header,
                      Expanded(child: body),
                      ?bottomBar,
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
