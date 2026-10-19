import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { ReactNode } from "react";
import { LeaveDetails } from "../LeaveDetails";
import { LeaveList } from "../LeaveList";
import { LeaveResults } from "../LeaveResults";
import {
  boundaryFor,
  calendarDays,
  currentMonth,
  leaveError,
  leaveFormSchema,
  leaveStatuses,
  leaveTypes,
  makeLeaveFormSchema,
  pageSlice,
  projectScopedLeaveParams,
  monthRange,
  pdksHref,
  readFilters,
  validDate,
  type LeaveRow,
} from "./leaveState";

const mocks = vi.hoisted(() => ({ query: vi.fn(), paginated: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: mocks.query,
  usePaginatedQuery: mocks.paginated,
}));
vi.mock("@/components/ui/sheet", () => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Sheet: Wrapper,
    SheetContent: Wrapper,
    SheetHeader: Wrapper,
    SheetTitle: Wrapper,
    SheetDescription: Wrapper,
  };
});
const row: LeaveRow = {
  _id: "leave-1" as Id<"leaves">,
  employeeId: "person-1" as Id<"employees">,
  employeeName: "Ada Kaya",
  employeeMissing: false,
  departmentName: "Operasyon",
  leaveType: "annual",
  startDate: "2026-09-29",
  endDate: "2026-10-02",
  calendarDays: 4,
  notesHidden: false,
  status: "approved",
  notes: "Not",
  createdAt: "2026-09-01T12:00:00Z",
  updatedAt: "2026-09-01T12:00:00Z",
};
const values = {
  employeeId: "person-1",
  leaveType: "annual",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  notes: "",
};
describe("leave date and filter contracts", () => {
  it("uses Istanbul month at the UTC month boundary", () => {
    expect(currentMonth(new Date("2026-09-30T21:15:00Z"))).toBe("2026-10");
    expect(currentMonth(new Date("2026-09-30T20:59:00Z"))).toBe("2026-09");
  });
  it("handles leap months and refuses invalid months", () => {
    expect(monthRange("2024-02")).toEqual({
      rangeStart: "2024-02-01",
      rangeEnd: "2024-02-29",
    });
    expect(monthRange("2026-13")).toBeUndefined();
  });
  it("rejects impossible dates, reversed ranges and year zero", () => {
    for (const date of ["2026-02-30", "2026-2-03", "0000-01-01", "bad"])
      expect(validDate(date)).toBe(false);
    expect(validDate("0099-01-01")).toBe(true);
    expect(calendarDays("2026-10-04", "2026-10-03")).toBeNull();
  });
  it("counts inclusive calendar dates across DST and weekends", () => {
    expect(calendarDays("2026-03-28", "2026-03-30")).toBe(3);
    expect(calendarDays("2026-10-01", "2026-10-01")).toBe(1);
    expect(calendarDays("2026-09-29", "2026-10-02")).toBe(4);
  });
  it("allows 366 calendar days and rejects longer new records", () => {
    expect(
      leaveFormSchema.safeParse({
        ...values,
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      }).success,
    ).toBe(true);
    const result = leaveFormSchema.safeParse({
      ...values,
      startDate: "2024-01-01",
      endDate: "2025-01-01",
    });
    expect(result.success).toBe(false);
  });
  it("keeps required and reversed errors on their fields", () => {
    const result = leaveFormSchema.safeParse({
      ...values,
      employeeId: "",
      startDate: "",
      endDate: "",
    });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "Bir kişi seçin.",
      "Başlangıç tarihini girin.",
      "Bitiş tarihini girin.",
    ]);
    expect(
      leaveFormSchema.safeParse({ ...values, startDate: "2026-10-04" }).error
        ?.issues[0].path,
    ).toEqual(["endDate"]);
  });
  it("reads URL filters and safely defaults malformed periods", () => {
    const now = new Date("2026-10-17T12:00:00Z");
    expect(
      readFilters(
        new URLSearchParams(
          "period=custom&from=2026-09-29&to=2026-10-02&type=sick&employee=person-1&size=50",
        ),
        now,
      ),
    ).toEqual({
      period: "custom",
      rangeStart: "2026-09-29",
      rangeEnd: "2026-10-02",
      leaveType: "sick",
      employeeId: "person-1",
      pageSize: 50,
    });
    expect(
      readFilters(
        new URLSearchParams(
          "period=custom&from=2026-10-31&to=2026-10-01&type=bad&size=999",
        ),
        now,
      ),
    ).toMatchObject({
      period: "2026-10",
      rangeStart: "2026-10-01",
      rangeEnd: "2026-10-31",
      leaveType: undefined,
      pageSize: 25,
    });
  });
  it("preserves legacy dates for notes and type edits, but validates date changes", () => {
    const original = { startDate: "2020-01-01", endDate: "2022-12-31" };
    expect(
      makeLeaveFormSchema(original).safeParse({
        ...values,
        ...original,
        notes: "Düzeltme",
      }).success,
    ).toBe(true);
    expect(
      makeLeaveFormSchema(original).safeParse({
        ...values,
        ...original,
        endDate: "2023-01-01",
      }).success,
    ).toBe(false);
    expect(
      makeLeaveFormSchema({ startDate: "bad", endDate: "bad" }).safeParse({
        ...values,
        startDate: "bad",
        endDate: "bad",
      }).success,
    ).toBe(true);
  });
  it("drops old project identity and cursor without changing the period", () => {
    const params = new URLSearchParams(
      "scope=old&employee=person-1&leave=leave-1&cursor=abc&period=2026-09&type=sick",
    );
    const next = projectScopedLeaveParams(params, "new");
    expect(next.has("employee")).toBe(false);
    expect(next.has("leave")).toBe(false);
    expect(next.has("cursor")).toBe(false);
    expect(next.get("period")).toBe("2026-09");
    expect(next.get("type")).toBe("sick");
    expect(params.get("employee")).toBe("person-1");
  });
  it("does not invent statutory durations or rename legacy statuses", () => {
    expect(leaveTypes.marriage).toBe("Evlilik izni");
    expect(leaveStatuses.pending).toEqual({
      label: "Beklemede",
      tone: "warning",
    });
    expect(leaveStatuses.rejected.tone).toBe("danger");
  });
  it("links PDKS using supported name search and custom range", () => {
    const url = new URL(pdksHref(row), "http://local");
    expect(url.pathname).toBe("/pdks-records");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      report: "custom",
      from: row.startDate,
      to: row.endDate,
      date: row.startDate,
      person: row.employeeName,
    });
    expect(
      new URL(
        pdksHref({ ...row, employeeMissing: true }),
        "http://local",
      ).searchParams.has("person"),
    ).toBe(false);
  });
  it("narrows server error and retains the overlap record context", () => {
    expect(
      leaveError({
        data: {
          code: "LEAVE_OVERLAP",
          message: "Çakışma",
          conflictLeaveId: "leave-2",
          conflictStartDate: "2026-10-01",
          conflictEndDate: "2026-10-02",
        },
      }).conflict,
    ).toEqual({ id: "leave-2", start: "2026-10-01", end: "2026-10-02" });
    expect(
      leaveError({ data: { code: "LEAVE_STALE", message: "Old" } }).message,
    ).toBe("Kayıt başka bir yerde değişti; yenileyip tekrar deneyin.");
    expect(leaveError({ data: 42 }).message).toContain(
      "Bilgileriniz korunuyor",
    );
  });
});
function renderResults() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <LeaveResults
        filters={{
          projectId: "project-1" as Id<"projects">,
          rangeStart: "2026-10-01",
          rangeEnd: "2026-10-31",
        }}
        pageSize={25}
        isAdmin={false}
        onCreate={() => {}}
        onClear={() => {}}
        onDetails={() => {}}
        onEdit={() => {}}
        onRows={() => {}}
      />
    </MemoryRouter>,
  );
}
describe("bounded list presentation", () => {
  it("keeps empty candidate pages navigable", () => {
    mocks.paginated.mockReturnValue({
      results: [],
      status: "CanLoadMore",
      loadMore: vi.fn(),
    });
    mocks.query.mockReturnValue({
      truncated: false,
      recordCount: 1,
      employeeCount: 1,
    });
    const html = renderResults();
    expect(html).toContain(
      "Bu sayfada eşleşen izin yok; daha eski kayıtları tarayın.",
    );
    const next = html.match(/<button[^>]*>Devam<\/button>/)?.[0];
    expect(next).toBeDefined();
    expect(next).not.toContain(' disabled="');
  });
  it("never presents truncated summaries as an exact total", () => {
    mocks.paginated.mockReturnValue({
      results: [row],
      status: "Exhausted",
      loadMore: vi.fn(),
    });
    mocks.query.mockReturnValue({
      truncated: true,
      recordCount: 5000,
      employeeCount: 4000,
    });
    const html = renderResults();
    expect(html).toContain("1 kayıt gösteriliyor");
    expect(html).not.toContain("5000 kayıt");
  });
  it("keeps table and semantic mobile list with full record duration", () => {
    const html = renderToStaticMarkup(
      <LeaveList
        rows={[
          {
            ...row,
            employeeMissing: true,
            employeeName: "Personel bulunamadı",
            status: "pending",
          },
        ]}
        isAdmin
        onDetails={() => {}}
        onEdit={() => {}}
      />,
    );
    expect(html).toContain("<table");
    expect(html).toContain("<ul");
    expect(html).toContain("4 takvim günü");
    expect(html).toContain("29.09.2026");
    expect(html).toContain("Personel bulunamadı");
    expect(html).toContain("Beklemede");
    expect(html).not.toContain("checkbox");
  });
  it("explains hidden notes without exposing their contents", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <LeaveDetails
          row={{ ...row, notesHidden: true, notes: "Gizli açıklama" }}
          isAdmin={false}
          onClose={() => {}}
          onEdit={() => {}}
        />
      </MemoryRouter>,
    );
    expect(html).toContain("Açıklama yalnız yöneticilere görünür.");
    expect(html).not.toContain("Gizli açıklama");
    expect(html).toContain("aynı adlı kişiler de eşleşebilir");
    expect(html).not.toContain(">Düzenle<");
  });
  it("shows loading without a fabricated zero", () => {
    mocks.paginated.mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
    });
    const html = renderResults();
    expect(html).toContain("İzin kayıtları yükleniyor.");
    expect(html).not.toContain("0 kayıt");
  });
});

describe("page boundaries survive live list changes", () => {
  const ids = (rows: { _id: string }[]) => rows.map((item) => item._id);
  const make = (...names: string[]) => names.map((_id) => ({ _id }));
  const list = make("a", "b", "c", "d", "e", "f");
  const boundaries = [boundaryFor(list.slice(0, 3))];

  it("splits pages at the recorded record", () => {
    expect(ids(pageSlice(list, boundaries, 0))).toEqual(["a", "b", "c"]);
    expect(ids(pageSlice(list, boundaries, 1))).toEqual(["d", "e", "f"]);
  });
  it("does not repeat or skip records when a new one is inserted at the top", () => {
    const live = [{ _id: "new" }, ...list];
    expect(ids(pageSlice(live, boundaries, 0))).toEqual(["new", "a", "b", "c"]);
    expect(ids(pageSlice(live, boundaries, 1))).toEqual(["d", "e", "f"]);
  });
  it("keeps the next page intact when the boundary record is deleted", () => {
    const live = list.filter((item) => item._id !== "c");
    expect(ids(pageSlice(live, boundaries, 0))).toEqual(["a", "b"]);
    expect(ids(pageSlice(live, boundaries, 1))).toEqual(["d", "e", "f"]);
  });
  it("keeps an empty candidate page empty and cuts the open page at the pending boundary", () => {
    const empty = [boundaryFor(list.slice(0, 3)), boundaryFor(list.slice(0, 3))];
    expect(pageSlice(list, empty, 1)).toEqual([]);
    expect(ids(pageSlice(list, empty, 2))).toEqual(["d", "e", "f"]);
    expect(ids(pageSlice(list, [], 0, boundaryFor(list.slice(0, 2))))).toEqual(["a", "b"]);
  });
  it("starts from the beginning when nothing was loaded yet", () => {
    expect(ids(pageSlice(list, [boundaryFor([])], 1))).toEqual(ids(list));
  });
});
