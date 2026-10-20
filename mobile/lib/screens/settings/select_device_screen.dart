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
import '../../router/app_router.dart';

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
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final preferred = context.watch<PreferredDeviceProvider>();
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.selectDeviceTitle),
        leading: IconButton(
          tooltip: MaterialLocalizations.of(context).backButtonTooltip,
          icon: const Icon(Icons.arrow_back),
          onPressed: _close,
        ),
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
          constraints: const BoxConstraints(maxWidth: 760),
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Column(
                  children: [
                    if (preferred.isSaving) const LinearProgressIndicator(),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: TextField(
                        decoration: InputDecoration(
                          labelText: l10n.selectDeviceSearch,
                          prefixIcon: const Icon(Icons.search),
                          border: const OutlineInputBorder(),
                        ),
                        onChanged: (value) => setState(() => _query = value),
                      ),
                    ),
                    if (preferred.hasDevice)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              preferred.deviceName ?? l10n.historyUnknownDevice,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            Text(l10n.profilePreferredDoor),
                            TextButton(
                              onPressed: preferred.isSaving
                                  ? null
                                  : () async {
                                      await preferred.clear();
                                    },
                              child: Text(l10n.selectDeviceClear),
                            ),
                          ],
                        ),
                      ),
                    if (preferred.wasInvalidated)
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text(l10n.selectDeviceInvalidated),
                      ),
                    if (preferred.error != null || !preferred.hasIdentity)
                      Semantics(
                        liveRegion: true,
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Text(
                            !preferred.hasIdentity ||
                                    preferred.error ==
                                        PreferenceError.unavailableIdentity
                                ? l10n.preferenceIdentityUnavailable
                                : l10n.preferenceSaveFailed,
                            style: TextStyle(color: colors.error),
                          ),
                        ),
                      ),
                  ],
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
    if (_loading) {
      return const SliverFillRemaining(
        hasScrollBody: false,
        child: Center(child: CircularProgressIndicator()),
      );
    }
    final error = _error;
    if (error != null) {
      return SliverFillRemaining(
        hasScrollBody: false,
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                localizeAppError(context, error),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              FilledButton(onPressed: _load, child: Text(l10n.commonRetry)),
            ],
          ),
        ),
      );
    }
    final filtered = _filtered;
    if (filtered.isEmpty) {
      return SliverFillRemaining(
        hasScrollBody: false,
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: Text(
              _devices.isEmpty
                  ? l10n.selectDeviceEmpty
                  : l10n.selectDeviceNoMatch,
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      sliver: SliverList(
        delegate: SliverChildBuilderDelegate((context, index) {
          final device = filtered[index];
          final selected =
              preferred.deviceId == device.id &&
              preferred.doorId == device.doorId &&
              (preferred.targetId == null ||
                  preferred.targetId == device.targetId);
          final colors = Theme.of(context).colorScheme;
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: Semantics(
              selected: selected,
              child: ListTile(
                selected: selected,
                selectedColor: colors.onSecondaryContainer,
                selectedTileColor: colors.secondaryContainer,
                leading: const Icon(Icons.door_front_door_outlined),
                title: Text(
                  device.doorName ?? device.name ?? l10n.historyUnknownDevice,
                ),
                subtitle: device.canOpen == false
                    ? Text(_unavailableLabel(l10n, device.reason))
                    : device.subtitle.isEmpty
                    ? null
                    : Text(device.subtitle),
                trailing: Icon(
                  selected ? Icons.check_circle : Icons.radio_button_unchecked,
                ),
                onTap:
                    !preferred.hasIdentity ||
                        preferred.isSaving ||
                        device.canOpen != true
                    ? null
                    : () async {
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
        }, childCount: filtered.length),
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
