import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PdksExcludedReadingsNotice } from "./PdksExcludedReadingsNotice";
import { PdksRowStatus } from "./PdksRowStatus";
import type { PdksRow } from "../lib/presentation";

describe("PDKS dışlanan belirsiz okumalar", () => {
  it.each([undefined, 0])("sayı yoksa veya sıfırsa sessiz kalır (%s)", count => {
    expect(renderToStaticMarkup(<PdksExcludedReadingsNotice count={count} />)).toBe("");
  });
  it("sayısı ile Türkçe göstergeyi sunar", () => {
    expect(renderToStaticMarkup(<PdksExcludedReadingsNotice count={3} />)).toContain("3 okuma PDKS dışı bırakıldı");
  });
  it("devamsız satırın durumunu koruyarak sayıyı gösterir", () => {
    const record = { status: "absent", isEarlyExit: false, isManual: false, leaveType: "", excludedUnknownReadings: 2 } as PdksRow;
    const html = renderToStaticMarkup(<PdksRowStatus record={record} />);
    expect(html).toContain("Devamsız");
    expect(html).toContain("2 okuma PDKS dışı bırakıldı");
  });
});

it.each([
  ["missingExit", "Çıkış okutması yok"], ["missingEntry", "Giriş okutması yok"],
  ["noPunch", "Okutma yok"], ["undirected", "Yön bilgisi yok"],
] as const)("İnceleme rozetini kalite nedeni ve sayısıyla gösterir: %s", (punchQuality, text) => {
  const record = { status: "incomplete", punchQuality, incompleteDays: 2, isEarlyExit: false, isManual: false, leaveType: "" } as PdksRow;
  const html = renderToStaticMarkup(<PdksRowStatus record={record} />);
  expect(html).toContain("İnceleme</div>"); expect(html).toContain(text); expect(html).toContain("İnceleme: 2");
});

it("legacy satırda backend'in her zaman gönderdiği kalite alanları ipucu ya da sayaç göstermez", () => {
  for (const punchQuality of ["ok", "noPunch", "missingExit"] as const) {
    const record = { status: "present", punchQuality, durationMeasured: true, incompleteDays: 0, isEarlyExit: false, isManual: false, leaveType: "" } as PdksRow;
    const html = renderToStaticMarkup(<PdksRowStatus record={record} />);
    expect(html).not.toContain("İnceleme:"); expect(html).not.toContain("okutması yok"); expect(html).not.toContain("Okutma yok");
  }
});

it("legacy satırın çıktısı değişmez", () => {
  const record = { status: "present", isEarlyExit: false, isManual: false, leaveType: "" } as PdksRow;
  expect(renderToStaticMarkup(<PdksRowStatus record={record} />)).toBe('<div class="flex flex-wrap items-center gap-1"><div class="inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground gap-1.5 border-transparent before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-current status-success-badge">Mevcut</div></div>');
});
