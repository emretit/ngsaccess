import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatInline } from "./StatInline";

describe("StatInline data states", () => {
  it("distinguishes a confirmed zero from missing values and formats Turkish numbers", () => {
    const html = renderToStaticMarkup(<StatInline items={[
      { label: "Sıfır", value: 0 }, { label: "Eksik", value: null },
      { label: "Bekleniyor", value: undefined }, { label: "Toplam", value: 1234 },
    ]} />);
    expect(html).toContain('>0</dd>');
    expect(html.match(/>—<\/dd>/g)).toHaveLength(2);
    expect(html).toContain('>1.234</dd>');
  });
  it("does not announce stale values or zero while loading a new scope", () => {
    const html = renderToStaticMarkup(<StatInline loading variant="metrics" items={[{ label: "Toplam", value: 1234 }]} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('1.234');
    expect(html).not.toContain('>0</dd>');
  });
});
