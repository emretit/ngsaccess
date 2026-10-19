import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TodayStrip from "./TodayStrip";
import LiveFeed from "./LiveFeed";
import ReadingsTimeline from "./ReadingsTimeline";
import DashboardHeader from "./DashboardHeader";
import { DashboardPanel } from "./DashboardPanel";

const state = vi.hoisted(() => ({
  now: Date.parse("2026-10-19T11:30:00Z"),
  loading: false,
  present: null as number | null,
  inside: null as number | null,
  late: null as number | null,
  total: 0,
  readings: [] as { _id: string; accessTime: string; employeeName: string; accessStatus: string }[],
}));
vi.mock("@/hooks/useDashboard", () => ({
  useDashboardStats: () => ({ stats: { employees: 7 }, loading: state.loading }),
  useDashboardActivity: () => ({
    summary: { presentToday: state.present, insideBuilding: state.inside, lateArrivals: state.late },
    loading: state.loading,
  }),
  useDashboardTimeline: () => ({
    timeline: { total: state.total, granted: state.total, denied: 0, hours: [] }, loading: state.loading,
  }),
  useDashboardReadings: () => ({ readings: state.readings, loading: state.loading }),
}));
vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ profile: { role: "admin" } }) }));
vi.mock("@/hooks/useNow", () => ({ useNow: () => state.now }));
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
  NumberFlowGroup: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));
const render = (node: ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

beforeEach(() => {
  state.present = null; state.inside = null; state.late = null;
  state.loading = false; state.total = 0; state.readings = [];
});
describe("dashboard audit fixes", () => {
  it("keeps absent summary values distinct from zero and hides the attendance rate", () => {
    const html = render(<TodayStrip />);
    expect(html.match(/Bugün okuma yok/g)).toHaveLength(3);
    expect(html.match(/>—</g)).toHaveLength(3);
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain("/ 7");
    // Timeline's actual zero remains a zero.
    expect(html).toContain("Kart okuması");
    expect(html).toContain("<span>0</span>");
  });
  it("preserves actual zero values and the meaningful attendance percentage", () => {
    state.present = 0; state.inside = 0; state.late = 0;
    const html = render(<TodayStrip />);
    expect(html).not.toContain("Bugün okuma yok");
    expect(html).toContain('aria-valuenow="0"');
    expect(html).toContain("/ 7");
    expect(html.match(/<span>0<\/span>/g)).toHaveLength(4);
  });
  it("shows loading placeholders before summary values arrive", () => {
    state.loading = true;
    expect(render(<TodayStrip />).match(/Yükleniyor/g)).toHaveLength(4);
  });
  it.each([30 * 60_000, 60 * 60_000])("keeps the live dot for a recent reading (%s ms)", age => {
    state.readings = [{ _id: "r1", accessTime: new Date(state.now - age).toISOString(), employeeName: "Ada", accessStatus: "izin_verildi" }];
    const html = render(<LiveFeed />);
    expect(html).toContain("Canlı");
    expect(html).toContain("animate-ping");
    expect(html).not.toContain("Son okuma:");
  });
  it("extinguishes the dot after an hour and shows the complete Istanbul date", () => {
    state.readings = [{ _id: "r1", accessTime: "2025-08-18T13:06:00Z", employeeName: "Ada", accessStatus: "izin_verildi" }];
    const html = render(<LiveFeed />);
    expect(html).toContain("Son okuma: 18.08.2025 16:06");
    expect(html).toContain('title="18.08.2025 16:06"');
    expect(html).not.toContain("animate-ping");
    expect(html).not.toContain("Canlı");
  });
  it("does not claim live activity when the feed is empty or loading", () => {
    expect(render(<LiveFeed />)).toContain("Henüz okuma yok");
    expect(render(<LiveFeed />)).not.toContain("animate-ping");
    state.loading = true;
    expect(render(<LiveFeed />)).not.toContain("animate-ping");
  });
  it("keeps the empty chart compact and the panel at its content height", () => {
    const html = render(<ReadingsTimeline />);
    expect(html).toContain("Bugün henüz kart okuması yok.");
    expect(html).not.toContain("h-[200px]");
    expect(html).not.toMatch(/class="[^"]*\bh-full\b/);
  });
  it("uses consistent access status labels in the chart legend", () => {
    state.total = 1;
    const html = render(<ReadingsTimeline />);
    expect(html).toContain("İzin verildi");
    expect(html).toContain("Reddedildi");
    expect(html).not.toMatch(/>İzin</);
    expect(html).not.toMatch(/>Ret</);
  });
  it("exposes the clock through actual screen reader text", () => {
    const html = render(<DashboardHeader />);
    expect(html).toContain('<span class="sr-only">İstanbul saati 14:30</span>');
    expect(html).not.toContain('<p class="text-right" aria-label=');
  });
  it("gives panel links a 44px minimum touch target", () => {
    const html = render(<DashboardPanel title="Test" link={{ to: "/devices", label: "Cihazlar" }}>İçerik</DashboardPanel>);
    expect(html).toMatch(/<a[^>]*class="[^"]*min-h-11/);
  });
});
