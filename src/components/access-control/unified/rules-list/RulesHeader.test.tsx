import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: "p" }) }));
vi.mock("react-router-dom", () => ({ useSearchParams: () => [new URLSearchParams(), vi.fn()] }));
vi.mock("./RulesPage", () => ({ RulesPage: () => <p>Sayfa 1 · 2 kural gösteriliyor</p> }));
vi.mock("./RulesFilters", () => ({ RulesFilters: () => null }));
vi.mock("../SyncRuns", () => ({ ProjectSyncButton: () => <button>Gönder</button>, RecentRuns: () => null, RuleLastRun: () => null }));
import AccessRulesList from "../AccessRulesList";
it("sekme adını ve açıklamayı gösterir, sayacı yalnız sayfalama satırında tutar", () => {
  const html = renderToStaticMarkup(<AccessRulesList onCreateRule={() => undefined} />);
  expect(html).toContain('<h1 class="text-xl font-semibold">Kurallar</h1>');
  expect(html).toContain("Kişilerin hangi kapılardan hangi gün ve saatlerde geçebileceğini belirleyin.");
  expect(html).not.toContain("Bu sayfada");
  expect(html).toContain("Sayfa 1 · 2 kural gösteriliyor");
  expect(html).toContain("Yeni kural");
  expect(html).toContain("Gönder");
});

vi.mock("convex/react", () => ({
  useQuery: () => ({ targetType: "personnel", panels: [], unassignedDoors: [{ doorId: "door", name: "Giriş" }] }),
  usePaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: vi.fn() }),
}));
import { AccessRuleDetails } from "../AccessRuleDetails";
import type { Id } from "../../../../../convex/_generated/dataModel";
it("kural ayrıntısında cihaz terimini kullanır", () => {
  const html = renderToStaticMarkup(<AccessRuleDetails ruleId={"r" as Id<"accessRules">} projectId={"p" as Id<"projects">} />);
  expect(html).toContain("Cihazlar ve kapılar");
  expect(html).toContain("Cihaz bağlantısı yok; cihaza uygulanamaz");
  expect(html).not.toMatch(/panel/i);
});
