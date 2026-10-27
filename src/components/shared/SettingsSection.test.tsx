import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SettingsSection } from "./SettingsSection";

describe("SettingsSection", () => {
  it("labels the semantic section with its h3 and keeps content and actions", () => {
    const html = renderToStaticMarkup(
      <SettingsSection
        id="mail-test"
        title="Bağlantı"
        description={<p>Açıklama</p>}
        actions={<button>Test et</button>}
      >
        <input />
      </SettingsSection>,
    );
    expect(html).toContain(
      '<section id="mail-test" aria-labelledby="mail-test-title"',
    );
    expect(html).toContain('<h3 id="mail-test-title"');
    expect(html).toContain("Açıklama");
    expect(html).toContain("<input");
    expect(html).toContain("Test et");
  });
  it("generates distinct heading IDs for unnamed sections", () => {
    const html = renderToStaticMarkup(
      <>
        <SettingsSection title="Bir">A</SettingsSection>
        <SettingsSection title="İki">B</SettingsSection>
      </>,
    );
    const ids = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });
  it.each(["compact", "regular"] as const)(
    "supports %s density and an optional divider",
    (density) => {
      const html = renderToStaticMarkup(
        <SettingsSection title="Başlık" density={density} divided>
          Alan
        </SettingsSection>,
      );
      expect(html).toContain(
        density === "compact" ? "border-t pt-4" : "border-t pt-5",
      );
      expect(html).toContain(density === "compact" ? "text-sm" : "text-base");
      expect(html).not.toContain("text-muted-foreground");
    },
  );
});
