import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("empty state announcements", () => {
  it("keeps existing dynamic announcements by default", () => {
    expect(renderToStaticMarkup(<EmptyState title="Kayıt bulunamadı" />)).toContain('role="status"');
  });

  it("allows static information without a live region", () => {
    const html = renderToStaticMarkup(<EmptyState live={false} title="Henüz kullanıma açılmadı" />);
    expect(html).toContain("Henüz kullanıma açılmadı");
    expect(html).not.toContain('role="status"');
  });
});
