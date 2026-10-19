import { EmptyState } from "@/components/shared/EmptyState";
import { PaginationBar } from "@/components/shared/PaginationBar";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function AdminSelect({
  label,
  value,
  onChange,
  children,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-w-0 max-w-full items-center gap-2 text-xs text-muted-foreground">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-9 min-w-0 max-w-[210px] rounded-md border border-input bg-background px-2 text-foreground focus-visible:outline-primary"
      >
        {children}
      </select>
    </label>
  );
}

export function useAdminPagination(filterKey: string) {
  const [size, setSize] = useState(10);
  const key = `${filterKey}:${size}`;
  const [state, setState] = useState<{
    key: string;
    cursors: (string | null)[];
  }>({ key, cursors: [null] });
  if (state.key !== key) setState({ key, cursors: [null] });
  const cursors = state.key === key ? state.cursors : [null];
  const cursor = cursors[cursors.length - 1] ?? null;
  return {
    size,
    setSize,
    cursor,
    page: cursors.length,
    key: `${key}:${cursor ?? "first"}`,
    next: (next: string) => setState({ key, cursors: [...cursors, next] }),
    previous: () => setState({ key, cursors: cursors.slice(0, -1) }),
  };
}

/** Retain the current page during minute refresh; never retain a different filter/cursor. */
export function useStableAdminPage<T>(
  value: T | undefined,
  key: string,
): T | undefined {
  const [previous, setPrevious] = useState({ key, value });
  if (previous.key !== key || (value !== undefined && previous.value !== value))
    setPrevious({ key, value });
  return value !== undefined || previous.key !== key ? value : previous.value;
}

export function AdminPagination({
  page,
  count,
  done,
  loading,
  onPrevious,
  onNext,
  size,
  sizes,
  onSizeChange,
}: {
  page: number;
  count: number;
  done: boolean;
  loading: boolean;
  onPrevious: () => void;
  onNext: () => void;
  size?: number;
  sizes?: readonly number[];
  onSizeChange?: (size: number) => void;
}) {
  return (
    <PaginationBar
      summary={
        <>
          Sayfa {page} · {loading ? "Yükleniyor" : `Bu sayfada ${count} kayıt`}
          {!done && !loading && count === 0
            ? " · Tarama sürüyor; sonraki sayfaya geçin."
            : ""}
        </>
      }
      page={page}
      onPrevious={onPrevious}
      onNext={onNext}
      previousDisabled={loading || page <= 1}
      nextDisabled={loading || done}
      pageSize={size}
      pageSizes={sizes}
      onPageSizeChange={onSizeChange}
      pageSizeLabel="Sayfa boyutu"
    />
  );
}

export function adminDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Date(value).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Empty-state recovery stays secondary to the single page creation action. */
export function AdminEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: { label: string; onClick: () => void };
}) {
  return (
    <div>
      <EmptyState title={title} description={description} compact />
      <div className="pb-6 text-center">
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      </div>
    </div>
  );
}

export function focusAdminHeading(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}
