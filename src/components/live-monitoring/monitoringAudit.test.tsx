vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (permission: string) => permission === "reports.view", loading: false }) }));
import { getFunctionName } from "convex/server";
import { MemoryRouter } from "react-router-dom";
import CardReadings from "../access-control/CardReadings";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CardReadingsFilters } from "../access-control/CardReadingsFilters";
import { CardReadingsTable } from "../access-control/CardReadingsTable";
import { Detail } from "./ReadingDetailPanel";
import { LiveStatus } from "./LiveStatus";
import { emptyFilters, readFilters, writeFilters, type Reading } from "./lib/readings";
import type { Id } from "../../../convex/_generated/dataModel";
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: mocks.query, useMutation: vi.fn(), useConvexConnectionState: () => ({ isWebSocketConnected: true }) }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "project", isAdmin: false }) }));
const projectId = "project" as Id<"projects">;
const row: Reading = { _id: "reading" as Id<"cardReadings">, _creationTime: 1, projectId, cardNo: "1", source: "biometric", accessTime: "2026-10-19T00:00:00Z", devices: null, employees: null, door: null };
beforeEach(() => { mocks.query.mockReset().mockReturnValue([]); });

describe("monitoring UI audit", () => {
  it("shows every filter, including dates, in one bar with accessible custom controls", () => {
    const html = renderToStaticMarkup(<CardReadingsFilters projectId={projectId} filters={emptyFilters} change={vi.fn()} />);
    expect(html).toContain("Başlangıç (TR günü)"); expect(html).toContain("Bitiş (TR günü)"); expect(html).not.toContain("Diğer filtreler");
    expect(html.match(/<select /g)).toHaveLength(4); expect(html.match(/<select aria-hidden="true"/g)).toHaveLength(4);
    for (const label of ["Kaynak", "Cihaz", "Kapı", "Sonuç", "Kişi"]) expectLabel(html, label);
    expect(html).toContain('for="reading-start">Başlangıç (TR günü)</label>');
    expect(html).toContain('for="reading-end">Bitiş (TR günü)</label>');
    for (const text of ["Tüm kaynaklar", "Tüm cihazlar", "Tüm kapılar", "Tüm sonuçlar", "Tüm kişiler", "Filtreleri temizle"]) expect(html).toContain(text);
  });
  it("renders one view without live/history toggles or a pause control", () => {
    for (const entry of ["/", "/?mode=history"]) {
      const html = renderToStaticMarkup(<MemoryRouter initialEntries={[entry]}><CardReadings /></MemoryRouter>);
      expect(html).not.toContain('aria-label="Görünüm"'); expect(html).not.toContain("Görüntüyü durdur"); expect(html).not.toContain(">Geçmiş<");
    }
    expect(renderToStaticMarkup(<LiveStatus projectId={projectId} live />)).toContain(">Canlı<");
    expect(renderToStaticMarkup(<LiveStatus projectId={projectId} live={false} />)).not.toContain(">Canlı<");
  });
  it("persists the source filter in the URL and rejects unknown values", () => {
    const filters = { ...emptyFilters, source: "biometric" as const };
    expect(readFilters(writeFilters(new URLSearchParams(), filters, projectId), projectId)).toEqual(filters);
    expect(readFilters(new URLSearchParams("source=oops"), projectId).source).toBe("all");
  });
  it("shows the last reading date even when today's feed has no rows", () => {
    mocks.query.mockImplementation((ref: Parameters<typeof getFunctionName>[0]) => ref && getFunctionName(ref) === "cardReadings:lastMonitoringReading" ? { accessTime: "2026-08-18T13:06:00Z" } : []);
    const html = renderToStaticMarkup(<LiveStatus projectId={projectId} live />);
    expect(html).toContain("Son okuma 18.08.2026 16:06:00");
  });
  it("offers explicit detail actions and an empty title", () => {
    expect(renderToStaticMarkup(<CardReadingsTable readings={[row]} onOpen={vi.fn()} />)).toContain("Ayrıntı");
    expect(renderToStaticMarkup(<CardReadingsTable readings={[]} onOpen={vi.fn()} />)).toContain("Okuma bulunamadı");
  });
  it("hides biometric card and redundant project fields, and uses a dash for missing department", () => {
    mocks.query.mockReturnValue(row);
    const html = renderToStaticMarkup(<Detail id={row._id} onClose={vi.fn()} onDirty={vi.fn()} onPending={vi.fn()} />);
    expect(html).not.toContain("Kart numarası"); expect(html).not.toContain(">Proje<");
    expect(html).toContain("Departman"); expect(html).toContain("—");
  });
  it("offers a return action for unavailable and foreign direct links", () => {
    for (const value of [null, { ...row, projectId: "foreign" }]) {
      mocks.query.mockReturnValue(value);
      const html = renderToStaticMarkup(createElement(Detail, { id: row._id, onClose: vi.fn(), onDirty: vi.fn(), onPending: vi.fn() }));
      expect(html).toContain("Listeye dön"); expect(html).toContain("Bu okuma artık görüntülenemiyor");
    }
  });
});

function expectLabel(html: string, label: string) {
  const labelTag = html.match(new RegExp(`<label[^>]*for="([^"]+)"[^>]*>${label}</label>`));
  expect(labelTag).not.toBeNull();
  const id = labelTag?.[1];
  const control = html.match(new RegExp(`<(?:button|input|select)[^>]*id="${id}"[^>]*>`))?.[0];
  expect(control).toBeDefined();
  expect(control).not.toContain('aria-label=');
  expect(html.match(new RegExp(`for="${id}"`, "g"))).toHaveLength(1);
}

vi.mock("@/components/ui/select", async original => ({
  ...await original<typeof import("@/components/ui/select")>(),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div role="option">{children}</div>,
}));
