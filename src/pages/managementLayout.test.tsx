import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import Leaves from "./Leaves";
import Profile from "./Profile";
import SystemAdmin from "./SystemAdmin";
import AuditLog from "./AuditLog";
import EngineeringDepartment from "./EngineeringDepartment";

const state = vi.hoisted(() => ({ loading: true }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => false, loading: state.loading }) }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ loading: state.loading, projectId: null }) }));
vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ loading: state.loading, user: null, profile: null }) }));
vi.mock("@/hooks/useProfileUtils", () => ({ useProfileUtils: () => ({ formData: {}, getUserInitials: () => "" }) }));
vi.mock("@/components/employees/EngineeringDepartmentView", () => ({ EngineeringDepartmentView: () => <p>Departman sonucu</p> }));
beforeEach(() => { state.loading = true; });

it.each([
  [Leaves, "İzinler"], [Profile, "Profil Bilgilerim"], [SystemAdmin, "Admin"], [AuditLog, "Denetim Kaydı"],
] as const)("retains the page heading while loading (%s)", (Page, title) => {
  const html = renderToStaticMarkup(<MemoryRouter><Page /></MemoryRouter>);
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).toContain(`>${title}</h1>`);
});

it.each([
  [Leaves, "Bir proje seçin."], [SystemAdmin, "süper admin yetkisi gerekli"], [AuditLog, "görüntüleme yetkiniz yok"],
] as const)("retains one heading in empty or denied states (%s)", (Page, message) => {
  state.loading = false;
  const html = renderToStaticMarkup(<MemoryRouter><Page /></MemoryRouter>);
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).toContain(message);
});

it("keeps Engineering content under one heading without page-level container padding", () => {
  const html = renderToStaticMarkup(<EngineeringDepartment />);
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).toContain("Departman sonucu");
  expect(html).not.toContain("container mx-auto");
});
