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
  GrantBadge,
  GrantRows,
} from "./StatusViews";
import { keepSameDevices } from "./useStatusData";
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
import StatusPage from "./StatusPage";
import { StatusCounters } from "./StatusCounters";
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
  stale: true,
  doorUnresolved: false,
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
    expect(failedConfirmationText(250, false)).toBe("İlk 100 kayıt gönderilecek; kalan 150 sonraki turda.");
    expect(failedConfirmationText(1000, true)).toContain("kalan 900+ sonraki turda");
    expect(redistributionSuccessText({ pairCount: 100, remainingFailed: 1, remainingCapped: true })).toContain("Kalan 1+ hatalı");
    expect(redistributionSuccessText({ pairCount: 3, remainingFailed: 0, remainingCapped: false })).not.toContain("sonraki turda");
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
      "3 kişi–cihaz kaydı için tek gönderim başlatılacak.",
    );
    expect(grantBadge(row)).toEqual({
      label: "Hata",
      stale: true,
      tone: "danger",
      hint: row.lastError,
    });
    expect(grantBadge({ state: "effective", stale: true })).toMatchObject({
      label: "Etkin",
      tone: "success",
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
  it("eski gönderim notunu yalnız bilinmeyen kayıt varken gösterir", () => {
    expect(renderToStaticMarkup(<EmptyStatus unknownCount={0} />)).toBe("");
    expect(renderToStaticMarkup(<EmptyStatus unknownCount={2} />)).toContain("özellik açılmadan önceki dağıtımlar");
  });
  it("proje ve departman özetleri arama ve durum filtreleriyle değişmez; rozet seçimini bildirir", () => {
    const counts = { all: 4, effective: 3, pending: 0, failed: 1, removed: 0, unknown: 0, capped: false, personCount: 2 };
    const render = (filters: Filters) => renderToStaticMarkup(<StatusCounters counts={counts} filters={filters} change={() => undefined} />);
    const initial = render({});
    expect(initial).toContain("Proje özeti · 4 kişi–cihaz kaydı · 2 kişi");
    expect(initial).toMatch(/aria-pressed="true"[^>]*>Tümü/);
    const searched = render({ search: "Deniz", state: "failed" });
    expect(searched).toContain("Proje özeti · 4 kişi–cihaz kaydı · 2 kişi");
    expect(searched).toMatch(/aria-pressed="true"[^>]*>Hata/);
    expect(searched).toMatch(/aria-pressed="false"[^>]*>Tümü/);
    expect(searched.match(/aria-pressed=/g)).toHaveLength(4);
    expect(render({ departmentId: "dep" as Id<"departments"> })).toContain("Departman özeti · 4 kişi–cihaz kaydı · 2 kişi");
    expect(renderToStaticMarkup(<StatusCounters counts={{ ...counts, capped: true }} filters={{}} change={() => undefined} />)).toContain("2+ kişi");
  });
  it("eski Convex sürümü kişi sayısı döndürmezse özet 'undefined' yazmaz", () => {
    const legacy = { all: 4, effective: 4, pending: 0, failed: 0, removed: 0, unknown: 0, capped: false } as Parameters<typeof StatusCounters>[0]["counts"];
    const html = renderToStaticMarkup(<StatusCounters counts={legacy} filters={{}} change={() => undefined} />);
    expect(html).toContain("Proje özeti · 4 kişi–cihaz kaydı");
    expect(html).not.toContain("undefined");
  });
  it("kuralın kendi saatini kişi ayrıntısında belirtir", () => {
    expect(renderToStaticMarkup(<EmployeeStatus detail={{ rows: [{ ...row, authorized: true, removalRequired: false }], unauthorizedDoors: [] }} />)).toContain("Kuralın kendi saati");
  });
  it("güncellik uyarısını saklanan durumdan ayrı gösterir", () => {
    const html = renderToStaticMarkup(<GrantBadge row={{ state: "effective", stale: true }} />);
    expect(html).toContain("Etkin");
    expect(html).toContain("Yeniden gönderilmeli");
    expect(html).toContain('title="Kural cihaza gönderildikten sonra değişti; yeniden dağıtın."');
    expect(html).not.toContain("Bekliyor");
  });
  it.each(["effective", "failed"] as const)("kapı uyarısını %s durumundan ayrı gösterir, teknik hatayı gizler", (grantState) => {
    const html = renderToStaticMarkup(
      <GrantRows rows={[{ ...row, state: grantState, doorUnresolved: true, lastError: "door_io_unresolved: ioId 99" }]}
        selected={[]} onToggle={() => undefined} onEmployee={() => undefined} canManage={false} />,
    );
    expect(html).toContain(grantState === "effective" ? "Etkin" : "Hata");
    expect(html).toContain("Kapı seçimi düzeltilmeli");
    expect(html).toContain('title="Kuralın kapı seçimini düzeltin; yeniden göndermek bunu çözmez."');
    expect(html).not.toContain("door_io_unresolved");
    expect(html).not.toContain("ioId");
  });
  it("kapı düzeltmesini güncellik uyarısına tercih eder ve en çok iki rozet sunar", () => {
    const html = renderToStaticMarkup(<GrantBadge row={{ ...row, doorUnresolved: true }} />);
    expect(html).toContain("Kapı seçimi düzeltilmeli");
    expect(html).not.toContain("Yeniden gönderilmeli");
    expect(html.match(/status-(?:danger|warning)-badge/g)).toHaveLength(2);
  });
  it("eski hatayı tarihle geçmiş zamanda gösterir; ham hata yalnız çekmecede kalır", () => {
    const failed = { ...row, lastError: "Cihaz çevrimdışı: raw diagnostics 99" };
    const html = renderToStaticMarkup(<GrantRows rows={[failed]} selected={[]} onToggle={() => {}} onEmployee={() => {}} canManage={false} />);
    expect(html).toContain("Son deneme 22.10.2026 12:15 · cihaz o sırada çevrimdışıydı");
    expect(html).not.toContain("raw diagnostics 99");
    const detail = renderToStaticMarkup(<EmployeeStatus detail={{ rows: [{ ...failed, authorized: true, removalRequired: false }], unauthorizedDoors: [] }} />);
    expect(detail).toMatch(/<details><summary[^>]*>Hata ayrıntısı<\/summary><p[^>]*>Son deneme 22.10.2026 12:15 · Cihaz çevrimdışı: raw diagnostics 99/);
    expect(detail).toContain("Departman: Arge");
    expect(detail).toContain("Son güncelleme: 22.10.2026 12:15");
    expect(detail).toContain("Mesai");
    expect(detail).toContain("Kural dışında kalan kapı yok.");
  });
  it("cihaz iç satırları cihaz adını tekrar etmeden kapıları korur", () => {
    const html = renderToStaticMarkup(<GrantRows hideDevice rows={[row]} selected={[]} onToggle={() => {}} onEmployee={() => {}} canManage={false} />);
    expect(html).not.toContain(row.deviceName);
    expect(html).not.toContain("Cihaz/kapı");
    expect(html).toContain("Ana kapı");
  });
  it("ikincil sıfır sayaçları gizler ve pozitif olanları gösterir", () => {
    const counts = { all: 4, effective: 1, pending: 0, failed: 1, removed: 1, unknown: 1, capped: false, personCount: 2 };
    const html = renderToStaticMarkup(<StatusCounters counts={counts} filters={{}} change={() => {}} />);
    expect(html).toContain("Kaldırıldı: 1");
    expect(html).toContain("Bilinmiyor: 1");
    const empty = renderToStaticMarkup(<StatusCounters counts={{ ...counts, removed: 0, unknown: 0 }} filters={{}} change={() => {}} />);
    expect(empty).not.toContain("Kaldırıldı");
    expect(empty).not.toContain("Bilinmiyor");
    expect(empty).toContain("Bekliyor: 0");
  });
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
    const empty = renderToStaticMarkup(<EmptyStatus unknownCount={1} />);
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
      "Cihaz/kapı",
      "Durum",
    ])
      expect(html).toContain(title);
    expect(html).toContain("Yeniden gönderilmeli");
    expect(html).toContain("Son deneme 22.10.2026 12:15 · Cihaz yanıt vermedi");
    for (const hidden of ["Departman", "Son güncelleme", "Mesai", "Arge"]) expect(html).not.toContain(hidden);
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
    expect(html).toMatch(/<details><summary[^>]*>Kural dışında kalan 1 kapı/);
    expect(html).not.toContain("<details open");
    for (const text of [
      "Bilinmiyor",
      "Kaldırılacak",
      "Kural dışında kalan 1 kapı",
      "Depo",
    ])
      expect(html).toContain(text);
  });
  it("ilk SSR abonelik açmaz; grants yalnız tek seferlik query kullanır", () => {
    const html = renderToStaticMarkup(<StatusPage />);
    expect(html).toContain("Kişi yetkilerinin cihazlara ulaşıp ulaşmadığını kontrol edin.");
    expect(html).toContain("Liste okundu");
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
  it("Yenile filtre seçeneklerini de yeniden yükler", () => {
    const page = readFileSync(
      new URL("./StatusPage.tsx", import.meta.url),
      "utf8",
    ).replace(/\s/g, "");
    expect(page).toContain(
      "useStatusOptions({convex,projectId,setError,revision})",
    );
    const data = readFileSync(
      new URL("./useStatusData.ts", import.meta.url),
      "utf8",
    ).replace(/\s/g, "");
    expect(data).toContain("},[convex,projectId,revision,setError]);");
  });
  it("cihaz kimliği ve adı aynıysa eski diziyi korur, değişince yenisini alır", () => {
    const prev = [
      { _id: "d1", name: "Giriş" },
      { _id: "d2", name: "Depo" },
    ];
    expect(keepSameDevices(prev, prev.map((d) => ({ ...d })))).toBe(prev);
    const renamed = [{ _id: "d1", name: "Ana giriş" }, prev[1]];
    expect(keepSameDevices(prev, renamed)).toBe(renamed);
    const added = [...prev, { _id: "d3", name: "Otopark" }];
    expect(keepSameDevices(prev, added)).toBe(added);
    expect(keepSameDevices(prev, [prev[1], prev[0]])).not.toBe(prev);
  });
});
