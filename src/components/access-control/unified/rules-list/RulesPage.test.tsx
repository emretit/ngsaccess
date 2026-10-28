import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { RulesPage } from "./RulesPage";

const state = vi.hoisted(() => ({ loading: false, limited: false }));
vi.mock("convex/react", () => ({ useQuery: () => state.loading ? undefined : { page: [], isDone: true, searchLimited: state.limited, continueCursor: "" } }));
vi.mock("./RuleRow", () => ({ RuleRow: () => null }));

describe("Kurallar tablo durumları", () => {
  it.each(["empty", "loading", "limited"])("keeps six headers with %s state in the body", mode => {
    state.loading = mode === "loading";
    state.limited = mode === "limited";
    const html = renderToStaticMarkup(<RulesPage projectId={"project" as Id<"projects">} search="" searchBy="rule" status="all" type="all" clear={() => undefined} onCreateRule={() => undefined} />);
    expect(html).toMatch(/<thead.*Kural.*Kim.*Nereye.*Ne zaman.*Kural durumu.*İşlemler.*<\/thead>/s);
    const message = mode === "loading" ? "Erişim kuralları yükleniyor" : mode === "limited" ? "Aramayı daraltın" : "Henüz erişim kuralı yok";
    expect(html).toMatch(new RegExp(`<tbody.*colSpan="6".*${message}.*</tbody>`, "s"));
    if (mode === "empty") expect(html).toContain("Yeni kural");
  });
});
