import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/branch_visibility.dart';
import '../providers/visitor_provider.dart';
import '../widgets/app_bottom_navigation.dart';

/// Branch navigators remain mounted; selection only changes resource visibility.
class MainNavigationShell extends StatefulWidget {
  const MainNavigationShell({super.key, required this.navigationShell});
  final StatefulNavigationShell navigationShell;

  @override
  State<MainNavigationShell> createState() => _MainNavigationShellState();
}

class _MainNavigationShellState extends State<MainNavigationShell>
    with WidgetsBindingObserver {
  VisitorProvider? _visitors;
  bool _resumed = true;
  bool _routeVisible = true;
  int _visibilityRevision = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _resumed =
        (WidgetsBinding.instance.lifecycleState ?? AppLifecycleState.resumed) ==
        AppLifecycleState.resumed;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _routeVisible = ModalRoute.isCurrentOf(context) ?? true;
    final next = context.read<VisitorProvider?>();
    if (!identical(next, _visitors)) {
      _visitors?.setVisible(false);
      _visitors?.setForeground(false);
      _visitors = next;
    }
    _scheduleVisibility();
  }

  @override
  void didUpdateWidget(MainNavigationShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    _scheduleVisibility();
  }

  void _scheduleVisibility() {
    final revision = ++_visibilityRevision;
    // setVisible may start a refresh and notify; never do that inside build.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || revision != _visibilityRevision) {
        return;
      }
      _syncVisibility();
    });
  }

  void _syncVisibility() {
    _visitors?.setForeground(_resumed);
    _visitors?.setVisible(
      _resumed && _routeVisible && widget.navigationShell.currentIndex == 3,
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _resumed = state == AppLifecycleState.resumed;
    _syncVisibility();
  }

  void _goBranch(int index) {
    // Stop a hidden branch synchronously, before the next frame.
    if (index != 3) {
      _visitors?.setVisible(false);
    }
    widget.navigationShell.goBranch(
      index,
      initialLocation: index == widget.navigationShell.currentIndex,
    );
  }

  @override
  void dispose() {
    _visibilityRevision++;
    _visitors?.setVisible(false);
    _visitors?.setForeground(false);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      body: SafeArea(
        top: false,
        child: BranchVisibility(
          activeIndex: _routeVisible ? widget.navigationShell.currentIndex : -1,
          child: widget.navigationShell,
        ),
      ),
      bottomNavigationBar: MediaQuery.viewInsetsOf(context).bottom == 0
          ? AppBottomNavigation(
              selectedIndex: widget.navigationShell.currentIndex,
              onDestinationSelected: _goBranch,
            )
          : null,
    );
  }
}
