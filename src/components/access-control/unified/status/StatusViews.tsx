import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatTrDateTime } from "@/lib/date";
import {
  grantBadge,
  pairKey,
  type GrantRow,
  type Pair,
  type EmployeeDetail,
} from "./model";

export function GrantBadge({ row }: { row: Parameters<typeof grantBadge>[0] }) {
  const badge = grantBadge(row);
  return (
    <span className="inline-flex flex-wrap gap-1" title={badge.hint}>
      <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
      {badge.stale && <Badge variant="outline">Güncel değil</Badge>}
      {badge.hint && (
        <span className="text-xs text-danger break-words">{badge.hint}</span>
      )}
    </span>
  );
}
export function EmptyStatus() {
  return (
    <p className="text-sm text-muted-foreground break-words">
      Bu özellik açılmadan önceki dağıtımlar 'Bilinmiyor' görünür; 'Tümünü
      yeniden dağıt' ile güncellenir.
    </p>
  );
}
export const columns = [
  "Kişi",
  "Departman",
  "Cihaz",
  "Kapı(lar)",
  "Kural",
  "Şablon",
  "Durum",
  "Son güncelleme",
];
export function GrantRows({
  rows,
  selected,
  onToggle,
  onEmployee,
  canManage,
}: {
  rows: GrantRow[];
  selected: Pair[];
  onToggle: (row: Pair) => void;
  onEmployee: (row: GrantRow) => void;
  canManage: boolean;
}) {
  const cells = (row: GrantRow) => [
    <Button
      variant="link"
      className="h-auto p-0 whitespace-normal text-left break-words"
      onClick={() => onEmployee(row)}
    >
      {row.employeeName}
    </Button>,
    row.departmentName ?? "—",
    row.deviceName,
    row.brand === "hikvision"
      ? `Tüm kapılar (cihaz)${row.doorNames.length ? ` · ${row.doorNames.join(", ")}` : ""}`
      : row.doorNames.join(", ") || "—",
    row.ruleNames.join(", ") || "—",
    row.templateNames.join(", ") || "—",
    <GrantBadge row={row} />,
    row.updatedAt ? formatTrDateTime(row.updatedAt) : "—",
  ];
  const checkbox = (row: GrantRow) => (
    <Checkbox
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
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={pairKey(row)} className="border-t">
                {canManage && <td className="p-2">{checkbox(row)}</td>}
                {cells(row).map((cell, i) => (
                  <td
                    key={columns[i]}
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
            className="border rounded-md p-3 min-w-0 space-y-2"
          >
            {canManage && (
              <div className="flex gap-2 items-center">
                {checkbox(row)}
                <span className="text-xs">Seç</span>
              </div>
            )}
            <dl className="space-y-2">
              {cells(row).map((cell, i) => (
                <div
                  key={columns[i]}
                  className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2"
                >
                  <dt className="text-muted-foreground text-xs">
                    {columns[i]}
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
          <GrantBadge row={row} />
          {row.removalRequired && <Badge variant="outline">Kaldırılacak</Badge>}
          <p>{row.doorNames.join(", ") || "Kapı bilgisi yok"}</p>
          <p className="text-xs">
            {row.ruleNames.join(", ") || "Kural yok"} ·{" "}
            {row.templateNames.join(", ") || "Şablon yok"}
          </p>
        </article>
      ))}
      {detail.rows.length === 0 && <p>Cihaz kaydı yok.</p>}
      <h3 className="font-medium">Yetkisiz kapılar</h3>
      {detail.unauthorizedDoors.length ? (
        <ul>
          {detail.unauthorizedDoors.map((door) => (
            <li key={door.doorId} className="break-words">
              {door.doorName} · Yetkisiz
            </li>
          ))}
        </ul>
      ) : (
        <p>Yetkisiz kapı yok.</p>
      )}
    </div>
  );
}
