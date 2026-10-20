import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/error_localizer.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/visitor_provider.dart';
import '../../models/visitor.dart';
import '../../widgets/visitor/visitor_detail.dart';
import '../../widgets/visitor/visitor_labels.dart';
import 'visitor_form_screen.dart';

class VisitorScreen extends StatefulWidget {
  const VisitorScreen({super.key});
  @override
  State<VisitorScreen> createState() => _VisitorScreenState();
}

class _VisitorScreenState extends State<VisitorScreen> {
  Timer? _searchDebounce;
  @override
  void dispose() {
    _searchDebounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.visitorTitle),
        actions: [
          IconButton(
            tooltip: l10n.visitorRefresh,
            icon: const Icon(Icons.refresh),
            onPressed: () => context.read<VisitorProvider>().refresh(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        tooltip: l10n.visitorAddButton,
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const VisitorFormScreen()),
        ),
        child: const Icon(Icons.person_add_outlined),
      ),
      body: Consumer<VisitorProvider>(
        builder: (context, state, _) {
          return RefreshIndicator(
            onRefresh: state.refresh,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                TextField(
                  key: ValueKey(('visitor-search', state.sessionEpoch)),
                  maxLength: 80,
                  decoration: InputDecoration(
                    labelText: l10n.visitorSearch,
                    prefixIcon: const Icon(Icons.search),
                  ),
                  onChanged: (value) {
                    _searchDebounce?.cancel();
                    final epoch = state.sessionEpoch;
                    _searchDebounce = Timer(
                      const Duration(milliseconds: 300),
                      () {
                        if (mounted && state.sessionEpoch == epoch) {
                          state.setFilters(search: value);
                        }
                      },
                    );
                  },
                ),
                DropdownButtonFormField<VisitorAccessStatus>(
                  key: ValueKey((
                    'visitor-status',
                    state.sessionEpoch,
                    state.status,
                  )),
                  initialValue: state.status,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: l10n.visitorFilterTitle,
                  ),
                  items: [
                    DropdownMenuItem<VisitorAccessStatus>(
                      value: null,
                      child: Text(l10n.visitorAllStatuses),
                    ),
                    for (final status in VisitorAccessStatus.values)
                      DropdownMenuItem(
                        value: status,
                        child: Text(visitorStatusLabel(l10n, status)),
                      ),
                  ],
                  onChanged: (value) => state.setFilters(
                    status: value,
                    resetStatus: value == null,
                  ),
                ),
                const SizedBox(height: 12),
                if (state.summary case final summary?) ...[
                  Text(
                    l10n.visitorSummaryTitle,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  Text(
                    '${l10n.visitorStatTotal}: ${summary.total}${summary.overflow ? '+' : ''}',
                  ),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      for (final status in VisitorAccessStatus.values)
                        Chip(
                          label: Text(
                            '${visitorStatusLabel(l10n, status)}: ${summary.counts[status] ?? 0}${summary.overflow ? '+' : ''}',
                          ),
                        ),
                    ],
                  ),
                  if (summary.overflow) Text(l10n.visitorSummaryLimited),
                ],
                if (state.summaryError != null) Text(l10n.visitorSummaryError),
                if (state.loading) const LinearProgressIndicator(),
                if (state.error case final error?) ...[
                  if (state.loaded) Text(l10n.visitorStale),
                  Text(
                    localizeAppError(context, error),
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                  TextButton(
                    onPressed: state.loading ? null : state.refresh,
                    child: Text(l10n.commonRetry),
                  ),
                ],
                if (state.loaded &&
                    state.visitors.isEmpty &&
                    !state.hasMore &&
                    state.error == null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 64),
                    child: Column(
                      children: [
                        const Icon(Icons.people_outline, size: 56),
                        const SizedBox(height: 16),
                        Text(
                          state.search.trim().isNotEmpty || state.status != null
                              ? l10n.historyEmpty
                              : l10n.visitorEmpty,
                        ),
                        if (state.search.trim().isEmpty &&
                            state.status == null) ...[
                          const SizedBox(height: 8),
                          Text(l10n.visitorEmptyHint),
                        ],
                      ],
                    ),
                  ),
                for (final visitor in state.visitors)
                  Card(
                    child: ListTile(
                      title: Text(visitor.fullName),
                      subtitle: Text(
                        '${visitorStatusLabel(l10n, visitor.status)}\n${visitorDate(context, visitor.visitStart)} – ${visitorDate(context, visitor.visitEnd)}',
                      ),
                      isThreeLine: true,
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () async {
                        state.openDetail(visitor.id);
                        await showModalBottomSheet<void>(
                          context: context,
                          isScrollControlled: true,
                          useSafeArea: true,
                          builder: (_) => VisitorDetail(visitorId: visitor.id),
                        );
                        state.closeDetail();
                      },
                    ),
                  ),
                if (state.hasMore)
                  TextButton(
                    onPressed: state.loading
                        ? null
                        : () => state.refresh(more: true),
                    child: Text(l10n.visitorLoadMore),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
