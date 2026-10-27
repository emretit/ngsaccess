import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type LoadMoreFooterProps = {
  hasMore: boolean;
  loading: boolean;
  disabled?: boolean;
  onLoadMore: () => void;
  summary?: ReactNode;
  loadMoreLabel?: string;
  loadingLabel?: string;
  exhaustedLabel?: string;
};

export function LoadMoreFooter({
  hasMore, loading, disabled, onLoadMore, summary,
  loadMoreLabel = "Daha fazla yükle", loadingLabel = "Yükleniyor…", exhaustedLabel,
}: LoadMoreFooterProps) {
  return <>
    {summary}
    {hasMore ? (
      <Button type="button" variant="outline" disabled={disabled || loading} onClick={() => onLoadMore()}>
        {loading ? loadingLabel : loadMoreLabel}
      </Button>
    ) : exhaustedLabel ? (
      <p className="text-xs text-muted-foreground">{exhaustedLabel}</p>
    ) : null}
  </>;
}
