import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/error_localizer.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/visitor_provider.dart';
import '../../models/visitor.dart';
import '../../widgets/visitor/visitor_cards.dart';
import '../../widgets/visitor/visitor_detail.dart';
import '../../widgets/visitor/visitor_labels.dart';
import 'visitor_form_screen.dart';

class VisitorScreen extends StatefulWidget {
  const VisitorScreen({super.key});
  @override
  State<VisitorScreen> createState() => _VisitorScreenState();
}

typedef _StatusFilter = ({VisitorAccessStatus? status});

class _VisitorScreenState extends State<VisitorScreen> {
  Timer? _searchDebounce;
  int _searchRevision = 0;

  @override
  void dispose() {
    _searchDebounce?.cancel();
    super.dispose();
  }

  void _addVisitor() {
    final state = context.read<VisitorProvider>();
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ChangeNotifierProvider<VisitorProvider>.value(
          value: state,
          child: const VisitorFormScreen(),
        ),
      ),
    );
  }

  void _clearFilters(VisitorProvider state) {
    _searchDebounce?.cancel();
    setState(() => _searchRevision++);
    state.setFilters(search: '', resetStatus: true);
  }

  Future<void> _filter(VisitorProvider state) async {
    final epoch = state.sessionEpoch;
    final selected = await showModalBottomSheet<_StatusFilter>(
      context: context,
      useRootNavigator: true,
      showDragHandle: true,
      isScrollControlled: true,
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * .85,
      ),
      builder: (context) {
        final l10n = AppLocalizations.of(context);
        return SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        l10n.visitorFilterTitle,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    IconButton(
                      tooltip: l10n.commonClose,
                      icon: const Icon(Icons.close_rounded),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                for (final status in <VisitorAccessStatus?>[
                  null,
                  ...VisitorAccessStatus.values,
                ])
                  Semantics(
                    selected: state.status == status,
                    child: ListTile(
                      title: Text(
                        status == null
                            ? l10n.visitorAllStatuses
                            : visitorStatusLabel(l10n, status),
                      ),
                      selected: state.status == status,
                      trailing: state.status == status
                          ? const Icon(Icons.check_rounded)
                          : null,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      onTap: () => Navigator.of(
                        context,
                      ).pop<_StatusFilter>((status: status)),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
    if (!mounted || selected == null || state.sessionEpoch != epoch) return;
    state.setFilters(
      status: selected.status,
      resetStatus: selected.status == null,
    );
  }

  Future<void> _openDetail(VisitorProvider state, Visitor visitor) async {
    unawaited(state.openDetail(visitor.id));
    await showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => ChangeNotifierProvider<VisitorProvider>.value(
        value: state,
        child: VisitorDetail(visitorId: visitor.id),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = Theme.of(context).colorScheme;
    final largeText = MediaQuery.textScalerOf(context).scale(14) > 19;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          l10n.visitorTitle,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        centerTitle: false,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16, left: 8),
            child: largeText
                ? IconButton.filled(
                    key: const Key('visitor-add'),
                    tooltip: l10n.visitorAddButton,
                    icon: const Icon(Icons.add_rounded),
                    onPressed: _addVisitor,
                  )
                : Tooltip(
                    message: l10n.visitorAddButton,
                    child: FilledButton.icon(
                      key: const Key('visitor-add'),
                      onPressed: _addVisitor,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(48, 44),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                      ),
                      icon: const Icon(Icons.add_rounded, size: 18),
                      label: Text(l10n.commonAdd),
                    ),
                  ),
          ),
        ],
      ),
      body: Consumer<VisitorProvider>(
        builder: (context, state, _) {
          final filtered =
              state.search.trim().isNotEmpty || state.status != null;
          final status = state.status;
          final summary = state.summary;
          return RefreshIndicator(
            onRefresh: state.refresh,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        key: ValueKey((
                          'visitor-search',
                          state.sessionEpoch,
                          _searchRevision,
                        )),
                        maxLength: 80,
                        decoration: InputDecoration(
                          labelText: l10n.visitorSearch,
                          floatingLabelBehavior: FloatingLabelBehavior.never,
                          prefixIcon: const Icon(Icons.search_rounded),
                          counterText: '',
                          filled: true,
                          fillColor: colors.surface,
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 14,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: colors.outlineVariant.withValues(
                                alpha: .6,
                              ),
                            ),
                          ),
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
                    ),
                    const SizedBox(width: 8),
                    Badge(
                      isLabelVisible: status != null,
                      smallSize: 7,
                      child: IconButton.outlined(
                        tooltip: l10n.visitorFilterTitle,
                        icon: const Icon(Icons.tune_rounded),
                        onPressed: () => _filter(state),
                      ),
                    ),
                  ],
                ),
                if (filtered) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      if (status != null)
                        Text(
                          visitorStatusLabel(l10n, status),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      TextButton(
                        onPressed: () => _clearFilters(state),
                        child: Text(l10n.visitorClearFilters),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 20),
                if (summary != null &&
                    (summary.total > 0 || summary.overflow)) ...[
                  VisitorSummaryCard(summary: summary),
                  const SizedBox(height: 24),
                ],
                if (state.summaryError != null)
                  Semantics(
                    liveRegion: true,
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        l10n.visitorSummaryError,
                        style: TextStyle(color: colors.error),
                      ),
                    ),
                  ),
                if (state.loading)
                  LinearProgressIndicator(semanticsLabel: l10n.homeDataLoading),
                if (state.error case final error?) ...[
                  if (state.loaded) Text(l10n.visitorStale),
                  Semantics(
                    liveRegion: true,
                    child: Text(
                      localizeAppError(context, error),
                      style: TextStyle(color: colors.error),
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
                    padding: const EdgeInsets.symmetric(vertical: 48),
                    child: Column(
                      children: [
                        Icon(
                          Icons.people_outline_rounded,
                          size: 48,
                          color: colors.onSurfaceVariant,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          filtered ? l10n.historyEmpty : l10n.visitorEmpty,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          filtered
                              ? l10n.visitorFilteredEmptyHint
                              : l10n.visitorEmptyHint,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: colors.onSurfaceVariant),
                        ),
                        if (filtered) ...[
                          const SizedBox(height: 16),
                          OutlinedButton(
                            onPressed: () => _clearFilters(state),
                            child: Text(l10n.historyShowAllRecords),
                          ),
                        ],
                      ],
                    ),
                  ),
                if (state.visitors.isNotEmpty) ...[
                  Semantics(
                    header: true,
                    child: Text(
                      l10n.visitorInvitationsTitle,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
                for (final visitor in state.visitors)
                  VisitorRecordCard(
                    visitor: visitor,
                    onTap: () => _openDetail(state, visitor),
                  ),
                if (state.hasMore)
                  OutlinedButton(
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
