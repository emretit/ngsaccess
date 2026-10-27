import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader primary action", () => {
  it("renders the label with the shared button classes and Plus icon", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Personel" primaryAction={{ label: "Personel ekle", onClick: vi.fn() }} />,
    );
    const button = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";

    expect(button.replace(/<[^>]*>/g, "")).toBe("Personel ekle");
    expect(button).toContain("text-xs");
    expect(button).toContain("min-h-11");
    expect(button).toContain("md:min-h-8");
    expect(button).toContain("gap-1.5");
    expect(button).toContain("lucide-plus");
    expect(button).toContain('aria-hidden="true"');
    expect(button).not.toContain(' disabled=""');
  });

  it("forwards disabled to the primary action button", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Personel" primaryAction={{ label: "Personel ekle", onClick: vi.fn(), disabled: true }} />,
    );

    expect(html).toContain(' disabled=""');
  });
});
