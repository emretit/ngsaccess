import { expectLabel } from "@/test-utils/filterLabel";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HolidayCalendarManager } from "./HolidayCalendarManager";
import { todayInTurkey } from "@/lib/date";

const state = vi.hoisted(() => ({ year: vi.fn(), yearText: vi.fn(), clear: undefined as (() => void) | undefined }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => {
    if (typeof initial === "number") return [2024, state.year];
    if (initial === "2024") return ["2024", state.yearText];
    return actual.useState(initial);
  } };
});
vi.mock("@/components/shared/FilterBar", async original => {
  const actual = await original<typeof import("@/components/shared/FilterBar")>();
  return { ...actual, FilterBar: (props: Parameters<typeof actual.FilterBar>[0]) => { state.clear = props.onClear; return <actual.FilterBar {...props} />; } };
});
vi.mock("convex/react", () => ({ useQuery: () => [], useMutation: () => vi.fn() }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "project", loading: false }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock("@/components/shared/UnsavedChangesDialog", () => ({ useUnsavedChangesGuard: () => ({ dialog: null, requestClose: vi.fn() }) }));
beforeEach(() => { state.year.mockClear(); state.yearText.mockClear(); state.clear = undefined; });
describe("holiday year filters", () => {
  it("keeps the labeled year and clear action visible for an empty calendar, with separate management actions", () => {
    const html = renderToStaticMarkup(<HolidayCalendarManager />);
    const bar = html.match(/<div role="search" aria-label="Tatil takvimi filtreleri"[\s\S]*?Filtreleri temizle<\/button><\/div>/)?.[0];
    expect(bar).toBeTruthy();
    expect(bar).toContain('for="holiday-year">Yıl</label>');
    expectLabel(bar ?? "", "Yıl");
    expect(bar).not.toContain('type="search"');
    expect(bar).not.toContain('Tatil ekle');
    expect(bar).not.toContain('Resmi tatilleri yükle');
    expect(html).toContain("2024 yılı için tanımlı tatil yok");
    expect(html).toContain("Resmi tatilleri yükle");
    expect(html).toContain("Tatil ekle");
  });
  it("resets both the queried year and its input to the current Turkish year", () => {
    renderToStaticMarkup(<HolidayCalendarManager />);
    expect(state.clear).toBeTypeOf("function");
    state.clear?.();
    const currentYear = todayInTurkey().slice(0, 4);
    expect(state.year).toHaveBeenCalledWith(Number(currentYear));
    expect(state.yearText).toHaveBeenCalledWith(currentYear);
  });
});
