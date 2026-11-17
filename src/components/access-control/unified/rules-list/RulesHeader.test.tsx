import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: "p" }) }));
vi.mock("react-router-dom", () => ({ useSearchParams: () => [new URLSearchParams(), vi.fn()] }));
vi.mock("./RulesPage", () => ({ RulesPage: () => <p>Sayfa 1 · 2 kural gösteriliyor</p> }));
vi.mock("./RulesFilters", () => ({ RulesFilters: () => null }));
vi.mock("../SyncRuns", () => ({ ProjectSyncButton: () => <button>Gönder</button>, RecentRuns: () => null, RuleLastRun: () => null }));
import AccessRulesList from "../AccessRulesList";
it("yerel başlık ve eylemleri kaldırır, sayacı yalnız sayfalama satırında tutar", () => {
  const html = renderToStaticMarkup(<AccessRulesList onCreateRule={() => undefined} />);
  expect(html).not.toContain("<h1");
  expect(html).not.toContain("Kişilerin hangi kapılardan");
  expect(html).not.toContain("Bu sayfada");
  expect(html).toContain("Sayfa 1 · 2 kural gösteriliyor");
  expect(html).not.toContain("Yeni kural");
  expect(html).not.toContain("Gönder");
});

vi.mock("convex/react", () => ({
  useQuery: () => ({ targetType: "personnel", groupMembers: [], panels: [], unassignedDoors: [{ doorId: "door", name: "Giriş" }] }),
  usePaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: vi.fn() }),
}));
import { AccessRuleDetails } from "../AccessRuleDetails";
import type { Id } from "../../../../../convex/_generated/dataModel";
it("kural ayrıntısında cihaz terimini kullanır", () => {
  const html = renderToStaticMarkup(<AccessRuleDetails ruleId={"r" as Id<"accessRules">} projectId={"p" as Id<"projects">} />);
  expect(html).toContain("Kişileri göster (0)");
  expect(html).toContain("Kapıları göster (1)");
  expect(html).not.toContain("<details open");
  expect(html).toContain("Cihaz bağlantısı yok; cihaza uygulanamaz");
  expect(html).not.toMatch(/panel/i);
});
