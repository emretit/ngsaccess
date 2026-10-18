import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/shared/RowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  dateLabel,
  leaveStatuses,
  leaveTypes,
  type LeaveRow,
} from "./lib/leaveState";

export function LeaveList({
  rows,
  isAdmin,
  onDetails,
  onEdit,
}: {
  rows: LeaveRow[];
  isAdmin: boolean;
  onDetails: (row: LeaveRow) => void;
  onEdit: (row: LeaveRow) => void;
}) {
  const badge = (row: LeaveRow) => (
    <StatusBadge tone={leaveStatuses[row.status].tone}>
      {leaveStatuses[row.status].label}
    </StatusBadge>
  );
  const actions = (row: LeaveRow) => (
    <RowActions label={`${row.employeeName} izin işlemleri`}>
      <DropdownMenuItem onSelect={() => onDetails(row)}>
        Ayrıntılar
      </DropdownMenuItem>
      {isAdmin && row.status === "approved" && !row.employeeMissing && (
        <DropdownMenuItem onSelect={() => onEdit(row)}>
          Düzenle
        </DropdownMenuItem>
      )}
    </RowActions>
  );
  const person = (row: LeaveRow) => (
    <>
      <button
        type="button"
        className="text-left font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary break-words"
        onClick={() => onDetails(row)}
      >
        {row.employeeName}
      </button>
      <p className="text-xs text-muted-foreground break-words">
        {row.departmentName ?? "Departman belirtilmemiş"}
      </p>
    </>
  );
  const dates = (row: LeaveRow) =>
    `${dateLabel(row.startDate)} – ${dateLabel(row.endDate)}`;
  const duration = (row: LeaveRow) =>
    row.calendarDays === null ? "—" : `${row.calendarDays} takvim günü`;
  return (
    <>
      <div className="hidden min-w-0 overflow-x-auto rounded-md border md:block">
        <table className="w-full table-fixed text-xs">
          <caption className="sr-only">
            İzin kayıtları, başlangıç tarihi azalan
          </caption>
          <thead className="h-9 bg-subtle text-left text-muted-foreground">
            <tr>
              {[
                "Kişi",
                "İzin türü",
                "Tarih aralığı",
                "Süre",
                "Durum",
                "İşlemler",
              ].map((title, i) => (
                <th
                  key={title}
                  className={`px-3 font-medium ${["w-[24%]", "w-[17%]", "w-[23%]", "w-[13%]", "w-[13%]", "w-[10%]"][i]}`}
                >
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row._id}
                className="h-[42px] border-t hover:bg-subtle/50"
              >
                <td className="px-3 py-1">{person(row)}</td>
                <td className="px-3 py-1 break-words">
                  {leaveTypes[row.leaveType]}
                </td>
                <td className="px-3 py-1 tabular-nums">{dates(row)}</td>
                <td className="px-3 py-1 tabular-nums">{duration(row)}</td>
                <td className="px-3 py-1">{badge(row)}</td>
                <td className="px-3 py-0 text-right">{actions(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y rounded-md border md:hidden">
        {rows.map((row) => (
          <li key={row._id} className="min-w-0 p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {person(row)}
                <p className="mt-1">{leaveTypes[row.leaveType]}</p>
              </div>
              {actions(row)}
            </div>
            <p className="mt-2 tabular-nums text-xs">{dates(row)}</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs">{duration(row)}</span>
              {badge(row)}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
