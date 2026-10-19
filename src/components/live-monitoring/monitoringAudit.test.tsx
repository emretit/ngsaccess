import { getFunctionName } from "convex/server";
import { MemoryRouter } from "react-router-dom";
import CardReadings from "../access-control/CardReadings";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { watchReadingScroll } from "./lib/scroll";
import { CardReadingsFilters } from "../access-control/CardReadingsFilters";
import { CardReadingsTable } from "../access-control/CardReadingsTable";
import { Detail } from "./ReadingDetailPanel";
import { emptyFilters, readFilters, writeFilters, type Reading } from "./lib/readings";
import type { Id } from "../../../convex/_generated/dataModel";
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: mocks.query, useMutation: vi.fn(), useConvexConnectionState: () => ({ isWebSocketConnected: true }) }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "project", isAdmin: false }) }));
const projectId = "project" as Id<"projects">;
const row: Reading = { _id: "reading" as Id<"cardReadings">, _creationTime: 1, projectId, cardNo: "1", source: "biometric", accessTime: "2026-10-19T00:00:00Z", devices: null, employees: null, door: null };
beforeEach(() => { mocks.query.mockReset().mockReturnValue([]); });

describe("monitoring UI audit", () => {
  it("pauses on the real scroll container and removes its listener", () => {
    const container = new EventTarget();
    Object.assign(container, { scrollTop: 120 });
    const pause = vi.fn();
    const cleanup = watchReadingScroll(container as Element, pause);
    expect(pause).not.toHaveBeenCalled();
    Object.assign(container, { scrollTop: 0 });
    container.dispatchEvent(new Event("scroll")); expect(pause).not.toHaveBeenCalled();
    Object.assign(container, { scrollTop: 81 });
    container.dispatchEvent(new Event("scroll")); expect(pause).toHaveBeenCalledOnce();
    cleanup?.(); container.dispatchEvent(new Event("scroll")); expect(pause).toHaveBeenCalledOnce();
  });
  it("shows dates only in history and uses accessible custom filter controls", () => {
    const live = renderToStaticMarkup(<CardReadingsFilters projectId={projectId} filters={emptyFilters} change={vi.fn()} />);
    expect(live).not.toContain("Başlangıç (TR günü)"); expect(live.match(/<select /g)).toHaveLength(4); expect(live.match(/<select aria-hidden="true"/g)).toHaveLength(4);
    expect(live).toContain('aria-label="Kaynak"'); expect(live).toContain('aria-label="Cihaz"');
    const history = renderToStaticMarkup(<CardReadingsFilters projectId={projectId} filters={{ ...emptyFilters, mode: "history" }} change={vi.fn()} />);
    expect(history).toContain("Başlangıç (TR günü)"); expect(history).toContain("Bitiş (TR günü)");
  });
  it("labels the view group for assistive technology and simplifies history guidance", () => {
    const live = renderToStaticMarkup(<MemoryRouter><CardReadings /></MemoryRouter>);
    expect(live).toContain('role="group" aria-label="Görünüm"');
    const history = renderToStaticMarkup(<MemoryRouter initialEntries={["/?mode=history"]}><CardReadings /></MemoryRouter>);
    expect(history).toContain("0 kayıt tarandı, 0 eşleşti, 0 gösteriliyor.");
    expect(history).toContain("Daha eski kayıtları yükle"); expect(history).not.toContain("aday kayıt");
  });
  it("persists the source filter in the URL and rejects unknown values", () => {
    const filters = { ...emptyFilters, source: "biometric" as const };
    expect(readFilters(writeFilters(new URLSearchParams(), filters, projectId), projectId)).toEqual(filters);
    expect(readFilters(new URLSearchParams("source=oops"), projectId).source).toBe("all");
  });
  it("shows the last reading date even when today's feed has no rows", () => {
    mocks.query.mockImplementation((ref: Parameters<typeof getFunctionName>[0]) => ref && getFunctionName(ref) === "cardReadings:lastMonitoringReading" ? { accessTime: "2026-08-18T13:06:00Z" } : []);
    const html = renderToStaticMarkup(<MemoryRouter><CardReadings /></MemoryRouter>);
    expect(html).toContain("Son okuma 18.08.2026 16:06:00");
  });
  it("offers explicit detail actions and a live empty title", () => {
    expect(renderToStaticMarkup(<CardReadingsTable readings={[row]} onOpen={vi.fn()} />)).toContain("Ayrıntı");
    expect(renderToStaticMarkup(<CardReadingsTable readings={[]} live onOpen={vi.fn()} />)).toContain("Bugün okuma yok");
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
