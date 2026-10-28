import type { ReactNode } from "react";
import { TableStateRow } from "@/components/shared/TableStateRow";
import { ResponsiveResults } from "@/components/shared/ResponsiveResults";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RowActions } from "@/components/shared/RowActions";
import { adminDate } from "../components/AdminListParts";
import { onRowActivate, ROW_CLICK_CLASS } from "@/lib/tableRowClick";
import type { Project } from "./projectSchema";

export function ProjectsTable({
  projects,
  loading = false,
  emptyState,
  onEdit,
  onDelete,
}: {
  projects: Project[];
  loading?: boolean;
  emptyState?: ReactNode;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}) {
  const actions = (project: Project) => (
    <RowActions label={`${project.name} proje işlemleri`}>
      <DropdownMenuItem onSelect={() => onEdit(project)}>
        Düzenle
      </DropdownMenuItem>
      <DropdownMenuItem
        className="text-destructive"
        onSelect={() => onDelete(project)}
      >
        Projeyi sil
      </DropdownMenuItem>
    </RowActions>
  );
  const badge = (project: Project) => (
    <StatusBadge tone={project.isActive ? "success" : "neutral"}>
      {project.isActive ? "Aktif" : "Pasif"}
    </StatusBadge>
  );
  const members = (project: Project) =>
    `${project.memberCount}${project.memberCountCapped ? "+" : ""}`;
  return (
    <ResponsiveResults label="Projeler" desktop={
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[32%]">Ad</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Üyeler</TableHead>
              <TableHead className="w-[20%]">Oluşturulma</TableHead>
              <TableHead className="w-14">
                <span className="sr-only">İşlemler</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableStateRow colSpan={5} state="loading" label="Projeler yükleniyor" /> : projects.length === 0 && emptyState ? <TableStateRow colSpan={5} state="custom">{emptyState}</TableStateRow> : null}
            {projects.map((project) => (
              <TableRow
                key={project._id}
                className={ROW_CLICK_CLASS}
                onClick={onRowActivate(() => onEdit(project))}
              >
                <TableCell>
                  <button
                    className="text-left font-medium break-words"
                    onClick={() => onEdit(project)}
                  >
                    {project.name}
                  </button>
                </TableCell>
                <TableCell>{badge(project)}</TableCell>
                <TableCell className="tabular-nums">
                  {members(project)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {adminDate(project.createdAt)}
                </TableCell>
                <TableCell className="px-1">{actions(project)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      } mobile={
      loading || projects.length === 0 ? emptyState :
      <ul
        aria-label="Projeler"
        className="divide-y"
      >
        {projects.map((project) => (
          <li
            key={project._id}
            className={`flex min-w-0 gap-2 p-3 ${ROW_CLICK_CLASS}`}
            onClick={onRowActivate(() => onEdit(project))}
          >
            <div className="min-w-0 flex-1 space-y-2">
              <button
                className="break-words text-left text-sm font-medium"
                onClick={() => onEdit(project)}
              >
                {project.name}
              </button>
              <div>{badge(project)}</div>
              <p className="text-xs text-muted-foreground">
                {members(project)} üye
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {adminDate(project.createdAt)}
              </p>
            </div>
            {actions(project)}
          </li>
        ))}
      </ul>
      } />
  );
}
