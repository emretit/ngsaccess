import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Alarms from "./Alarms";

const state = vi.hoisted(() => ({ manage: false, admin: false, scopeLoading: false, pageStatus: "Exhausted" }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (permission: string) => permission === "alarms.ack" ? state.manage : permission === "admin.manage" && state.admin }) }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "project", activeProject: { name: "Proje" }, loading: state.scopeLoading }) }));
vi.mock("convex/react", () => ({ useQuery: (_query: unknown, args: unknown) => args === "skip" ? undefined : [], useMutation: () => vi.fn(), usePaginatedQuery: () => ({ results: [], status: state.pageStatus, loadMore: vi.fn() }) }));

describe("Alarm tablosu durumları", () => {
  it("proje yüklenirken başlıkları korur", () => {
    state.scopeLoading = true;
    try {
      const html = renderToStaticMarkup(<MemoryRouter><Alarms /></MemoryRouter>);
      expect(html).toContain("<thead");
      expect(html).toMatch(/<tbody>.*aria-busy="true"/s);
    } finally { state.scopeLoading = false; }
  });
  it.each([[false, false], [true, false], [false, true], [true, true]])("yetkilere göre boş ve yükleme satırının kolon sayısını korur (%s, %s)", (manage, admin) => {
    state.manage = manage;
    state.admin = admin;
    for (const pageStatus of ["LoadingFirstPage", "Exhausted", "CanLoadMore"]) {
      state.pageStatus = pageStatus;
      const html = renderToStaticMarkup(<MemoryRouter><Alarms /></MemoryRouter>);
      const columns = 5 + (manage ? 2 : 0) + (admin ? 1 : 0);
      expect(html).toContain("<thead");
      expect(html.match(/<th /g)).toHaveLength(columns);
      expect(html).toContain(`colSpan="${columns}"`);
      expect(html).toMatch(pageStatus === "LoadingFirstPage" ? /<tbody>.*aria-busy="true"/s : /<tbody>.*(?:Olay bulunamadı|Daha fazla yükle)/s);
      if (pageStatus === "CanLoadMore") expect(html).toContain("Tarama sınırına ulaşıldı");
    }
  });
});
