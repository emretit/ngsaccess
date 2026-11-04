import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/error_localizer.dart';
import '../../core/errors.dart';
import '../../l10n/app_localizations.dart';
import '../../models/device.dart';
import '../../providers/preferred_device_provider.dart';
import '../../providers/theme_provider.dart';
import '../../repositories/device_repository.dart';
import '../../router/route_paths.dart';
import '../../widgets/ui/ui.dart';

class SelectDeviceScreen extends StatefulWidget {
  const SelectDeviceScreen({super.key});

  @override
  State<SelectDeviceScreen> createState() => _SelectDeviceScreenState();
}

class _SelectDeviceScreenState extends State<SelectDeviceScreen> {
  bool _loading = true;
  AppError? _error;
  List<Device> _devices = const [];
  String _query = '';
  final _search = TextEditingController();
  int? _identityGeneration;
  int _request = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final generation = context
        .watch<PreferredDeviceProvider>()
        .identityGeneration;
    if (_identityGeneration != generation) {
      _identityGeneration = generation;
      _devices = const [];
      _load();
    }
  }

  Future<void> _load() async {
    final preferred = context.read<PreferredDeviceProvider>();
    final generation = preferred.identityGeneration;
    final request = ++_request;
    setState(() {
      _loading = true;
      _error = null;
    });
    bool owns() =>
        mounted &&
        request == _request &&
        generation == preferred.identityGeneration;
    try {
      final list = await context.read<DeviceRepository>().listForEmployee();
      if (!owns()) return;
      await preferred.revalidate(list);
      if (!owns()) return;
      setState(() {
        _devices = list;
        _loading = false;
      });
    } catch (error) {
      if (!owns()) return;
      setState(() {
        _error = AppError.fromException(error);
        _loading = false;
      });
    }
  }

  // Normalize Turkish dotted/dotless I without modifying real display labels.
  String _searchable(String value) => value
      .replaceAll('İ', 'i')
      .replaceAll('I', 'ı')
      .toLowerCase()
      .replaceAll('ı', 'i');

  List<Device> get _filtered {
    final query = _searchable(_query.trim());
    if (query.isEmpty) return _devices;
    return _devices
        .where(
          (device) =>
              [
                device.name,
                device.deviceSerial,
                device.zoneName,
                device.doorName,
              ].whereType<String>().any(
                (value) => _searchable(value).contains(query),
              ),
        )
        .toList();
  }

  void _close() {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      context.go(AppRoute.profile);
    }
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final preferred = context.watch<PreferredDeviceProvider>();
    return AppScaffold(
      header: AppPageHeader(
        title: l10n.selectDeviceTitle,
        showBack: true,
        onBack: _close,
        actions: [
          IconButton(
            tooltip: l10n.qrRefresh,
            icon: const Icon(Icons.refresh),
            onPressed: _loading || preferred.isSaving ? null : _load,
          ),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      AppTextField(
                        controller: _search,
                        label: l10n.selectDeviceSearch,
                        onChanged: (value) => setState(() => _query = value),
                      ),
                      if (preferred.isSaving ||
                          (_loading && _devices.isNotEmpty))
                        LinearProgressIndicator(
                          semanticsLabel: l10n.commonLoading,
                        ),
                      if (preferred.hasDevice) ...[
                        const SizedBox(height: 16),
                        AppSecondaryButton(
                          label: l10n.selectDeviceClear,
                          expanded: true,
                          onPressed: preferred.isSaving
                              ? null
                              : () async {
                                  await preferred.clear();
                                },
                        ),
                      ],
                      if (preferred.wasInvalidated)
                        AppDataNotice(message: l10n.selectDeviceInvalidated),
                      if (preferred.error != null || !preferred.hasIdentity)
                        AppDataNotice(
                          tone: AppStatusTone.danger,
                          message:
                              !preferred.hasIdentity ||
                                  preferred.error ==
                                      PreferenceError.unavailableIdentity
                              ? l10n.preferenceIdentityUnavailable
                              : l10n.preferenceSaveFailed,
                        ),
                    ],
                  ),
                ),
              ),
              _buildBody(l10n, preferred),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody(AppLocalizations l10n, PreferredDeviceProvider preferred) {
    if (_loading && _devices.isEmpty) {
      return SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        sliver: SliverToBoxAdapter(
          child: AppSkeleton(semanticLabel: l10n.commonLoading),
        ),
      );
    }
    final error = _error;
    if (error != null) {
      return SliverPadding(
        padding: const EdgeInsets.all(20),
        sliver: SliverToBoxAdapter(
          child: AppDataNotice(
            message: localizeAppError(context, error),
            tone: AppStatusTone.danger,
            actionLabel: l10n.commonRetry,
            onAction: _load,
          ),
        ),
      );
    }
    final filtered = _filtered;
    if (filtered.isEmpty) {
      return SliverToBoxAdapter(
        child: AppEmptyState(
          title: _devices.isEmpty
              ? l10n.selectDeviceEmpty
              : l10n.selectDeviceNoMatch,
          message: _devices.isEmpty
              ? l10n.selectDeviceUnavailable
              : l10n.selectDeviceSearch,
          icon: Icons.door_front_door_outlined,
          actionLabel: _devices.isEmpty ? null : l10n.historyFilterClear,
          onAction: _devices.isEmpty
              ? null
              : () => setState(() {
                  _query = '';
                  _search.clear();
                }),
        ),
      );
    }
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      sliver: DecoratedSliver(
        position: DecorationPosition.foreground,
        decoration: BoxDecoration(
          border: Border.all(
            color: Theme.of(context).colorScheme.outlineVariant,
          ),
          borderRadius: BorderRadius.circular(
            AppUiTokens.of(context).groupRadius,
          ),
        ),
        sliver: SliverList.separated(
          itemCount: filtered.length,
          separatorBuilder: (_, _) =>
              const Divider(height: 1, thickness: 1, indent: 16, endIndent: 16),
          itemBuilder: (context, index) {
            final device = filtered[index];
            final selected =
                preferred.deviceId == device.id &&
                preferred.doorId == device.doorId &&
                (preferred.targetId == null ||
                    preferred.targetId == device.targetId);
            final radius = Radius.circular(AppUiTokens.of(context).groupRadius);
            return ClipRRect(
              borderRadius: BorderRadius.vertical(
                top: index == 0 ? radius : Radius.zero,
                bottom: index == filtered.length - 1 ? radius : Radius.zero,
              ),
              child: ColoredBox(
                color: Theme.of(context).colorScheme.surface,
                child: AppListRow(
                  title:
                      device.doorName ??
                      device.name ??
                      l10n.historyUnknownDevice,
                  subtitle: device.subtitle.isEmpty ? null : device.subtitle,
                  leadingIcon: Icons.door_front_door_outlined,
                  selected: selected,
                  trailing: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        selected
                            ? Icons.check_circle_outline
                            : Icons.radio_button_unchecked,
                        color: selected
                            ? AppUiTokens.of(context).accent
                            : Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                      if (device.canOpen == false)
                        Text(
                          _unavailableLabel(l10n, device.reason),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                    ],
                  ),
                  enabled:
                      preferred.hasIdentity &&
                      !preferred.isSaving &&
                      device.canOpen == true,
                  onTap: () async {
                    final saved = await preferred.setDevice(
                      id: device.id,
                      name: device.doorName ?? device.name,
                      doorId: device.doorId,
                      targetId: device.targetId,
                    );
                    if (!mounted || !saved) return;
                    _close();
                  },
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  String _unavailableLabel(AppLocalizations l10n, String? code) =>
      switch (code) {
        'DEVICE_INACTIVE' || 'DOOR_INACTIVE' => l10n.selectDeviceInactive,
        'ACCESS_EPOCH_DENIED' => l10n.accessDenied,
        'SCHEDULE_DENIED' => l10n.selectDeviceOutsideSchedule,
        'TARGET_UNSUPPORTED' ||
        'TRANSPORT_UNSUPPORTED' => l10n.selectDeviceUnsupported,
        _ => l10n.selectDeviceUnavailable,
      };
}
