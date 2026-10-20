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
