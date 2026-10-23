import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Choice } from "./pdksRulesChoice";
import { checkpointKey, pointTypeLabels, type PdksRuleValues, type Targets } from "./pdksRulesModel";

export function PdksRulesCheckpointFields({
  values,
  targets,
  change,
  toggleTarget,
}: {
  values: PdksRuleValues;
  targets: Targets;
  change: (patch: Partial<PdksRuleValues>) => void;
  toggleTarget: (
    target: PdksRuleValues["targets"][number],
    checked: boolean,
  ) => void;
}) {
  const typeField = (target: PdksRuleValues["targets"][number], name: string) => {
    const selected = values.targets.find(item => checkpointKey(item) === checkpointKey(target));
    if (!selected) return null;
    return <Choice id={`pdks-type-${checkpointKey(target)}`} label={`${name} nokta tipi`}
      value={selected.pointType ?? "both"} options={Object.entries(pointTypeLabels)}
      onChange={pointType => {
        if (pointType === "both" || pointType === "entry" || pointType === "exit")
          change({ targets: values.targets.map(item => checkpointKey(item) === checkpointKey(target) ? { ...item, pointType } : item) });
      }} />;
  };
  return (
    <>
      <Choice
        id="pdks-checkpoints"
        label="PDKS'e sayılan noktalar"
        value={values.checkpointMode}
        options={[
          ["all", "Tüm kapı ve cihazlar"],
          ["selected", "Seçilenler"],
        ]}
        onChange={(mode) => {
          if (mode === "all" || mode === "selected")
            change({ checkpointMode: mode });
        }}
      />
      {values.checkpointMode === "selected" && (
        <div className="space-y-3">
          <p className="text-sm" aria-live="polite">
            Seçili nokta: {values.targets.length} / 500
          </p>
          <p className="text-xs text-muted-foreground">
            Mobil ve QR okutmalar Seçilenler modunda PDKS'e sayılmaz.
          </p>
          <p className="text-xs text-muted-foreground">Birden fazla hedef eşleşirse okuyucu, sonra kapı, sonra cihaz tipi uygulanır.</p>
          <div className="max-h-80 space-y-4 overflow-y-auto rounded-md border p-3">
            {targets.devices.map((device) => (
              <div key={device.deviceId} className="space-y-2">
                <h4 className="text-sm font-medium">{device.name}</h4>
                <Label className="flex items-center gap-2">
                  <Checkbox
                    checked={values.targets.some(
                      (target) =>
                        target.targetType === "device" &&
                        target.deviceId === device.deviceId,
                    )}
                    onCheckedChange={(checked) =>
                      toggleTarget(
                        { targetType: "device", deviceId: device.deviceId },
                        checked === true,
                      )
                    }
                  />
                  Bu cihazın tüm geçişleri
                </Label>
                {typeField({ targetType: "device", deviceId: device.deviceId }, device.name)}
                {targets.doors
                  .filter((door) => door.deviceId === device.deviceId)
                  .map((door) => (
                    <div key={door.doorId} className="pl-5">
                      <Label className="flex items-center gap-2">
                        <Checkbox
                          disabled={!door.selectable}
                          checked={values.targets.some(
                            (target) =>
                              target.targetType === "door" &&
                              target.doorId === door.doorId,
                          )}
                          aria-describedby={
                            door.reason
                              ? `pdks-reason-${door.doorId}`
                              : undefined
                          }
                          onCheckedChange={(checked) => {
                            if (door.selectable)
                              toggleTarget(
                                {
                                  targetType: "door",
                                  deviceId: device.deviceId,
                                  doorId: door.doorId,
                                },
                                checked === true,
                              );
                          }}
                        />
                        {door.name}
                      </Label>
                      {typeField({ targetType: "door", deviceId: device.deviceId, doorId: door.doorId }, door.name)}
                      {(targets.readers ?? []).filter(reader => reader.doorId === door.doorId && reader.deviceId === device.deviceId).map(reader => {
                        const target = { targetType: "reader" as const, deviceId: device.deviceId, doorId: door.doorId, readerId: reader.readerId };
                        return <div key={reader.readerId} className="mt-2 space-y-2 pl-5">
                          <Label className="flex items-center gap-2">
                            <Checkbox disabled={!reader.selectable}
                              checked={values.targets.some(item => checkpointKey(item) === checkpointKey(target))}
                              aria-describedby={reader.reason ? `pdks-reason-${reader.readerId}` : undefined}
                              onCheckedChange={checked => { if (reader.selectable) toggleTarget(target, checked === true); }} />
                            {reader.name} · {pointTypeLabels[reader.direction]}{reader.hikReaderNo !== undefined ? ` · Okuyucu ${reader.hikReaderNo}` : ""}
                          </Label>
                          {typeField(target, reader.name)}
                          {reader.reason && <p id={`pdks-reason-${reader.readerId}`} className="text-xs text-muted-foreground">{reader.reason}</p>}
                        </div>;
                      })}
                      {door.reason && (
                        <p
                          id={`pdks-reason-${door.doorId}`}
                          className="mt-1 text-xs text-muted-foreground"
                        >
                          {door.reason}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            ))}
            {targets.doors
              .filter((door) => !door.deviceId)
              .map((door) => (
                <div key={door.doorId}>
                  <Label className="flex items-center gap-2">
                    <Checkbox disabled />
                    {door.name}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {door.reason ?? "Kapıya bağlı cihaz yok."}
                  </p>
                </div>
              ))}
            {targets.devices.length === 0 && targets.doors.length === 0 && (
              <p className="text-sm">Seçilebilecek kapı veya cihaz yok.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
