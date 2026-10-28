import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { EmptyState } from "@/components/shared/EmptyState";
import { ShiftCalendarGrid } from "./ShiftCalendarGrid";

it.each([1, 7, 31])("keeps %s day columns and a spanning empty/loading row", count => {
  const days = Array.from({ length: count }, (_, index) => `2026-10-${String(index + 1).padStart(2, "0")}`);
  for (const loading of [true, false]) {
    const html = renderToStaticMarkup(<ShiftCalendarGrid employees={[]} days={days} selected={new Set()} getData={() => { throw new Error("No cells should be resolved"); }} onOpen={() => undefined} loading={loading} emptyState={<EmptyState title="Bu projede çalışan yok" action={{ label: "Kişileri aç", onClick: () => undefined }} />} />);
    expect(html).toContain('>Çalışan</th>');
    expect(html.match(/scope="col"/g)).toHaveLength(count + 1);
    expect(html).toContain(`colSpan="${count + 1}"`);
    expect(html).toContain(loading ? "Plan, izin ve tatiller kontrol ediliyor" : "Kişileri aç");
  }
});
