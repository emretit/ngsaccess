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
    <div className="flex flex-wrap gap-2" aria-label="Görünüm">
      <Button
        variant={view === "person" ? "default" : "outline"}
        onClick={() => setView("person")}
      >
        Kişi
      </Button>
      <Button
        variant={view === "device" ? "default" : "outline"}
        onClick={() => setView("device")}
      >
        Cihaz
      </Button>
    </div>
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
      <GrantRows
        rows={rows}
        selected={selected}
        onToggle={toggle}
        onEmployee={setEmployee}
        isAdmin
      />
      {cursor && (
        <Button variant="outline" disabled={busy} onClick={() => void more()}>
          Daha fazla yükle
        </Button>
      )}
    </>
  );
  return (
    <>
      {view === "person" ? (
        <>
          {!busy && rows.length === 0 && (
            <p>Bu filtrelerde kayıt bulunamadı.</p>
          )}
          {rowView}
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-xs">
            Cihaz sayaçları kayıtlı çiftleri gösterir (departman filtresi
            uygulanır).
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
                      <p>Bu filtrelerde kayıt bulunamadı.</p>
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
