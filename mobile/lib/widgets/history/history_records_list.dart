import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';

/// Keeps retry, refresh and pagination reachable even for an empty server page.
class HistoryRecordsList extends StatelessWidget {
  const HistoryRecordsList({
    super.key,
    required this.controller,
    required this.recordCount,
    required this.itemBuilder,
    required this.hasMore,
    required this.isLoading,
    required this.isLoadingMore,
    required this.onRefresh,
    required this.onLoadMore,
    this.errorMessage,
    this.loadMoreErrorMessage,
    this.hasPreviousData = false,
    this.header,
    this.emptyHint,
    this.onClearFilters,
  });

  final ScrollController controller;
  final int recordCount;
  final IndexedWidgetBuilder itemBuilder;
  final bool hasMore;
  final bool isLoading;
  final bool isLoadingMore;
  final Future<void> Function() onRefresh;
  final VoidCallback onLoadMore;
  final String? errorMessage;
  final String? loadMoreErrorMessage;
  final bool hasPreviousData;
  final Widget? header;
  final String? emptyHint;
  final VoidCallback? onClearFilters;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final error = errorMessage;
    final pageError = loadMoreErrorMessage;
    final headerWidget = header;
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: CustomScrollView(
        key: const PageStorageKey('history-records-scroll'),
        controller: controller,
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          if (headerWidget != null) SliverToBoxAdapter(child: headerWidget),
          if (error != null)
            SliverToBoxAdapter(
              child: Semantics(
                liveRegion: true,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (hasPreviousData) Text(l10n.historyStaleData),
                      Text(error),
                      TextButton.icon(
                        onPressed: isLoading ? null : onRefresh,
                        icon: const Icon(Icons.refresh),
                        label: Text(l10n.commonRetry),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          if (isLoading)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: CircularProgressIndicator(
                    semanticsLabel: l10n.historyLoading,
                  ),
                ),
              ),
            ),
          if (!isLoading && error == null && recordCount == 0 && !hasMore)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  children: [
                    Icon(
                      Icons.event_note_rounded,
                      size: 32,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                    const SizedBox(height: 12),
                    Text(l10n.historyEmpty, textAlign: TextAlign.center),
                    const SizedBox(height: 8),
                    Text(
                      emptyHint ?? l10n.historyEmptyHint,
                      textAlign: TextAlign.center,
                    ),
                    if (onClearFilters != null) ...[
                      const SizedBox(height: 16),
                      OutlinedButton(
                        onPressed: onClearFilters,
                        child: Text(l10n.historyShowAllRecords),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                itemBuilder,
                childCount: recordCount,
              ),
            ),
          ),
          if (hasMore)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    if (pageError != null)
                      Semantics(liveRegion: true, child: Text(pageError)),
                    if (isLoadingMore)
                      Center(
                        child: CircularProgressIndicator(
                          semanticsLabel: l10n.historyLoading,
                        ),
                      )
                    else
                      OutlinedButton.icon(
                        key: const ValueKey('history-load-more'),
                        onPressed: isLoading ? null : onLoadMore,
                        icon: const Icon(Icons.expand_more),
                        label: Text(l10n.historyLoadMore),
                      ),
                  ],
                ),
              ),
            ),
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ),
    );
  }
}
