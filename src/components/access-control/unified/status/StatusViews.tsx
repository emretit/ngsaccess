import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { pastAttemptText } from "@/lib/pastAttempt";
import { formatTrDateTime } from "@/lib/date";
import { onRowActivate, ROW_CLICK_CLASS } from "@/lib/tableRowClick";
import {
  grantBadge,
  pairKey,
  type GrantRow,
  type Pair,
  type EmployeeDetail,
} from "./model";

export function GrantBadge({ row }: { row: Parameters<typeof grantBadge>[0] & { updatedAt?: number } }) {
  const badge = grantBadge(row);
  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex flex-wrap gap-1">
        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
        {row.doorUnresolved ? (
          <StatusBadge tone="warning" title="Kuralın kapı seçimini düzeltin; yeniden göndermek bunu çözmez.">Kapı seçimi düzeltilmeli</StatusBadge>
        ) : badge.stale ? (
          <StatusBadge tone="warning" title="Kural cihaza gönderildikten sonra değişti; yeniden dağıtın.">Yeniden gönderilmeli</StatusBadge>
        ) : null}
      </span>
      {badge.hint && <span className="text-xs text-danger break-words">{pastAttemptText(row.updatedAt, badge.hint)}</span>}
    </span>
  );
}
export function EmptyStatus({ unknownCount }: { unknownCount: number }) {
  if (unknownCount === 0) return null;
  return (
    <p className="text-sm text-muted-foreground break-words">
      {unknownCount} kişi–cihaz kaydının cihaza gönderildiğine dair kayıt yok.
      Görmek için Bilinmiyor sayacına tıklayın; seçip yeniden gönderebilirsiniz.
    </p>
  );
}
export const columns = ["Kişi", "Cihaz/kapı", "Durum"];
export function GrantRows({
  rows,
  selected,
  onToggle,
  onEmployee,
  canManage,
  hideDevice = false,
}: {
  rows: GrantRow[];
  selected: Pair[];
  onToggle: (row: Pair) => void;
  onEmployee: (row: GrantRow, trigger?: HTMLElement) => void;
  canManage: boolean;
  hideDevice?: boolean;
}) {
  const cells = (row: GrantRow) => [
    <Button
      data-employee-trigger
      variant="link"
      className="min-h-11 h-auto p-0 whitespace-normal text-left break-words hover:no-underline"
      onClick={(event) => onEmployee(row, event.currentTarget)}
    >
      {row.employeeName}
    </Button>,
    <span className="space-y-1 block">
      {!hideDevice && <span className="block">{row.deviceName}</span>}
      <span className="block text-xs text-muted-foreground">{row.brand === "hikvision"
        ? `Tüm kapılar (cihaz)${row.doorNames.length ? ` · ${row.doorNames.join(", ")}` : ""}`
        : row.doorNames.join(", ") || "—"}</span>
    </span>,
    <GrantBadge row={row} />,
  ];
  const checkbox = (row: GrantRow, mobile = false) => (
    <Checkbox
      id={`${mobile ? "mobile" : "desktop"}-${pairKey(row)}`}
      aria-label={`${row.employeeName} · ${row.deviceName} seç`}
      checked={selected.some((p) => pairKey(p) === pairKey(row))}
      onCheckedChange={() => onToggle(row)}
    />
  );
  return (
    <>
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {canManage && <th className="p-2">Seç</th>}
              {columns.map((c) => (
                <th key={c} className="p-2 text-left">
                  {hideDevice && c === "Cihaz/kapı" ? "Kapı" : c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={pairKey(row)}
                className={`border-t ${ROW_CLICK_CLASS}`}
                onClick={onRowActivate((event) => onEmployee(row, event.currentTarget.querySelector<HTMLButtonElement>("[data-employee-trigger]") ?? undefined))}
              >
                {canManage && (
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    {checkbox(row)}
                  </td>
                )}
                {cells(row).map((cell, i) => (
                  <td
                    key={hideDevice && i === 1 ? "Kapı" : columns[i]}
                    className="p-2 align-top break-words max-w-48"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="lg:hidden space-y-3">
        {rows.map((row) => (
          <article
            key={pairKey(row)}
            className={`border rounded-md p-3 min-w-0 space-y-2 ${ROW_CLICK_CLASS}`}
            onClick={onRowActivate((event) => onEmployee(row, event.currentTarget.querySelector<HTMLButtonElement>("[data-employee-trigger]") ?? undefined))}
          >
            {canManage && (
              <label
                htmlFor={`mobile-${pairKey(row)}`}
                className="inline-flex min-h-11 min-w-11 gap-2 items-center cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                {checkbox(row, true)}
                <span className="text-xs">Seç</span>
              </label>
            )}
            <dl className="space-y-2">
              {cells(row).map((cell, i) => (
                <div
                  key={hideDevice && i === 1 ? "Kapı" : columns[i]}
                  className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2"
                >
                  <dt className="text-muted-foreground text-xs">
                    {hideDevice && i === 1 ? "Kapı" : columns[i]}
                  </dt>
                  <dd className="min-w-0 break-words text-sm">{cell}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}
export function DeviceCounters({
  effective,
  pending,
  failed,
}: {
  effective: number | string;
  pending: number | string;
  failed: number | string;
}) {
  return (
    <span className="flex flex-wrap gap-2 text-sm">
      <span>Etkin: {effective}</span>
      <span>Bekliyor: {pending}</span>
      <span>Hata: {failed}</span>
    </span>
  );
}
export function EmployeeStatus({ detail }: { detail: EmployeeDetail }) {
  return (
    <div className="space-y-4">
      {detail.rows.map((row) => (
        <article
          key={pairKey(row)}
          className="border rounded-md p-3 space-y-2 break-words"
        >
          <h3>{row.deviceName}</h3>
          <p className="text-xs text-muted-foreground">Departman: {row.departmentName ?? "—"}</p>
          <GrantBadge row={row} />
          <p className="text-xs text-muted-foreground">Son güncelleme: {row.updatedAt ? formatTrDateTime(row.updatedAt) : "—"}</p>
          {row.state === "failed" && row.lastError && (
            <details>
              <summary className="cursor-pointer min-h-11 py-3 text-sm">Hata ayrıntısı</summary>
              <p className="text-xs break-words">{pastAttemptText(row.updatedAt, row.lastError)}</p>
            </details>
          )}
          {row.removalRequired && <p className="text-sm font-medium text-warning">Kaldırılacak</p>}
          <p>{row.doorNames.join(", ") || "Kapı bilgisi yok"}</p>
          <p className="text-xs">
            {row.ruleNames.join(", ") || "Kural yok"} ·{" "}
            {row.ruleNames.length ? "Kuralın kendi saati" : "Kural yok"}
          </p>
        </article>
      ))}
      {detail.rows.length === 0 && <p>Cihaz kaydı yok.</p>}
      {detail.unauthorizedDoors.length ? (
        <details>
          <summary className="font-medium cursor-pointer min-h-11 py-3">Kural dışında kalan {detail.unauthorizedDoors.length} kapı</summary>
          <ul>
            {detail.unauthorizedDoors.map((door) => (
              <li key={door.doorId} className="break-words">{door.doorName}</li>
            ))}
          </ul>
        </details>
      ) : <p>Kural dışında kalan kapı yok.</p>}
    </div>
  );
}
