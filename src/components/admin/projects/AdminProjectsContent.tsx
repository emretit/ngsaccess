import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAdminPrimaryAction } from "../hooks/useAdminPrimaryAction";
import { Button } from "@/components/ui/button";
import { StatInline } from "@/components/shared/StatInline";
import { FilterBar } from "@/components/shared/FilterBar";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import {
  AdminEmptyState as EmptyState,
  AdminSelect,
  AdminPagination,
  useAdminPagination,
} from "../components/AdminListParts";
import { AdminDataBoundary } from "../components/AdminDataBoundary";
import { ProjectEditor } from "./ProjectEditor";
import { ProjectDeletion } from "./ProjectDeletion";
import { ProjectsTable } from "./ProjectsTable";
import type { Project } from "./projectSchema";
export function AdminProjectsContent() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | undefined>();
  const debouncedSearch = useDebouncedValue(search, 300);
  const paging = useAdminPagination(
    JSON.stringify({ search: debouncedSearch, status }),
  );
  const result = useQuery(api.projects.adminList, {
    search: debouncedSearch,
    status,
    paginationOpts: { numItems: paging.size, cursor: paging.cursor },
  });
  const [editing, setEditing] = useState<{ project: Project | null } | null>(
    null,
  );
  const primaryInHeader = useAdminPrimaryAction("Yeni proje", () =>
    setEditing({ project: null }),
  );
  const [deleting, setDeleting] = useState<Project | null>(null);
  const clear = () => {
    setSearch("");
    setStatus(undefined);
  };
  const filtered = Boolean(search || status);
  const listState = !result ? (
        <SectionSkeleton label="Projeler yükleniyor" />
      ) : result.page.length === 0 && !result.isDone ? (
        <p role="status" className="text-sm text-muted-foreground">
          Bu sayfada eşleşme yok. Tarama devam ediyor; sonraki sayfaya geçin.
        </p>
      ) : result.page.length === 0 && paging.page > 1 ? (
        <p role="status" className="text-sm text-muted-foreground">
          Bu sayfada kayıt yok. Önceki sayfaya dönebilir veya filtreleri
          değiştirebilirsiniz.
        </p>
      ) : result.page.length === 0 ? (
        <EmptyState
          title={filtered ? "Filtrelere uygun kayıt yok" : "Henüz proje yok"}
          description={
            filtered
              ? "Aramayı veya filtreleri değiştirin."
              : "Kullanıcı ve cihaz atamak için önce bir proje oluşturun."
          }
          action={{
            label: filtered ? "Filtreleri temizle" : "Yeni proje",
            onClick: filtered ? clear : () => setEditing({ project: null }),
          }}
        />
      ) : null;
  return (
    <div className="min-w-0 space-y-5">
      <h2 id="admin-projects-heading" tabIndex={-1} className="sr-only">
        Projeler
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatInline
          loading={!result}
          items={[
            { label: "Bu sayfada", value: result?.page.length },
            {
              label: "Aktif (bu sayfa)",
              value: result?.page.filter((project) => project.isActive).length,
            },
            {
              label: "Pasif (bu sayfa)",
              value: result?.page.filter((project) => !project.isActive).length,
            },
          ]}
        />
        {!primaryInHeader && (
          <Button onClick={() => setEditing({ project: null })}>
            Yeni proje
          </Button>
        )}
      </div>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Ad veya açıklama ara"
        searchLabel="Proje ara"
        hasFilters={filtered}
        onClear={clear}
      >
        <AdminSelect
          label="Durum"
          value={status ?? "all"}
          onChange={(value) =>
            setStatus(
              value === "active" || value === "inactive" ? value : undefined,
            )
          }
        >
          <option value="all">Tümü</option>
          <option value="active">Aktif</option>
          <option value="inactive">Pasif</option>
        </AdminSelect>
      </FilterBar>
        <ProjectsTable
          loading={!result}
          emptyState={listState}
          projects={result?.page ?? []}
          onEdit={(project) => setEditing({ project })}
          onDelete={setDeleting}
        />
      <AdminPagination
        page={paging.page}
        count={result?.page.length ?? 0}
        done={result?.isDone ?? false}
        loading={!result}
        onPrevious={paging.previous}
        onNext={() => {
          if (result && !result.isDone) paging.next(result.continueCursor);
        }}
        size={paging.size}
        sizes={[10, 25]}
        onSizeChange={paging.setSize}
      />
      {editing && (
        <ProjectEditor
          project={editing.project}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <AdminDataBoundary label="Silme etkileri">
          <ProjectDeletion
            project={deleting}
            onClose={() => setDeleting(null)}
            onEdit={() => {
              setEditing({ project: deleting });
              setDeleting(null);
            }}
          />
        </AdminDataBoundary>
      )}
    </div>
  );
}
