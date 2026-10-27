import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import UnifiedAccessControl from "./UnifiedAccessControl";

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock("../door-plans/DoorPlansTab", () => ({ DoorPlansTab: () => null }));
vi.mock("./status/StatusPage", () => ({ default: () => null }));
vi.mock("./AccessRulesList", () => ({ default: () => null }));
vi.mock("./CreateRuleDialog", () => ({ default: () => null }));
vi.mock("./SyncRuns", () => ({ RuleSaveNotice: () => null }));

it("mobil sekmeleri tek satırda, kaydırılabilir ve 44px dokunma hedefiyle sunar", () => {
  const html = renderToStaticMarkup(<MemoryRouter><UnifiedAccessControl /></MemoryRouter>);
  const tabList = html.match(/<div[^>]*role="tablist"[^>]*>/)?.[0];
  expect(tabList).toBeDefined();
  expect(tabList).toContain("flex-nowrap");
  expect(tabList).toContain("overflow-x-auto");
  expect(tabList).toContain("max-w-full");
  expect(tabList).toContain("[&amp;&gt;button]:shrink-0");
  expect(tabList).toContain("[&amp;&gt;button]:min-h-11");
  expect(tabList).toContain("md:[&amp;&gt;button]:min-h-0");
  expect(html.match(/role="tab"/g)).toHaveLength(3);
  for (const label of ["Kurallar", "Yetki Durumu", "Kapı Planları"]) {
    expect(html).toContain(label);
  }
  expect(html).not.toContain("Zaman Şablonları");
});
