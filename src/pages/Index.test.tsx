import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Index from "./Index";

vi.mock("@/contexts/ActiveProjectContext", () => ({
  useActiveProject: () => ({ projectId: "p1", projects: [], loading: false, isSuperAdmin: false }),
}));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => <h1>Ana Sayfa</h1> }));
vi.mock("@/components/dashboard/TodayStrip", () => ({ default: () => <div>Özet</div> }));
vi.mock("@/components/dashboard/ReadingsTimeline", () => ({ default: () => <div>Grafik</div> }));
vi.mock("@/components/dashboard/LiveFeed", () => ({ default: () => <div>Akış</div> }));
vi.mock("@/components/dashboard/DeviceHealth", () => ({ default: () => <div>Cihazlar</div> }));
vi.mock("@/components/dashboard/QuickLinksGrid", () => ({ default: () => <div>Bağlantılar</div> }));

describe("Ana sayfa düzeni", () => {
  it("aligns the chart to content height and removes the repeated footer", () => {
    const html = renderToStaticMarkup(<MemoryRouter><Index /></MemoryRouter>);
    expect(html.match(/grid items-start/g)).toHaveLength(2);
    expect(html).not.toContain("<footer");
    expect(html).not.toContain("İstanbul saati (UTC+3)");
  });
});
