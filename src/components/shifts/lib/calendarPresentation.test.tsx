import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ShiftCalendarGrid, type CalendarProps } from "../ShiftCalendarGrid";
import { ShiftAgendaView } from "../ShiftAgendaView";
import {
  cellData,
  type Employee,
  type Assignment,
  type Shift,
} from "./planning";
const employee = {
  _id: "employee",
  projectId: "project",
  firstName: "İpek",
  lastName: "Yıldız",
  email: "ipek@example.com",
} as Employee;
const shifts = [
  { _id: "night", name: "Gece", startTime: "22:00", endTime: "06:00" },
] as Shift[];
const assignments = [
  {
    _id: "assignment",
    employeeId: employee._id,
    shiftId: "night",
    startDate: "2026-10-19",
    endDate: "2026-10-19",
  },
] as Assignment[];
const props: CalendarProps = {
  employees: [employee],
  days: ["2026-10-20"],
  getData: (person, date) =>
    cellData(person, date, assignments, shifts, [], []),
  onOpen: () => undefined,
  onSelect: () => undefined,
  selected: new Set(),
};
describe("Vardiya takvimi erişilebilir sunum sözleşmesi", () => {
  it("kişi ve gün başlıklarıyla semantik tablo ve adlandırılmış klavye düğmesi üretir", () => {
    const html = renderToStaticMarkup(<ShiftCalendarGrid {...props} />);
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain(
      'aria-label="İpek Yıldız, 20 Ekim 2026 Sal, 1 atama: Gece, ayrıntıları aç"',
    );
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
  });
  it("mobil ajanda aynı gece devamını ve kişi seçimini korur", () => {
    const desktop = renderToStaticMarkup(<ShiftCalendarGrid {...props} />);
    const mobile = renderToStaticMarkup(<ShiftAgendaView {...props} />);
    for (const html of [desktop, mobile]) {
      expect(html).toContain("Önceki günden · 00:00–06:00");
      expect(html).toContain("İpek Yıldız seç");
    }
    expect(mobile).not.toContain("<table");
  });
  it("üçten fazla atamayı hücrede sınırlayıp gerçek ayrıntı sayısını duyurur", () => {
    const html = renderToStaticMarkup(
      <ShiftCalendarGrid
        {...props}
        days={["2026-10-19"]}
        getData={(person, date) =>
          cellData(
            person,
            date,
            Array.from(
              { length: 4 },
              (_, i) =>
                ({ ...assignments[0], _id: `assignment${i}` }) as Assignment,
            ),
            shifts,
            [],
            [],
          )
        }
      />,
    );
    expect(html).toContain("4 atama: Gece, Gece, Gece, Gece, ayrıntıları aç");
    expect(html).toContain("+2 atama · tümünü gör");
    expect(html.match(/Gece<\/span>/g)).toHaveLength(2);
    expect(html).toContain("Çakışma");
  });
});


it("09-D3/D10: başlıkta kısa Türkçe gün, erişilebilir adda tam tarih ve 24px seçim alanı vardır", () => {
  const html = renderToStaticMarkup(<ShiftCalendarGrid {...props} />);
  expect(html).toContain('<span aria-hidden="true">Sal 20</span>');
  expect(html).toContain('<span class="sr-only">20 Ekim 2026 Sal</span>');
  expect(html).toContain("size-6 shrink-0 accent-primary");
  expect(html).not.toContain("2026-10-20");
});
