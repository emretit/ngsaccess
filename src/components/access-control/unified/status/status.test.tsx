vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => state.admin, loading: false }) }));
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  confirmationText,
  failedConfirmationText,
  redistributionSuccessText,
  searchFilters,
  type Filters,
  countText,
  grantBadge,
  pairKey,
  queryArgs,
  togglePair,
  type EmployeeDetail,
  type GrantRow,
  type Pair,
} from "./model";
import {
  DeviceCounters,
  EmployeeStatus,
  EmptyStatus,
  GrantRows,
} from "./StatusViews";
const state = vi.hoisted(() => ({
  admin: true,
  params: "",
  query: vi.fn(),
  subscribe: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useConvex: () => ({ query: state.query }),
  useMutation: () => vi.fn(),
  useQuery: state.subscribe,
}));
vi.mock("@/contexts/ActiveProjectContext", () => ({
  useActiveProject: () => ({ canManage: state.admin, projectId: "project" }),
}));
vi.mock("react-router-dom", () => ({
  useSearchParams: () => [new URLSearchParams(state.params), vi.fn()],
}));
vi.mock("../AccessRulesList", () => ({
  default: () => <p>Kurallar listesi</p>,
}));
vi.mock("../CreateRuleDialog", () => ({ default: () => null }));
vi.mock("../templates/TemplatesPage", () => ({ default: () => null }));
import StatusPage from "./StatusPage";
import UnifiedAccessControl from "../UnifiedAccessControl";
const projectId = "p" as Id<"projects">;
const pair: Pair = {
  employeeId: "e" as Id<"employees">,
  deviceId: "d" as Id<"devices">,
};
const row: GrantRow = {
  ...pair,
  _id: "g" as Id<"accessGrantStatus">,
  _creationTime: 0,
  projectId,
  state: "failed",
  updatedAt: Date.parse("2026-10-22T09:15:00Z"),
  ruleIds: [],
  employeeName: "Deniz Test",
  departmentName: "Arge",
  deviceName: "Giriş",
  brand: "hikvision",
  doorIds: [],
  doorNames: ["Ana kapı"],
  ruleNames: ["Mesai"],
  templateIds: [],
  templateNames: ["Hafta içi"],
  stale: true,
  lastError: "Cihaz yanıt vermedi",
};
beforeEach(() => {
  state.admin = true;
  state.params = "";
  state.query.mockReset();
  state.subscribe.mockReset();
});
describe("yetki durumu saf model", () => {
  it("yalnız sınıra ulaşan capped sayacı 1000+ gösterir", () => {
    expect(countText(1000, true)).toBe("1000+");
    expect(countText(999, true)).toBe("999");
    expect(countText(1000, false)).toBe("1000");
  });
  it("filtreleri ve opak cursor'u sorguya aynen geçirir, aramayı temizler", () => {
    const filters = {
      departmentId: "dep" as Id<"departments">,
      deviceId: pair.deviceId,
      ruleId: "r" as Id<"accessRules">,
      templateId: "t" as Id<"accessScheduleTemplates">,
      state: "failed" as const,
      search: " Deniz ",
    };
    expect(queryArgs(projectId, filters, "opaque")).toEqual({
      projectId,
      ...filters,
      search: "Deniz",
      paginationOpts: { numItems: 50, cursor: "opaque" },
    });
    expect(
      queryArgs(projectId, { search: " " }).paginationOpts.cursor,
    ).toBeNull();
    expect(queryArgs(projectId, { search: " " }).search).toBeUndefined();
  });
  it("100 çift sınırı aşılmaz; seçili çift çıkarılabilir", () => {
    const selected = Array.from({ length: 100 }, (_, i) => ({
      ...pair,
      employeeId: `e${i}` as Id<"employees">,
    }));
    const blocked = togglePair(selected, pair);
    expect(blocked.pairs).toBe(selected);
    expect(blocked.error).toContain("100");
    expect(togglePair(selected, selected[0]).pairs).toHaveLength(99);
    expect(togglePair([], pair).pairs.map(pairKey)).toEqual([pairKey(pair)]);
  });
  it("hatalı dağıtım onayı tur sınırını ve capped sayıları açıklar", () => {
    expect(failedConfirmationText(3, false)).toBe(confirmationText(3));
    expect(failedConfirmationText(100, false)).toBe(confirmationText(100));
    expect(failedConfirmationText(250, false)).toContain("İlk 100 hatalı kişi×cihaz için tek gönderim başlatılacak; kalan 150 sonraki turda.");
    expect(failedConfirmationText(1000, true)).toContain("1000+ hatalı");
    expect(failedConfirmationText(1000, true)).toContain("kalan 900+ sonraki turda");
    expect(redistributionSuccessText({ pairCount: 100, remainingFailed: 1, remainingCapped: true })).toContain("Kalan 1+ hatalı");
    expect(redistributionSuccessText({ pairCount: 3, remainingFailed: 0, remainingCapped: false })).toContain("Kalan 0 hatalı");
  });
  it("ilk boş arama debounce'u liste yükleyicisini ikinci kez çağırmaz", () => {
    let filters: Filters = {};
    const load = vi.fn();
    const applySearch = (search: string) => {
      const next = searchFilters(filters, search);
      if (next !== filters) { filters = next; load(queryArgs(projectId, filters)); }
    };
    load(queryArgs(projectId, filters));
    applySearch(""); applySearch("  ");
    expect(load).toHaveBeenCalledTimes(1);
    applySearch(" Deniz "); applySearch("Deniz");
    expect(load).toHaveBeenCalledTimes(2);
    expect(load.mock.lastCall?.[0].search).toBe("Deniz");
    applySearch(""); applySearch(" ");
    expect(load).toHaveBeenCalledTimes(3);
  });
  it("onay metni ve stale/hata rozetleri", () => {
    expect(confirmationText(3)).toBe(
      "3 kişi×cihaz için tek gönderim başlatılacak.",
    );
    expect(grantBadge(row)).toEqual({
      label: "Bekliyor",
      stale: true,
      tone: "danger",
      hint: row.lastError,
    });
    expect(grantBadge({ state: "effective", stale: true })).toMatchObject({
      label: "Bekliyor",
      tone: "warning",
      stale: true,
    });
    expect(grantBadge({ state: "unknown" })).toMatchObject({
      label: "Bilinmiyor",
      hint: undefined,
    });
    expect(
      grantBadge({ state: "removed", lastError: "eski" }).hint,
    ).toBeUndefined();
  });
});
describe("yetki durumu SSR", () => {
  it("okuyucuya status sekmesi ve dağıtım aksiyonlarını sunmaz, deep link de açılmaz", () => {
    state.admin = false;
    state.params = "tab=status";
    expect(renderToStaticMarkup(<StatusPage />)).toBe("");
    const html = renderToStaticMarkup(<UnifiedAccessControl />);
    expect(html).not.toContain("Yetki Durumu");
    expect(html).not.toContain("yeniden dağıt");
    expect(html).toContain("Kurallar listesi");
  });
  it("yöneticiye üçüncü sekmeyi gösterir", () => {
    expect(renderToStaticMarkup(<UnifiedAccessControl />)).toContain(
      "Yetki Durumu",
    );
  });
  it("boş durum, mobil kartlar, masaüstü kolonları, tarih ve hata ipucunu gösterir", () => {
    const empty = renderToStaticMarkup(<EmptyStatus />);
    expect(empty).toContain("özellik açılmadan önceki dağıtımlar");
    expect(empty).toContain("Tümünü yeniden dağıt");
    const html = renderToStaticMarkup(
      <GrantRows
        rows={[row]}
        selected={[]}
        onToggle={() => undefined}
        onEmployee={() => undefined}
        canManage
      />,
    );
    for (const title of [
      "Kişi",
      "Departman",
      "Cihaz",
      "Kapı(lar)",
      "Kural",
      "Şablon",
      "Durum",
      "Son güncelleme",
    ])
      expect(html).toContain(title);
    expect(html).toContain("Güncel değil");
    expect(html).toContain('title="Cihaz yanıt vermedi"');
    expect(html).toContain("12:15");
    expect(html).toContain("lg:hidden");
    expect(html).toContain("Tüm kapılar (cihaz)");
    expect(
      renderToStaticMarkup(
        <GrantRows
          rows={[row]}
          selected={[]}
          onToggle={() => undefined}
          onEmployee={() => undefined}
          canManage={false}
        />,
      ),
    ).not.toContain('role="checkbox"');
  });
  it("cihaz sayaçları ve kişi detayının bilinmeyen/kaldırılacak/yetkisiz durumları", () => {
    const counters = renderToStaticMarkup(
      <DeviceCounters effective="1000+" pending={2} failed={3} />,
    );
    expect(counters).toContain("Etkin: 1000+");
    expect(counters).toContain("Bekliyor: 2");
    expect(counters).toContain("Hata: 3");
    const detail: EmployeeDetail = {
      rows: [
        {
          ...row,
          _id: null,
          state: "unknown",
          stale: false,
          authorized: true,
          removalRequired: false,
        },
        {
          ...row,
          deviceId: "d2" as Id<"devices">,
          authorized: false,
          removalRequired: true,
        },
      ],
      unauthorizedDoors: [
        {
          doorId: "door" as Id<"doors">,
          deviceId: null,
          doorName: "Depo",
          state: "unauthorized",
        },
      ],
    };
    const html = renderToStaticMarkup(<EmployeeStatus detail={detail} />);
    for (const text of [
      "Bilinmiyor",
      "Kaldırılacak",
      "Yetkisiz kapılar",
      "Depo",
    ])
      expect(html).toContain(text);
  });
  it("ilk SSR abonelik açmaz; grants yalnız tek seferlik query kullanır", () => {
    const html = renderToStaticMarkup(<StatusPage />);
    expect(html).toContain("Son yenileme");
    expect(html).toContain("Yenile");
    expect(state.subscribe).not.toHaveBeenCalled();
    const source = readFileSync(
      new URL("./StatusPage.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/\buseQuery\b|setInterval/);
    for (const name of ["listByProject", "counts", "byEmployee"])
      expect(source.replace(/\s/g, "")).toContain(
        `convex.query(api.accessGrantStatus.${name}`,
      );
    expect(source).toMatch(/\[search\]/);
    expect(source).toContain("300");
    const run = readFileSync(
      new URL("./RunNotice.tsx", import.meta.url),
      "utf8",
    );
    expect(run).toContain("useQuery(api.deviceSyncRuns.get");
    expect(run).toContain("!completed.current");
  });
});
