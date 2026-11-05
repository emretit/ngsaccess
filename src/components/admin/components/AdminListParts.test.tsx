import { expectLabel } from "@/test-utils/filterLabel";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName, type FunctionReference } from "convex/server";
import { expect, it, vi } from "vitest";
import { AdminSelect } from "./AdminListParts";
import { AdminUsersContent } from "../AdminUsersPanel";
import { AdminDevicesPanel } from "../AdminDevicesPanel";
import { AdminProjectsContent } from "../projects/AdminProjectsContent";

vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ profile: { role: "super_admin" } }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, role: "super_admin", loading: false }) }));
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">) => ["projects:list", "invites:listExpired"].includes(getFunctionName(ref)) ? [] : { page: [], isDone: true },
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useProjectChangeGuard: () => {} }));
vi.mock("../hooks/useAdminPrimaryAction", () => ({ useAdminPrimaryAction: () => false }));
vi.mock("../hooks/useUserManagement", () => ({ useUserManagement: () => ({ projects: [], resetForm: vi.fn() }) }));

it("gives AdminSelect an upper FIELD label and full-width select", () => {
  const html = renderToStaticMarkup(<AdminSelect label="Durum" value="all" onChange={() => {}}><option value="all">Tüm durumlar</option></AdminSelect>);
  expectLabel(html, "Durum");
  expect(html).toMatch(/<select[^>]*class="[^"]*w-full[^"]*min-w-0/);
  expect(html).not.toContain("max-w-[210px]");
});

it.each([
  ["users", AdminUsersContent, ["Rol", "Proje"], ["Tüm roller", "Tüm projeler", "Ataması yok"]],
  ["projects", AdminProjectsContent, ["Durum"], ["Tüm durumlar"]],
  ["devices", AdminDevicesPanel, ["Proje", "Bağlantı"], ["Tüm projeler", "Tüm bağlantılar", "Havuzda", "Projeye atanmış"]],
] as const)("keeps upper labels, all options and clear visible in empty admin %s", (_name, Component, labels, options) => {
  const html = renderToStaticMarkup(<MemoryRouter><Component /></MemoryRouter>);
  for (const label of labels) {
    expect(html).toContain(`>${label}</label>`);
    expectLabel(html, label);
  }
  for (const option of options) expect(html).toContain(option);
  expect(html).toContain("Filtreleri temizle");
  expect(html).not.toContain("button:last");
});
