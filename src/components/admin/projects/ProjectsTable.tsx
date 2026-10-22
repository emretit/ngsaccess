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
import type { Project } from "./projectSchema";

export function ProjectsTable({
  projects,
  onEdit,
  onDelete,
}: {
  projects: Project[];
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
    <>
      <div className="hidden min-w-0 overflow-x-auto rounded-md border min-[761px]:block">
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
            {projects.map((project) => (
              <TableRow key={project._id}>
                <TableCell>
                  <button
                    className="text-left font-medium underline-offset-4 hover:underline break-words"
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
      </div>
      <ul
        aria-label="Projeler"
        className="divide-y rounded-md border min-[761px]:hidden"
      >
        {projects.map((project) => (
          <li key={project._id} className="flex min-w-0 gap-2 p-3">
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
    </>
  );
}
