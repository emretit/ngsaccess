import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../l10n/app_localizations.dart';
import '../../models/device.dart';
import '../../providers/preferred_device_provider.dart';
import '../../repositories/device_repository.dart';
import '../../theme/app_theme.dart';

class SelectDeviceScreen extends StatefulWidget {
  const SelectDeviceScreen({super.key});

  @override
  State<SelectDeviceScreen> createState() => _SelectDeviceScreenState();
}

class _SelectDeviceScreenState extends State<SelectDeviceScreen> {
  bool _loading = true;
  String? _error;
  List<Device> _devices = const [];
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = context.read<DeviceRepository>();
      final list = await repo.listForEmployee();
      if (!mounted) return;
      setState(() {
        _devices = list;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  List<Device> get _filtered {
    if (_query.isEmpty) return _devices;
    final q = _query.toLowerCase();
    return _devices.where((d) {
      return d.name.toLowerCase().contains(q) ||
          (d.deviceSerial?.toLowerCase().contains(q) ?? false) ||
          (d.zoneName?.toLowerCase().contains(q) ?? false) ||
          (d.doorName?.toLowerCase().contains(q) ?? false);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final preferred = context.watch<PreferredDeviceProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppTheme.darkBackground : Colors.grey[50],
      appBar: AppBar(
        title: Text(l10n.selectDeviceTitle),
        backgroundColor: Colors.transparent,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: InputDecoration(
                hintText: l10n.selectDeviceSearch,
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
              onChanged: (value) => setState(() => _query = value),
            ),
          ),
          Expanded(child: _buildBody(l10n, preferred)),
        ],
      ),
    );
  }

  Widget _buildBody(AppLocalizations l10n, PreferredDeviceProvider preferred) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(onPressed: _load, child: Text(l10n.commonRetry)),
            ],
          ),
        ),
      );
    }
    final filtered = _filtered;
    if (filtered.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            _devices.isEmpty ? l10n.selectDeviceEmpty : l10n.selectDeviceNoMatch,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey[600],
                ),
          ),
        ),
      );
    }
    return ListView.separated(
      itemCount: filtered.length,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final device = filtered[i];
        final isSelected = preferred.deviceId == device.id;
        return Card(
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(
              color: isSelected ? AppTheme.primaryBurgundy : Colors.transparent,
              width: isSelected ? 2 : 0,
            ),
          ),
          child: ListTile(
            leading: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppTheme.primaryBurgundy.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.door_front_door_outlined,
                color: AppTheme.primaryBurgundy,
              ),
            ),
            title: Text(
              device.name,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            subtitle: device.subtitle.isEmpty ? null : Text(device.subtitle),
            trailing: isSelected
                ? const Icon(Icons.check_circle, color: AppTheme.primaryBurgundy)
                : const Icon(Icons.radio_button_unchecked),
            onTap: () async {
              await context.read<PreferredDeviceProvider>().setDevice(
                    id: device.id,
                    name: device.name,
                  );
              if (!context.mounted) return;
              Navigator.of(context).pop();
            },
          ),
        );
      },
    );
  }
}
