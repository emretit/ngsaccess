import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  deviceDateTime,
  eventVariant,
  eventCategoryLabel,
} from "./deviceAdapter";
import { deviceEventLabel } from "./deviceLabels";
import type { DeviceCenterView } from "./deviceCenterView";
export function DeviceEventsSection({
  overview,
}: Pick<DeviceCenterView, "overview">) {
  return (
    <section className="min-w-0 py-5 ">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Son olaylar</h4>
      </div>
      {overview.recentEvents.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Kayıt yok.
        </div>
      ) : (
        <div className="space-y-2">
          {overview.recentEvents.map((event) => (
            <div
              key={event._id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 p-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {deviceEventLabel(event.label)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {deviceDateTime(event.eventTime)}
                  {event.cardNo ? ` · Kart ${event.cardNo}` : ""}
                </div>
              </div>
              <Badge variant={eventVariant(event.category, event.severity)}>
                {eventCategoryLabel(event.category)}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
