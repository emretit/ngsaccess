import { SegmentedViewControl } from "@/components/shared/SegmentedViewControl";
import { LoadMoreFooter } from "@/components/shared/LoadMoreFooter";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  countText,
  type Counts,
  type Filters,
  type GrantRow,
  type Pair,
} from "./model";
import { DeviceCounters, GrantRows } from "./StatusViews";
import type { Options } from "./useStatusData";

export function StatusViewToggle({
  view,
  setView,
}: {
  view: "person" | "device";
  setView: (view: "person" | "device") => void;
}) {
  return (
    <SegmentedViewControl
      label="Görünüm"
      value={view}
      options={[{ value: "person", label: "Kişi" }, { value: "device", label: "Cihaz" }]}
      onChange={setView}
    />
  );
}

export function StatusResults({
  view,
  rows,
  selected,
  toggle,
  setEmployee,
  cursor,
  busy,
  more,
  options,
  filters,
  expanded,
  setExpanded,
  deviceCounts,
}: {
  view: "person" | "device";
  rows: GrantRow[];
  selected: Pair[];
  toggle: (pair: Pair) => void;
  setEmployee: (employee: GrantRow) => void;
  cursor: string | null;
  busy: boolean;
  more: () => Promise<void>;
  options: Options;
  filters: Filters;
  expanded: Id<"devices"> | undefined;
  setExpanded: (deviceId: Id<"devices"> | undefined) => void;
  deviceCounts: Record<string, Counts>;
}) {
  const rowView = (
    <>
      <p className="text-sm text-muted-foreground">
        Filtre sonucu: {rows.length} kayıt{cursor ? " (yüklenenler; daha fazla kayıt olabilir)" : ""}
      </p>
      <GrantRows
        rows={rows}
        selected={selected}
        onToggle={toggle}
        onEmployee={setEmployee}
        canManage
      />
      <LoadMoreFooter
        hasMore={Boolean(cursor)}
        loading={busy}
        loadingLabel="Daha fazla yükle"
        onLoadMore={() => void more()}
      />
    </>
  );
  return (
    <>
      {view === "person" ? (
        <>
          {!busy && rows.length === 0 && (
            <EmptyState
              compact
              title={cursor ? "Yüklenen kayıtlarda bu filtrelerde eşleşme bulunamadı." : "Bu filtrelerde kayıt bulunamadı."}
            />
          )}
          {rowView}
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-xs">
            Cihaz özetleri kişi–cihaz kayıtlarını gösterir; departman seçimi bu özeti daraltır.
          </p>
          {options.devices
            .filter((d) => !filters.deviceId || d._id === filters.deviceId)
            .map((device) => (
              <article
                key={device._id}
                className="border rounded-md p-3 min-w-0 space-y-3"
              >
                <Button
                  variant="ghost"
                  className="whitespace-normal h-auto text-left break-words max-w-full"
                  aria-expanded={expanded === device._id}
                  onClick={() =>
                    setExpanded(
                      expanded === device._id ? undefined : device._id,
                    )
                  }
                >
                  {device.name}
                </Button>
                {deviceCounts[device._id] ? (
                  <DeviceCounters
                    effective={countText(
                      deviceCounts[device._id].effective,
                      deviceCounts[device._id].capped,
                    )}
                    pending={countText(
                      deviceCounts[device._id].pending,
                      deviceCounts[device._id].capped,
                    )}
                    failed={countText(
                      deviceCounts[device._id].failed,
                      deviceCounts[device._id].capped,
                    )}
                  />
                ) : (
                  <p>Sayaçlar yükleniyor…</p>
                )}
                {expanded === device._id && (
                  <>
                    {!busy && !rows.length && (
                      <EmptyState
                        compact
                        title={cursor ? "Yüklenen kayıtlarda bu filtrelerde eşleşme bulunamadı." : "Bu filtrelerde kayıt bulunamadı."}
                      />
                    )}
                    {rowView}
                  </>
                )}
              </article>
            ))}
        </div>
      )}
    </>
  );
}
