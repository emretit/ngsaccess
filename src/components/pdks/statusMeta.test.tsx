import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { STATUS_META, STATUS_FILTER_LABELS, statusMetaFor } from "./statusMeta";
import { cellLabel, type PdksCell, type PdksRow } from "./lib/presentation";
import { analyzePdksRows } from "./lib/analysis";
import { PDKSHeatmapView } from "./dashboard/PDKSHeatmapView";
import { PdksRowStatus } from "./dashboard/PdksRowStatus";

it.each(["08:00", "00:00"])("future + giriş %s: ortak etiket, rozet ve hücre Devam ediyor", firstEntry => {
  const item = { status: "future", firstEntry } as const;
  expect(statusMetaFor(item)).toMatchObject({ label: "Devam ediyor", tone: "info" });
  expect(renderToStaticMarkup(<PdksRowStatus record={item as PdksRow} />)).toContain("Devam ediyor");
  expect(cellLabel("Ada", "2026-10-23", item as PdksCell)).toContain("Devam ediyor");
  expect(STATUS_FILTER_LABELS.future).toContain(statusMetaFor(item).label);
});
it.each([null, undefined, "", "—"])("future giriş yok (%s): Henüz gelmedi", firstEntry => {
  expect(statusMetaFor({ status: "future", firstEntry })).toBe(STATUS_META.future);
});
it("diğer durumların metası giriş olsa da aynı kalır", () => {
  for (const status of Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]) {
    if (status === "future") continue;
    expect(statusMetaFor({ status, firstEntry: "08:00" })).toBe(STATUS_META[status]);
  }
});

it("ısı haritası ve analiz girişli/girişsiz future günleri ayırır", () => {
  const cells = [
    { date: "2026-10-23", status: "future", firstEntry: "08:00", totalMinutes: 0 },
    { date: "2026-10-24", status: "future", firstEntry: null, totalMinutes: 0 },
  ] as PdksCell[];
  const row = { id: "ada", name: "Ada", days: cells } as PdksRow;
  const html = renderToStaticMarkup(<PDKSHeatmapView records={[row]} loading={false} startDate="2026-10-23" endDate="2026-10-24" />);
  expect(html).toMatch(/aria-label="Ada, [^"]*Devam ediyor/);
  expect(html).toMatch(/aria-label="Ada, [^"]*Henüz gelmedi/);
  expect(analyzePdksRows([row]).map(day => ({ future: day.counts.future, inProgress: day.inProgress }))).toEqual([
    { future: 1, inProgress: 1 }, { future: 1, inProgress: 0 },
  ]);
});
